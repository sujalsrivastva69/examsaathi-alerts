create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.vacancies (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 200),
  recruiting_organization text not null check (char_length(recruiting_organization) between 2 and 200),
  official_source_url text not null check (official_source_url ~ '^https://'),
  pdf_url text check (pdf_url is null or pdf_url ~ '^https://'),
  application_start_date date not null,
  deadline date not null,
  age_cutoff_date date not null,
  rule_json jsonb not null,
  status text not null default 'draft'
    check (status in ('draft', 'awaiting_verification', 'verified_open', 'closed')),
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified')),
  verification_checklist jsonb not null default
    '{"source_checked": false, "dates_checked": false, "rules_checked": false}'::jsonb,
  last_verified_at timestamptz,
  archived_at timestamptz,
  created_by uuid not null references auth.users (id),
  updated_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vacancy_application_dates_valid check (application_start_date <= deadline)
);

create index vacancies_status_deadline_idx on public.vacancies (status, deadline);
create index vacancies_updated_at_idx on public.vacancies (updated_at desc);

create table public.vacancy_changes (
  id bigint generated always as identity primary key,
  vacancy_id uuid not null references public.vacancies (id) on delete cascade,
  field_name text not null,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid not null references auth.users (id),
  changed_at timestamptz not null default now()
);

create index vacancy_changes_vacancy_changed_at_idx
  on public.vacancy_changes (vacancy_id, changed_at desc);

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users (id),
  action text not null,
  resource_type text not null check (resource_type = 'vacancy'),
  resource_id uuid not null,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.admin_test_profiles (
  id bigint generated always as identity primary key,
  date_of_birth date not null,
  qualification_level text not null,
  discipline text not null,
  category text not null check (category in ('general', 'sc', 'st', 'obc', 'ews', 'pwd', 'ex_serviceman')),
  state text not null,
  experience_years integer not null check (experience_years between 0 and 50)
);

insert into public.admin_test_profiles
  (date_of_birth, qualification_level, discipline, category, state, experience_years)
values
  ('1998-05-12', 'undergraduate', 'engineering', 'obc', 'Maharashtra', 2),
  ('2002-11-03', 'higher_secondary', 'general', 'sc', 'Delhi', 0),
  ('1992-02-20', 'postgraduate', 'engineering', 'general', 'Karnataka', 5),
  ('2000-07-18', 'diploma', 'healthcare', 'st', 'Assam', 1),
  ('1988-01-09', 'undergraduate', 'administration', 'ex_serviceman', 'Punjab', 8);

alter table public.user_roles enable row level security;
alter table public.vacancies enable row level security;
alter table public.vacancy_changes enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.admin_test_profiles enable row level security;

create policy "Anyone can read verified open vacancies"
  on public.vacancies for select
  to anon, authenticated
  using (status = 'verified_open');

grant select on public.vacancies to anon, authenticated;

