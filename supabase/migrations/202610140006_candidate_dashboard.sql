alter table public.notification_preferences
  add column email_frequency text not null default 'immediate'
    check (email_frequency in ('immediate', 'daily', 'weekly')),
  add column deadline_reminders_enabled boolean not null default true;

alter table public.user_vacancy_actions
  drop constraint user_vacancy_actions_status_check,
  add constraint user_vacancy_actions_status_check
    check (status in ('interested', 'started', 'applied', 'not_interested'));

create table public.user_vacancy_action_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  vacancy_id uuid not null references public.vacancies (id) on delete cascade,
  previous_status text check (
    previous_status is null
    or previous_status in ('interested', 'started', 'applied', 'not_interested')
  ),
  status text not null check (status in ('interested', 'started', 'applied', 'not_interested')),
  changed_at timestamptz not null default now()
);

create index user_vacancy_action_history_user_vacancy_idx
  on public.user_vacancy_action_history (user_id, vacancy_id, changed_at desc);

alter table public.user_vacancy_action_history enable row level security;

create policy "Users can read their own vacancy action history"
  on public.user_vacancy_action_history for select
  to authenticated
  using (auth.uid() = user_id);

grant select on public.user_vacancy_action_history to authenticated;
grant insert, select on public.user_vacancy_action_history to service_role;
grant usage, select on sequence public.user_vacancy_action_history_id_seq to service_role;

create or replace function public.set_user_vacancy_action(
  p_user_id uuid,
  p_vacancy_id uuid,
  p_status text
)
returns public.user_vacancy_actions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_previous text;
  v_action public.user_vacancy_actions%rowtype;
begin
  if p_status not in ('interested', 'started', 'applied', 'not_interested') then
    raise exception 'Invalid vacancy action status' using errcode = '22023';
  end if;

  select status into v_previous
  from public.user_vacancy_actions
  where user_id = p_user_id and vacancy_id = p_vacancy_id
  for update;

  insert into public.user_vacancy_actions (user_id, vacancy_id, status, updated_at)
  values (p_user_id, p_vacancy_id, p_status, now())
  on conflict (user_id, vacancy_id)
  do update set status = excluded.status, updated_at = excluded.updated_at
  returning * into v_action;

  if v_previous is distinct from p_status then
    insert into public.user_vacancy_action_history (
      user_id, vacancy_id, previous_status, status
    ) values (p_user_id, p_vacancy_id, v_previous, p_status);
  end if;

  return v_action;
end;
$$;

revoke all on function public.set_user_vacancy_action(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.set_user_vacancy_action(uuid, uuid, text) to service_role;
