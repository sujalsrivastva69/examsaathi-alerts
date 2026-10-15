import { supabaseAdmin } from "../../config/supabase.js";
import { env } from "../../config/env.js";
import { evaluateVacancy } from "./evaluate-vacancy.js";

const pageSize = 500;
const matchColumns = env.PROFILE_MATCHING_FIELDS_ENABLED
  ? "user_id, education, date_of_birth, state, job_preferences, category, discipline, experience_years"
  : "user_id, education, date_of_birth, state, job_preferences";
const vacancyColumns =
  "id, rules_version, rule_json, age_cutoff_date, deadline, status, verification_status, last_verified_at";

async function readAllRows(queryFactory) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await queryFactory().range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

async function saveEvaluations(evaluations) {
  for (let offset = 0; offset < evaluations.length; offset += pageSize) {
    const { error } = await supabaseAdmin
      .from("user_vacancy_matches")
      .upsert(evaluations.slice(offset, offset + pageSize), {
        onConflict: "user_id,vacancy_id",
      });
    if (error) throw error;
  }
  return evaluations.length;
}

function makeMatch(userId, candidate, vacancy) {
  const result = evaluateVacancy(candidate, vacancy, vacancy.rule_json);
  return {
    user_id: userId,
    vacancy_id: vacancy.id,
    status: result.status,
    explanation: result.explanation,
    missing: result.missing,
    failed: result.failed,
    rules_version: result.rulesVersion,
    evaluated_at: new Date().toISOString(),
  };
}

export async function reevaluateMatchesForUser(userId) {
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select(matchColumns)
    .eq("user_id", userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error(`Cannot reevaluate matches: profile ${userId} was not found`);

  const vacancies = await readAllRows(() =>
    supabaseAdmin.from("vacancies").select(vacancyColumns).is("archived_at", null).order("id"),
  );
  const matches = vacancies.map((vacancy) => makeMatch(userId, profile, vacancy));
  return { evaluated: await saveEvaluations(matches) };
}

export async function reevaluateMatchesForVacancy(vacancyId) {
  const { data: vacancy, error: vacancyError } = await supabaseAdmin
    .from("vacancies")
    .select(vacancyColumns)
    .eq("id", vacancyId)
    .maybeSingle();
  if (vacancyError) throw vacancyError;
  if (!vacancy) throw new Error(`Cannot reevaluate matches: vacancy ${vacancyId} was not found`);

  const profiles = await readAllRows(() =>
    supabaseAdmin.from("profiles").select(matchColumns).order("user_id"),
  );
  const matches = profiles.map((profile) => makeMatch(profile.user_id, profile, vacancy));
  return { evaluated: await saveEvaluations(matches) };
}
