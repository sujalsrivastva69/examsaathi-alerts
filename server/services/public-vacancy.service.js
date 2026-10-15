import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../utils/app-error.js";

const columns =
  "id, title, recruiting_organization, official_source_url, pdf_url, application_start_date, deadline, age_cutoff_date, rule_json, last_verified_at, extraction_payload";

function getTodayInIndia() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function safeApplicationUrl(vacancy) {
  const field = vacancy.extraction_payload?.post?.application_url;
  const candidateUrl = typeof field === "object" ? field?.value : field;
  if (typeof candidateUrl === "string") {
    try {
      if (new URL(candidateUrl).protocol === "https:") return new URL(candidateUrl).href;
    } catch {
      // Fall back to the verified official notice URL.
    }
  }
  return vacancy.official_source_url;
}

function publicVacancy(vacancy) {
  const locationField = vacancy.extraction_payload?.post?.location_state;
  const location = typeof locationField === "object" ? locationField?.value : locationField;
  const rules = vacancy.rule_json ?? {};
  return {
    id: vacancy.id,
    title: vacancy.title,
    recruiting_organization: vacancy.recruiting_organization,
    official_source_url: vacancy.official_source_url,
    pdf_url: vacancy.pdf_url,
    application_url: safeApplicationUrl(vacancy),
    application_start_date: vacancy.application_start_date,
    deadline: vacancy.deadline,
    age_cutoff_date: vacancy.age_cutoff_date,
    last_verified_at: vacancy.last_verified_at,
    qualification_level: vacancy.rule_json?.qualification_level ?? null,
    allowed_disciplines: vacancy.rule_json?.allowed_disciplines ?? [],
    location_state: typeof location === "string" ? location : null,
    eligibility: {
      min_age: Number.isInteger(rules.min_age) ? rules.min_age : null,
      max_age: Number.isInteger(rules.max_age) ? rules.max_age : null,
      age_relaxations: rules.age_relaxations ?? null,
      domicile_states: Array.isArray(rules.domicile_states) ? rules.domicile_states : [],
      min_experience_years: Number.isInteger(rules.min_experience_years)
        ? rules.min_experience_years
        : null,
    },
  };
}

function visibleVacancyQuery(id) {
  return supabaseAdmin
    .from("vacancies")
    .select(columns)
    .eq("id", id)
    .eq("status", "verified_open")
    .eq("verification_status", "verified")
    .not("last_verified_at", "is", null)
    .gte("deadline", getTodayInIndia())
    .is("archived_at", null);
}

export async function listPublicVacancies() {
  const { data, error } = await supabaseAdmin
    .from("vacancies")
    .select(columns)
    .eq("status", "verified_open")
    .eq("verification_status", "verified")
    .not("last_verified_at", "is", null)
    .gte("deadline", getTodayInIndia())
    .is("archived_at", null)
    .order("deadline", { ascending: true })
    .limit(500);

  if (error) {
    console.error("Could not load public vacancies", error);
    throw new AppError(500, "PUBLIC_VACANCIES_ERROR", "Could not load vacancy listings");
  }

  return { vacancies: data.map(publicVacancy) };
}

export async function getPublicVacancy(id) {
  const { data, error } = await visibleVacancyQuery(id).maybeSingle();
  if (error) {
    console.error("Could not load public vacancy details", error);
    throw new AppError(500, "PUBLIC_VACANCY_ERROR", "Could not load vacancy details");
  }
  if (!data) throw new AppError(404, "PUBLIC_VACANCY_NOT_FOUND", "Vacancy is not available");
  return { vacancy: publicVacancy(data) };
}
