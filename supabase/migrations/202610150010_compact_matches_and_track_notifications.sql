alter table public.user_vacancy_matches
  alter column explanation drop not null;

alter table public.vacancies
  add column last_enqueued_notification_type text
    check (
      last_enqueued_notification_type is null
      or last_enqueued_notification_type in (
        'new_vacancy',
        'deadline_extended',
        'important_correction'
      )
    ),
  add column last_enqueued_rules_version integer
    check (last_enqueued_rules_version is null or last_enqueued_rules_version > 0);
