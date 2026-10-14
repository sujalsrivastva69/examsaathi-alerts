create table public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vacancy_id uuid references public.vacancies (id) on delete set null,
  feedback_type text not null check (
    feedback_type in ('wrong_match', 'missed_vacancy', 'irrelevant_alert')
  ),
  details text not null check (char_length(details) between 10 and 3000),
  created_at timestamptz not null default now()
);

create index beta_feedback_created_type_idx
  on public.beta_feedback (created_at desc, feedback_type);

alter table public.beta_feedback enable row level security;

create policy "Users can submit their own beta feedback"
  on public.beta_feedback for insert
  to authenticated
  with check (auth.uid() = user_id);

grant insert on public.beta_feedback to authenticated;
grant select, insert on public.beta_feedback to service_role;

create table public.email_provider_events (
  event_id text primary key,
  message_id text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

create index email_provider_events_type_date_idx
  on public.email_provider_events (event_type, occurred_at desc);

alter table public.email_provider_events enable row level security;
grant select, insert on public.email_provider_events to service_role;