create or replace function public.admin_create_vacancy(p_actor_id uuid, p_vacancy jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.vacancies%rowtype;
  v_new jsonb;
  v_key text;
begin
  if not exists (
    select 1 from public.user_roles
    where user_id = p_actor_id and role = 'admin'
  ) then
    raise exception 'Administrative role required' using errcode = '42501';
  end if;

  insert into public.vacancies (
    title, recruiting_organization, official_source_url, pdf_url,
    application_start_date, deadline, age_cutoff_date, rule_json,
    verification_checklist, created_by, updated_by
  )
  values (
    p_vacancy->>'title',
    p_vacancy->>'recruiting_organization',
    p_vacancy->>'official_source_url',
    p_vacancy->>'pdf_url',
    (p_vacancy->>'application_start_date')::date,
    (p_vacancy->>'deadline')::date,
    (p_vacancy->>'age_cutoff_date')::date,
    p_vacancy->'rule_json',
    p_vacancy->'verification_checklist',
    p_actor_id,
    p_actor_id
  )
  returning * into v;

  v_new := to_jsonb(v);
  foreach v_key in array array[
    'title', 'recruiting_organization', 'official_source_url', 'pdf_url',
    'application_start_date', 'deadline', 'age_cutoff_date', 'rule_json',
    'status', 'verification_status', 'verification_checklist'
  ] loop
    insert into public.vacancy_changes (vacancy_id, field_name, old_value, new_value, changed_by)
    values (v.id, v_key, null, v_new->v_key, p_actor_id);
  end loop;

  insert into public.admin_audit_log (actor_id, action, resource_type, resource_id, changes)
  values (p_actor_id, 'create', 'vacancy', v.id, v_new);
  return v_new;
end;
$$;

create or replace function public.admin_update_vacancy(
  p_vacancy_id uuid,
  p_actor_id uuid,
  p_patch jsonb,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.vacancies%rowtype;
  v_old jsonb;
  v_new jsonb;
  v_diff jsonb := '{}'::jsonb;
  v_key text;
  v_status text;
  v_verification_status text;
begin
  if not exists (
    select 1 from public.user_roles
    where user_id = p_actor_id and role = 'admin'
  ) then
    raise exception 'Administrative role required' using errcode = '42501';
  end if;

  select * into v from public.vacancies where id = p_vacancy_id for update;
  if not found then
    return null;
  end if;

  if jsonb_typeof(p_patch) <> 'object' or exists (
    select 1 from jsonb_object_keys(p_patch) as keys(key)
    where key not in (
      'title', 'recruiting_organization', 'official_source_url', 'pdf_url',
      'application_start_date', 'deadline', 'age_cutoff_date', 'rule_json',
      'status', 'verification_status', 'verification_checklist', 'last_verified_at', 'archived_at'
    )
  ) then
    raise exception 'Unsupported vacancy fields' using errcode = '22023';
  end if;

  v_status := coalesce(p_patch->>'status', v.status);
  v_verification_status := coalesce(p_patch->>'verification_status', v.verification_status);
  if p_action = 'submit' and not (v.status = 'draft' and v_status = 'awaiting_verification') then
    raise exception 'Invalid vacancy state transition' using errcode = '22023';
  elsif p_action = 'return_to_draft' and not (v.status = 'awaiting_verification' and v_status = 'draft') then
    raise exception 'Invalid vacancy state transition' using errcode = '22023';
  elsif p_action = 'verify' and not (
    v.status = 'awaiting_verification'
    and v_verification_status = 'verified'
    and p_patch ? 'last_verified_at'
    and (v.verification_checklist->>'source_checked')::boolean
    and (v.verification_checklist->>'dates_checked')::boolean
    and (v.verification_checklist->>'rules_checked')::boolean
  ) then
    raise exception 'Vacancy verification requirements not met' using errcode = '22023';
  elsif p_action = 'publish' and not (
    v.status = 'awaiting_verification'
    and v.verification_status = 'verified'
    and v.last_verified_at is not null
    and (v.verification_checklist->>'source_checked')::boolean
    and (v.verification_checklist->>'dates_checked')::boolean
    and (v.verification_checklist->>'rules_checked')::boolean
    and v_status = 'verified_open'
  ) then
    raise exception 'Vacancy is not ready to publish' using errcode = '22023';
  elsif p_action = 'close' and not (v.status = 'verified_open' and v_status = 'closed') then
    raise exception 'Invalid vacancy state transition' using errcode = '22023';
  elsif p_action = 'delete' and not (
    v.status = 'draft' and v.archived_at is null and p_patch ? 'archived_at'
  ) then
    raise exception 'Only an unarchived draft can be deleted' using errcode = '22023';
  elsif p_action = 'reopen' and not (v.status = 'closed' and v_status = 'awaiting_verification') then
    raise exception 'Invalid vacancy state transition' using errcode = '22023';
  elsif p_action = 'extend_deadline' and (
    v.status = 'closed'
    or (p_patch->>'deadline')::date <= v.deadline
    or (v.status = 'verified_open' and v_status <> 'awaiting_verification')
  ) then
    raise exception 'Invalid deadline extension' using errcode = '22023';
  elsif p_action = 'update' and (
    v.status = 'closed'
    or (v_status <> v.status and not (v.status = 'verified_open' and v_status = 'awaiting_verification'))
  ) then
    raise exception 'Invalid vacancy state transition' using errcode = '22023';
  elsif p_action not in (
    'update', 'submit', 'return_to_draft', 'verify', 'publish', 'close', 'delete', 'reopen', 'extend_deadline'
  ) then
    raise exception 'Unsupported vacancy action' using errcode = '22023';
  end if;

  v_old := to_jsonb(v);
  update public.vacancies set
    title = case when p_patch ? 'title' then p_patch->>'title' else title end,
    recruiting_organization = case when p_patch ? 'recruiting_organization' then p_patch->>'recruiting_organization' else recruiting_organization end,
    official_source_url = case when p_patch ? 'official_source_url' then p_patch->>'official_source_url' else official_source_url end,
    pdf_url = case when p_patch ? 'pdf_url' then p_patch->>'pdf_url' else pdf_url end,
    application_start_date = case when p_patch ? 'application_start_date' then (p_patch->>'application_start_date')::date else application_start_date end,
    deadline = case when p_patch ? 'deadline' then (p_patch->>'deadline')::date else deadline end,
    age_cutoff_date = case when p_patch ? 'age_cutoff_date' then (p_patch->>'age_cutoff_date')::date else age_cutoff_date end,
    rule_json = case when p_patch ? 'rule_json' then p_patch->'rule_json' else rule_json end,
    status = v_status,
    verification_status = v_verification_status,
    verification_checklist = case when p_patch ? 'verification_checklist' then p_patch->'verification_checklist' else verification_checklist end,
    last_verified_at = case when p_patch ? 'last_verified_at' then (p_patch->>'last_verified_at')::timestamptz else last_verified_at end,
    archived_at = case when p_patch ? 'archived_at' then (p_patch->>'archived_at')::timestamptz else archived_at end,
    updated_by = p_actor_id,
    updated_at = now()
  where id = p_vacancy_id
  returning * into v;

  v_new := to_jsonb(v);
  foreach v_key in array array[
    'title', 'recruiting_organization', 'official_source_url', 'pdf_url',
    'application_start_date', 'deadline', 'age_cutoff_date', 'rule_json',
    'status', 'verification_status', 'verification_checklist', 'last_verified_at', 'archived_at'
  ] loop
    if v_old->v_key is distinct from v_new->v_key then
      insert into public.vacancy_changes (vacancy_id, field_name, old_value, new_value, changed_by)
      values (v.id, v_key, v_old->v_key, v_new->v_key, p_actor_id);
      v_diff := v_diff || jsonb_build_object(
        v_key, jsonb_build_object('old', v_old->v_key, 'new', v_new->v_key)
      );
    end if;
  end loop;

  insert into public.admin_audit_log (actor_id, action, resource_type, resource_id, changes)
  values (p_actor_id, p_action, 'vacancy', v.id, v_diff);
  return v_new;
end;
$$;

revoke all on function public.admin_create_vacancy(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.admin_update_vacancy(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.admin_create_vacancy(uuid, jsonb) to service_role;
grant execute on function public.admin_update_vacancy(uuid, uuid, jsonb, text) to service_role;
