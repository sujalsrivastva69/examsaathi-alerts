alter table public.profiles
  add column category text,
  add column discipline text,
  add column experience_years integer;

alter table public.profiles
  add constraint profiles_category_check
    check (
      category is null
      or category in ('general', 'sc', 'st', 'obc', 'ews', 'pwd', 'ex_serviceman')
    ),
  add constraint profiles_discipline_check
    check (discipline is null or char_length(btrim(discipline)) between 1 and 100),
  add constraint profiles_experience_years_check
    check (experience_years is null or experience_years between 0 and 50);
