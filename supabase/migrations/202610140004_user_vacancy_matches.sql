alter table public.vacancies
  add column rules_version integer not null default 1 check (rules_version > 0);

create or replace function public.bump_vacancy_rules_version()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.rule_json is distinct from new.rule_json
    or old.age_cutoff_date is distinct from new.age_cutoff_date
    or old.deadline is distinct from new.deadline
  then
    new.rules_version := old.rules_version + 1;
  end if;
  return new;
end;
$$;

create trigger vacancies_bump_rules_version
before update on public.vacancies
for each row execute function public.bump_vacancy_rules_version();

create table public.user_vacancy_matches (
  user_id uuid not null references auth.users (id) on delete cascade,
  vacancy_id uuid not null references public.vacancies (id) on delete cascade,
  status text not null check (
    status in ('preliminary_match', 'needs_review', 'not_matched', 'expired', 'under_verification')
  ),
  explanation jsonb not null check (jsonb_typeof(explanation) = 'object'),
  missing text[] not null default '{}',
  failed text[] not null default '{}',
  rules_version integer not null check (rules_version > 0),
  evaluated_at timestamptz not null default now(),
  primary key (user_id, vacancy_id)
);

create index user_vacancy_matches_user_status_idx
  on public.user_vacancy_matches (user_id, status, evaluated_at desc);
create index user_vacancy_matches_vacancy_idx
  on public.user_vacancy_matches (vacancy_id, rules_version);

alter table public.user_vacancy_matches enable row level security;

create policy "Users can read their own vacancy matches"
  on public.user_vacancy_matches for select
  to authenticated
  using (auth.uid() = user_id);

grant select on public.user_vacancy_matches to authenticated;
grant select, insert, update, delete on public.user_vacancy_matches to service_role;
