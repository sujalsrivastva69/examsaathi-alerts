alter table public.notification_preferences
  add column email_enabled boolean not null default false,
  add column notify_needs_review boolean not null default false,
  add column language text not null default 'en' check (language in ('en', 'hi')),
  add column unsubscribed_at timestamptz;

update public.notification_preferences
set email_enabled = email_consent;

alter table public.vacancies
  add column stale_verification_flag boolean not null default false,
  add column next_notification_type text not null default 'new_vacancy'
    check (next_notification_type in ('new_vacancy', 'deadline_extended', 'important_correction'));

create or replace function public.track_vacancy_notification_event()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status = 'verified_open' and old.deadline is distinct from new.deadline then
    new.next_notification_type := 'deadline_extended';
  elsif old.status = 'verified_open' and (
    old.rule_json is distinct from new.rule_json
    or old.title is distinct from new.title
    or old.recruiting_organization is distinct from new.recruiting_organization
    or old.official_source_url is distinct from new.official_source_url
    or old.source_quotes is distinct from new.source_quotes
    or old.extraction_payload is distinct from new.extraction_payload
  ) then
    new.next_notification_type := 'important_correction';
  end if;
  if new.last_verified_at is distinct from old.last_verified_at then
    new.stale_verification_flag := false;
  end if;
  return new;
end;
$$;

create trigger vacancies_track_notification_event
before update on public.vacancies
for each row execute function public.track_vacancy_notification_event();

create index vacancies_stale_verification_idx
  on public.vacancies (last_verified_at)
  where status = 'verified_open' and stale_verification_flag = false;

create table public.user_vacancy_actions (
  user_id uuid not null references auth.users (id) on delete cascade,
  vacancy_id uuid not null references public.vacancies (id) on delete cascade,
  status text not null check (status in ('applied', 'not_interested')),
  updated_at timestamptz not null default now(),
  primary key (user_id, vacancy_id)
);

create table public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vacancy_id uuid not null references public.vacancies (id) on delete cascade,
  notification_type text not null check (
    notification_type in (
      'new_vacancy',
      'deadline_reminder_3d',
      'deadline_reminder_1d',
      'deadline_extended',
      'important_correction'
    )
  ),
  idempotency_key text not null unique check (idempotency_key ~ '^[a-f0-9]{64}$'),
  rules_version integer not null check (rules_version > 0),
  match_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'sent', 'dry_run', 'suppressed', 'failed')
  ),
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notification_queue_pending_idx
  on public.notification_queue (available_at, created_at)
  where status = 'pending';
create index notification_queue_failed_idx
  on public.notification_queue (created_at desc)
  where status = 'failed';

create table public.notification_logs (
  id bigint generated always as identity primary key,
  queue_id uuid references public.notification_queue (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  vacancy_id uuid references public.vacancies (id) on delete set null,
  notification_type text not null,
  attempt integer not null check (attempt between 0 and 3),
  status text not null check (
    status in ('sent', 'dry_run', 'retrying', 'failed', 'suppressed')
  ),
  provider_message_id text,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.user_vacancy_actions enable row level security;
alter table public.notification_queue enable row level security;
alter table public.notification_logs enable row level security;

create policy "Users can manage their own vacancy actions"
  on public.user_vacancy_actions for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.user_vacancy_actions to authenticated;
grant select, insert, update, delete on public.user_vacancy_actions to service_role;
grant select, insert, update, delete on public.notification_queue to service_role;
grant select, insert on public.notification_logs to service_role;
grant usage, select on sequence public.notification_logs_id_seq to service_role;

create or replace function public.claim_notification_batch(p_limit integer default 25)
returns setof public.notification_queue
language sql
security definer
set search_path = public, pg_temp
as $$
  with abandoned as (
    update public.notification_queue
    set status = 'failed',
        last_error = 'Worker lease expired after the maximum delivery attempts.',
        locked_at = null,
        updated_at = now()
    where status = 'processing'
      and attempt_count >= 3
      and locked_at < now() - interval '15 minutes'
    returning *
  ),
  abandoned_logs as (
    insert into public.notification_logs (
      queue_id, user_id, vacancy_id, notification_type, attempt, status, reason
    )
    select id, user_id, vacancy_id, notification_type, attempt_count, 'failed',
           'Worker lease expired after the maximum delivery attempts.'
    from abandoned
    returning id
  ),
  selected as (
    select id
    from public.notification_queue
    where attempt_count < 3
      and (
        (status = 'pending' and available_at <= now())
        or (status = 'processing' and locked_at < now() - interval '15 minutes')
      )
    order by available_at, created_at
    for update skip locked
    limit least(greatest(p_limit, 1), 100)
  )
  update public.notification_queue q
  set status = 'processing',
      attempt_count = q.attempt_count + 1,
      locked_at = now(),
      updated_at = now()
  from selected
  where q.id = selected.id
  returning q.*;
$$;

revoke all on function public.claim_notification_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_batch(integer) to service_role;
