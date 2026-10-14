alter table public.vacancies
  alter column title drop not null,
  alter column recruiting_organization drop not null,
  alter column application_start_date drop not null,
  alter column deadline drop not null,
  alter column age_cutoff_date drop not null,
  alter column rule_json drop not null,
  alter column created_by drop not null,
  alter column updated_by drop not null,
  drop constraint vacancy_application_dates_valid,
  add constraint vacancy_application_dates_valid
    check (application_start_date is null or deadline is null or application_start_date <= deadline);

alter table public.vacancies
  add column source_id text,
  add column source_notice_url text,
  add column source_quotes jsonb not null default '{}'::jsonb,
  add column extraction_payload jsonb not null default '{}'::jsonb,
  add column extraction_confidence numeric(4, 3) not null default 0
    check (extraction_confidence between 0 and 1),
  add column ingestion_status text not null default 'manual'
    check (ingestion_status in ('manual', 'ready_for_review', 'needs_review', 'needs_manual_entry', 'rejected')),
  add column review_reasons text[] not null default '{}';

create table public.source_notices (
  id bigint generated always as identity primary key,
  source_id text not null,
  notice_url text not null check (notice_url ~ '^https://'),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  vacancy_id uuid references public.vacancies (id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  unique (source_id, notice_url)
);

create table public.source_notice_vacancies (
  source_notice_id bigint not null references public.source_notices (id) on delete cascade,
  vacancy_id uuid not null references public.vacancies (id) on delete cascade,
  post_index integer not null check (post_index >= 0),
  primary key (source_notice_id, vacancy_id),
  unique (source_notice_id, post_index)
);

create table public.ingestion_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  dry_run boolean not null default false,
  sources_checked jsonb not null default '[]'::jsonb,
  new_notices_found integer not null default 0,
  failures jsonb not null default '[]'::jsonb,
  run_summary jsonb not null default '{}'::jsonb
);

