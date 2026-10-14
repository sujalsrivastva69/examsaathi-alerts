create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  education text not null check (
    education in (
      'secondary',
      'higher_secondary',
      'diploma',
      'undergraduate',
      'postgraduate',
      'doctoral',
      'other'
    )
  ),
  date_of_birth date not null,
  state text not null,
  job_preferences text[] not null check (cardinality(job_preferences) between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email_consent boolean not null default false,
  sms_consent boolean not null default false check (sms_consent = false),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.notification_preferences enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can read their own notification preferences"
  on public.notification_preferences for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own notification preferences"
  on public.notification_preferences for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own notification preferences"
  on public.notification_preferences for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
