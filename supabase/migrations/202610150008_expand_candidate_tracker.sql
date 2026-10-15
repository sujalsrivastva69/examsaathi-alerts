alter table public.user_vacancy_actions
  drop constraint user_vacancy_actions_status_check,
  add column notes text check (notes is null or char_length(notes) <= 2000);

alter table public.user_vacancy_action_history
  drop constraint user_vacancy_action_history_previous_status_check,
  drop constraint user_vacancy_action_history_status_check;

update public.user_vacancy_actions
set status = case status
  when 'started' then 'application_started'
  when 'applied' then 'submitted'
  else status
end;

update public.user_vacancy_action_history
set previous_status = case previous_status
  when 'started' then 'application_started'
  when 'applied' then 'submitted'
  else previous_status
end,
status = case status
  when 'started' then 'application_started'
  when 'applied' then 'submitted'
  else status
end;

alter table public.user_vacancy_actions
  add constraint user_vacancy_actions_status_check
    check (status in (
      'saved',
      'interested',
      'application_started',
      'submitted',
      'admit_card_available',
      'exam_appeared',
      'result_declared',
      'next_stage',
      'not_interested'
    ));

alter table public.user_vacancy_action_history
  add constraint user_vacancy_action_history_previous_status_check
    check (
      previous_status is null
      or previous_status in (
        'saved',
        'interested',
        'application_started',
        'submitted',
        'admit_card_available',
        'exam_appeared',
        'result_declared',
        'next_stage',
        'not_interested'
      )
    ),
  add constraint user_vacancy_action_history_status_check
    check (status in (
      'saved',
      'interested',
      'application_started',
      'submitted',
      'admit_card_available',
      'exam_appeared',
      'result_declared',
      'next_stage',
      'not_interested'
    ));

drop function public.set_user_vacancy_action(uuid, uuid, text);

create function public.set_user_vacancy_action(
  p_user_id uuid,
  p_vacancy_id uuid,
  p_status text,
  p_notes text default null
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
  if p_status not in (
    'saved',
    'interested',
    'application_started',
    'submitted',
    'admit_card_available',
    'exam_appeared',
    'result_declared',
    'next_stage',
    'not_interested'
  ) then
    raise exception 'Invalid vacancy action status' using errcode = '22023';
  end if;
  if p_notes is not null and char_length(p_notes) > 2000 then
    raise exception 'Tracker notes exceed the maximum length' using errcode = '22023';
  end if;

  select status into v_previous
  from public.user_vacancy_actions
  where user_id = p_user_id and vacancy_id = p_vacancy_id
  for update;

  insert into public.user_vacancy_actions (user_id, vacancy_id, status, notes, updated_at)
  values (p_user_id, p_vacancy_id, p_status, nullif(btrim(p_notes), ''), now())
  on conflict (user_id, vacancy_id)
  do update set
    status = excluded.status,
    notes = excluded.notes,
    updated_at = excluded.updated_at
  returning * into v_action;

  if v_previous is distinct from p_status then
    insert into public.user_vacancy_action_history (
      user_id, vacancy_id, previous_status, status
    ) values (p_user_id, p_vacancy_id, v_previous, p_status);
  end if;

  return v_action;
end;
$$;

revoke all on function public.set_user_vacancy_action(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.set_user_vacancy_action(uuid, uuid, text, text) to service_role;