create table public.ingestion_source_health (
  source_id text primary key,
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  alert_sent_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.vacancy_changes
  alter column changed_by drop not null,
  add column actor_type text not null default 'admin' check (actor_type in ('admin', 'system'));

alter table public.admin_audit_log
  alter column actor_id drop not null,
  add column actor_type text not null default 'admin' check (actor_type in ('admin', 'system'));

alter table public.source_notices enable row level security;
alter table public.source_notice_vacancies enable row level security;
alter table public.ingestion_runs enable row level security;
alter table public.ingestion_source_health enable row level security;

create index source_notices_hash_idx on public.source_notices (source_id, content_hash);
create index vacancies_ingestion_review_idx
  on public.vacancies (status, ingestion_status, updated_at desc)
  where archived_at is null;

create or replace function public.ingest_source_notice(
  p_source_id text,
  p_notice_url text,
  p_content_hash text,
  p_vacancies jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_notice public.source_notices%rowtype;
  v_vacancy public.vacancies%rowtype;
  v_notice_id bigint;
  v_first_seen boolean;
  v_changed boolean;
  v_old_hash text;
  v_new jsonb;
  v_payload jsonb;
  v_post_index integer := 0;
  v_vacancy_ids jsonb := '[]'::jsonb;
  v_key text;
begin
  if p_source_id is null or p_source_id = ''
    or p_notice_url !~ '^https://'
    or p_content_hash !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_vacancies) <> 'array'
    or jsonb_array_length(p_vacancies) = 0
  then
    raise exception 'Invalid ingestion notice payload' using errcode = '22023';
  end if;

  select * into v_notice
  from public.source_notices
  where source_id = p_source_id and notice_url = p_notice_url
  for update;

  if found and v_notice.content_hash = p_content_hash then
    update public.source_notices
    set last_checked_at = now()
    where id = v_notice.id;
    select coalesce(jsonb_agg(vacancy_id), '[]'::jsonb) into v_vacancy_ids
    from public.source_notice_vacancies where source_notice_id = v_notice.id;
    return jsonb_build_object(
      'outcome', 'unchanged',
      'vacancy_id', v_notice.vacancy_id,
      'vacancy_ids', v_vacancy_ids
    );
  end if;

  v_first_seen := not found;
  v_changed := not v_first_seen;
  v_old_hash := case when v_changed then v_notice.content_hash else null end;

  if v_first_seen then
    insert into public.source_notices (source_id, notice_url, content_hash)
    values (p_source_id, p_notice_url, p_content_hash)
    returning id into v_notice_id;

    for v_payload in select value from jsonb_array_elements(p_vacancies) loop
      insert into public.vacancies (
        title, recruiting_organization, official_source_url, pdf_url,
        application_start_date, deadline, age_cutoff_date, rule_json,
        status, verification_status, verification_checklist, last_verified_at,
        created_by, updated_by, source_id, source_notice_url, source_quotes,
        extraction_payload, extraction_confidence, ingestion_status, review_reasons
      )
      values (
        nullif(v_payload->>'title', ''),
        nullif(v_payload->>'recruiting_organization', ''),
        p_notice_url,
        nullif(v_payload->>'pdf_url', ''),
        nullif(v_payload->>'application_start_date', '')::date,
        nullif(v_payload->>'deadline', '')::date,
        nullif(v_payload->>'age_cutoff_date', '')::date,
        case when v_payload->'rule_json' = 'null'::jsonb then null else v_payload->'rule_json' end,
        'awaiting_verification',
        'pending',
        '{"source_checked": false, "dates_checked": false, "rules_checked": false}'::jsonb,
        null,
        null,
        null,
        p_source_id,
        p_notice_url,
        coalesce(v_payload->'source_quotes', '{}'::jsonb),
        coalesce(v_payload->'extraction_payload', '{}'::jsonb),
        coalesce((v_payload->>'extraction_confidence')::numeric, 0),
        v_payload->>'ingestion_status',
        coalesce(array(select jsonb_array_elements_text(v_payload->'review_reasons')), array[]::text[])
      )
      returning * into v_vacancy;

      insert into public.source_notice_vacancies (source_notice_id, vacancy_id, post_index)
      values (v_notice_id, v_vacancy.id, v_post_index);
      update public.source_notices
      set vacancy_id = coalesce(vacancy_id, v_vacancy.id)
      where id = v_notice_id;
      v_vacancy_ids := v_vacancy_ids || jsonb_build_array(v_vacancy.id);
      v_post_index := v_post_index + 1;

      v_new := to_jsonb(v_vacancy);
      foreach v_key in array array[
        'title', 'recruiting_organization', 'official_source_url', 'pdf_url',
        'application_start_date', 'deadline', 'age_cutoff_date', 'rule_json',
        'source_quotes', 'extraction_confidence', 'ingestion_status'
      ] loop
        insert into public.vacancy_changes (vacancy_id, field_name, old_value, new_value, changed_by, actor_type)
        values (v_vacancy.id, v_key, null, v_new->v_key, null, 'system');
      end loop;

      insert into public.admin_audit_log (actor_id, actor_type, action, resource_type, resource_id, changes)
      values (null, 'system', 'ingest_notice', 'vacancy', v_vacancy.id, v_new);
    end loop;

    return jsonb_build_object(
      'outcome', 'new',
      'vacancy_id', v_vacancy_ids->0,
      'vacancy_ids', v_vacancy_ids,
      'source_notice_id', v_notice_id
    );
  end if;

  update public.source_notices
  set content_hash = p_content_hash, last_checked_at = now()
  where id = v_notice.id;

  for v_vacancy in
    select vacancies.*
    from public.source_notice_vacancies links
    join public.vacancies on vacancies.id = links.vacancy_id
    where links.source_notice_id = v_notice.id
    for update of vacancies
  loop
    v_post_index := 0;
    select value into v_payload
    from jsonb_array_elements(p_vacancies)
    with ordinality as items(value, ordinality)
    where items.ordinality = (
      select links.post_index + 1
      from public.source_notice_vacancies links
      where links.source_notice_id = v_notice.id and links.vacancy_id = v_vacancy.id
    );
    v_old := to_jsonb(v_vacancy);
    insert into public.vacancy_changes (vacancy_id, field_name, old_value, new_value, changed_by, actor_type)
    values (
      v_vacancy.id,
      'source_content_hash',
      to_jsonb(v_old_hash),
      to_jsonb(p_content_hash),
      null,
      'system'
    );
    update public.vacancies set
      status = case when status = 'verified_open' then 'awaiting_verification' else status end,
      verification_status = 'pending',
      verification_checklist = '{"source_checked": false, "dates_checked": false, "rules_checked": false}'::jsonb,
      last_verified_at = null,
      title = coalesce(nullif(v_payload->>'title', ''), title),
      recruiting_organization = coalesce(nullif(v_payload->>'recruiting_organization', ''), recruiting_organization),
      pdf_url = coalesce(nullif(v_payload->>'pdf_url', ''), pdf_url),
      application_start_date = coalesce(nullif(v_payload->>'application_start_date', '')::date, application_start_date),
      deadline = coalesce(nullif(v_payload->>'deadline', '')::date, deadline),
      age_cutoff_date = coalesce(nullif(v_payload->>'age_cutoff_date', '')::date, age_cutoff_date),
      ingestion_status = 'needs_review',
      source_quotes = coalesce(v_payload->'source_quotes', source_quotes),
      extraction_payload = coalesce(v_payload->'extraction_payload', extraction_payload),
      extraction_confidence = coalesce((v_payload->>'extraction_confidence')::numeric, extraction_confidence),
      rule_json = case
        when v_payload ? 'rule_json' and v_payload->'rule_json' <> 'null'::jsonb then v_payload->'rule_json'
        else rule_json
      end,
      review_reasons = array(
        select distinct reason
        from unnest(
          coalesce(array(select jsonb_array_elements_text(v_payload->'review_reasons')), array[]::text[])
          || array['Source notice content changed; review this vacancy before approval']
        ) as reasons(reason)
      ),
      updated_at = now()
    where id = v_vacancy.id
    returning * into v_vacancy;

    v_new := to_jsonb(v_vacancy);
    foreach v_key in array array[
      'title', 'recruiting_organization', 'official_source_url', 'pdf_url',
      'application_start_date', 'deadline', 'age_cutoff_date', 'rule_json',
      'status', 'verification_status', 'verification_checklist', 'last_verified_at',
      'source_quotes', 'extraction_payload', 'extraction_confidence', 'ingestion_status', 'review_reasons'
    ] loop
      if v_old->v_key is distinct from v_new->v_key then
        insert into public.vacancy_changes (vacancy_id, field_name, old_value, new_value, changed_by, actor_type)
        values (v_vacancy.id, v_key, v_old->v_key, v_new->v_key, null, 'system');
      end if;
    end loop;

    insert into public.admin_audit_log (actor_id, actor_type, action, resource_type, resource_id, changes)
    values (
      null,
      'system',
      'source_notice_changed',
      'vacancy',
      v_vacancy.id,
      jsonb_build_object(
        'source_content_hash', jsonb_build_object('old', v_old_hash, 'new', p_content_hash),
        'vacancy', jsonb_build_object('old', v_old, 'new', v_new)
      )
    );
  end loop;

  select coalesce(jsonb_agg(vacancy_id), '[]'::jsonb) into v_vacancy_ids
  from public.source_notice_vacancies where source_notice_id = v_notice.id;
  return jsonb_build_object(
    'outcome', 'changed',
    'vacancy_id', v_notice.vacancy_id,
    'vacancy_ids', v_vacancy_ids
  );
end;
$$;

create or replace function public.admin_reject_ingested_vacancy(p_vacancy_id uuid, p_actor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.vacancies%rowtype;
  v_old jsonb;
begin
  if not exists (
    select 1 from public.user_roles where user_id = p_actor_id and role = 'admin'
  ) then
    raise exception 'Administrative role required' using errcode = '42501';
  end if;
  select * into v from public.vacancies where id = p_vacancy_id and archived_at is null for update;
  if not found then return null; end if;
  if v.status <> 'awaiting_verification' or v.source_id is null then
    raise exception 'Only an ingested vacancy awaiting verification can be rejected' using errcode = '22023';
  end if;
  v_old := to_jsonb(v);
  update public.vacancies
  set ingestion_status = 'rejected', archived_at = now(), updated_by = p_actor_id, updated_at = now()
  where id = p_vacancy_id
  returning * into v;

  insert into public.vacancy_changes (vacancy_id, field_name, old_value, new_value, changed_by)
  values
    (v.id, 'ingestion_status', v_old->'ingestion_status', to_jsonb(v.ingestion_status), p_actor_id),
    (v.id, 'archived_at', v_old->'archived_at', to_jsonb(v.archived_at), p_actor_id);
  insert into public.admin_audit_log (actor_id, action, resource_type, resource_id, changes)
  values (
    p_actor_id,
    'reject_ingested_vacancy',
    'vacancy',
    v.id,
    jsonb_build_object(
      'ingestion_status', jsonb_build_object('old', v_old->'ingestion_status', 'new', to_jsonb(v.ingestion_status)),
      'archived_at', jsonb_build_object('old', v_old->'archived_at', 'new', to_jsonb(v.archived_at))
    )
  );
  return to_jsonb(v);
end;
$$;

create or replace function public.admin_approve_publish_vacancy(p_vacancy_id uuid, p_actor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_verified jsonb;
begin
  v_verified := public.admin_update_vacancy(
    p_vacancy_id,
    p_actor_id,
    jsonb_build_object('verification_status', 'verified', 'last_verified_at', now()),
    'verify'
  );
  if v_verified is null then
    return null;
  end if;
  return public.admin_update_vacancy(
    p_vacancy_id,
    p_actor_id,
    jsonb_build_object('status', 'verified_open'),
    'publish'
  );
end;
$$;

revoke all on function public.ingest_source_notice(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.admin_reject_ingested_vacancy(uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_approve_publish_vacancy(uuid, uuid) from public, anon, authenticated;
grant execute on function public.ingest_source_notice(text, text, text, jsonb) to service_role;
grant execute on function public.admin_reject_ingested_vacancy(uuid, uuid) to service_role;
grant execute on function public.admin_approve_publish_vacancy(uuid, uuid) to service_role;
