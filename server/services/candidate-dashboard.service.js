import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../utils/app-error.js";

const matchStatuses = ["preliminary_match", "needs_review"];
const vacancyColumns =
  "id, title, recruiting_organization, official_source_url, pdf_url, application_start_date, deadline, age_cutoff_date, rule_json, status, verification_status, last_verified_at, extraction_payload";

function getApplicationUrl(vacancy) {
  const extracted = vacancy.extraction_payload?.post?.application_url;
  const value = typeof extracted === "object" ? extracted?.value : extracted;
  if (typeof value !== "string") return vacancy.official_source_url;
  try {
    return new URL(value).protocol === "https:" ? new URL(value).href : vacancy.official_source_url;
  } catch {
    return vacancy.official_source_url;
  }
}

function extractedValue(vacancy, fieldName) {
  const field = vacancy.extraction_payload?.post?.[fieldName];
  const value = typeof field === "object" ? field?.value : field;
  return typeof value === "string" ? value : null;
}

function withApplicationUrl(vacancy) {
  const publicVacancy = { ...vacancy };
  delete publicVacancy.extraction_payload;
  return {
    ...publicVacancy,
    application_url: getApplicationUrl(vacancy),
    location_state: extractedValue(vacancy, "location_state"),
    sectors:
      vacancy.rule_json?.allowed_disciplines?.length > 0
        ? vacancy.rule_json.allowed_disciplines
        : (vacancy.extraction_payload?.post?.allowed_disciplines?.value ?? []),
  };
}

function throwStorageError(message, error) {
  console.error(message, error);
  throw new AppError(500, "CANDIDATE_DATA_ERROR", message);
}

export async function listCandidateMatches(userId) {
  const { data: matches, error: matchError } = await supabaseAdmin
    .from("user_vacancy_matches")
    .select("vacancy_id, status, explanation, missing, failed, rules_version, evaluated_at")
    .eq("user_id", userId)
    .in("status", matchStatuses)
    .order("evaluated_at", { ascending: false })
    .limit(500);
  if (matchError) throwStorageError("Could not load candidate matches", matchError);
  if (!matches.length) return { matches: [] };

  const { data: vacancies, error: vacancyError } = await supabaseAdmin
    .from("vacancies")
    .select(vacancyColumns)
    .in(
      "id",
      matches.map(({ vacancy_id }) => vacancy_id),
    )
    .eq("status", "verified_open")
    .is("archived_at", null);
  if (vacancyError) throwStorageError("Could not load matched vacancies", vacancyError);

  const vacancyById = new Map(vacancies.map((vacancy) => [vacancy.id, vacancy]));
  const visibleMatches = matches.flatMap((match) => {
    const vacancy = vacancyById.get(match.vacancy_id);
    return vacancy ? [{ ...match, vacancy: withApplicationUrl(vacancy) }] : [];
  });

  const { data: actions, error: actionError } = await supabaseAdmin
    .from("user_vacancy_actions")
    .select("vacancy_id, status, updated_at")
    .eq("user_id", userId)
    .in(
      "vacancy_id",
      visibleMatches.map(({ vacancy_id }) => vacancy_id),
    );
  if (actionError) throwStorageError("Could not load application tracker statuses", actionError);
  const actionByVacancy = new Map(actions.map((action) => [action.vacancy_id, action]));

  return {
    matches: visibleMatches.map((match) => ({
      ...match,
      action: actionByVacancy.get(match.vacancy_id) ?? null,
    })),
  };
}

export async function getCandidateMatch(userId, vacancyId) {
  const { data: match, error: matchError } = await supabaseAdmin
    .from("user_vacancy_matches")
    .select("vacancy_id, status, explanation, missing, failed, rules_version, evaluated_at")
    .eq("user_id", userId)
    .eq("vacancy_id", vacancyId)
    .in("status", matchStatuses)
    .maybeSingle();
  if (matchError) throwStorageError("Could not load candidate match", matchError);
  if (!match) throw new AppError(404, "MATCH_NOT_FOUND", "This match is not available");

  const { data: vacancy, error: vacancyError } = await supabaseAdmin
    .from("vacancies")
    .select(vacancyColumns)
    .eq("id", vacancyId)
    .eq("status", "verified_open")
    .is("archived_at", null)
    .maybeSingle();
  if (vacancyError) throwStorageError("Could not load vacancy details", vacancyError);
  if (!vacancy) throw new AppError(404, "VACANCY_NOT_FOUND", "This vacancy is not available");

  const [changeResult, actionResult, historyResult] = await Promise.all([
    supabaseAdmin
      .from("vacancy_changes")
      .select("id, field_name, old_value, new_value, changed_at")
      .eq("vacancy_id", vacancyId)
      .order("changed_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("user_vacancy_actions")
      .select("status, updated_at")
      .eq("user_id", userId)
      .eq("vacancy_id", vacancyId)
      .maybeSingle(),
    supabaseAdmin
      .from("user_vacancy_action_history")
      .select("id, previous_status, status, changed_at")
      .eq("user_id", userId)
      .eq("vacancy_id", vacancyId)
      .order("changed_at", { ascending: false })
      .limit(100),
  ]);
  if (changeResult.error)
    throwStorageError("Could not load vacancy correction history", changeResult.error);
  if (actionResult.error)
    throwStorageError("Could not load application tracker status", actionResult.error);
  if (historyResult.error)
    throwStorageError("Could not load application tracker history", historyResult.error);

  return {
    match: { ...match, vacancy: withApplicationUrl(vacancy) },
    changes: changeResult.data,
    action: actionResult.data,
    actionHistory: historyResult.data,
  };
}

export async function updateCandidateVacancyAction(userId, vacancyId, status) {
  const { data: match, error: matchError } = await supabaseAdmin
    .from("user_vacancy_matches")
    .select("vacancy_id")
    .eq("user_id", userId)
    .eq("vacancy_id", vacancyId)
    .in("status", matchStatuses)
    .maybeSingle();
  if (matchError) throwStorageError("Could not verify candidate vacancy match", matchError);
  if (!match) throw new AppError(404, "MATCH_NOT_FOUND", "This match is not available");

  const { data, error } = await supabaseAdmin.rpc("set_user_vacancy_action", {
    p_user_id: userId,
    p_vacancy_id: vacancyId,
    p_status: status,
  });
  if (error) throwStorageError("Could not update application tracker status", error);
  return { action: data };
}
