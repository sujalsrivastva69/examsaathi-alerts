import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../utils/app-error.js";
import { vacancyFieldsSchema } from "../utils/vacancy-schema.js";
import { reevaluateMatchesForVacancy } from "./matching/match-persistence.service.js";
import { evaluateVacancy } from "./matching/evaluate-vacancy.js";
import {
  enqueueVacancyNotifications,
  getNotificationAudience,
  listFailedNotifications,
  retryFailedNotification,
} from "./notifications/notification-queue.service.js";

const vacancyFields =
  "id, title, recruiting_organization, official_source_url, pdf_url, application_start_date, deadline, age_cutoff_date, rule_json, status, verification_status, verification_checklist, last_verified_at, archived_at, source_id, source_notice_url, source_quotes, extraction_payload, extraction_confidence, ingestion_status, review_reasons, stale_verification_flag, next_notification_type, created_at, updated_at";
const blankChecklist = { source_checked: false, dates_checked: false, rules_checked: false };

function throwDatabaseError(operation, error) {
  console.error(`Admin vacancy ${operation} failed`, error);
  if (error.code === "22023") {
    throw new AppError(
      409,
      "INVALID_VACANCY_STATE",
      "The vacancy changed or no longer allows this operation",
    );
  }
  if (error.code === "42501") {
    throw new AppError(403, "ADMIN_ACCESS_REQUIRED", "Administrative access is required");
  }
  throw new AppError(
    500,
    "ADMIN_VACANCY_STORAGE_ERROR",
    "Could not complete the vacancy operation",
  );
}

function failState(message) {
  throw new AppError(409, "INVALID_VACANCY_STATE", message);
}

async function refreshMatches(vacancy) {
  await reevaluateMatchesForVacancy(vacancy.id);
  return { vacancy };
}

function validateVacancyForApproval(vacancy) {
  const complete = vacancyFieldsSchema.safeParse({
    title: vacancy.title,
    recruiting_organization: vacancy.recruiting_organization,
    official_source_url: vacancy.official_source_url,
    pdf_url: vacancy.pdf_url,
    application_start_date: vacancy.application_start_date,
    deadline: vacancy.deadline,
    age_cutoff_date: vacancy.age_cutoff_date,
    rule_json: vacancy.rule_json,
    verification_checklist: vacancy.verification_checklist,
  });
  if (!complete.success) throw complete.error;
  const checklist = vacancy.verification_checklist;
  if (!checklist?.source_checked || !checklist.dates_checked || !checklist.rules_checked) {
    failState("Complete all verification checklist items before verification");
  }
}

function dateInIndia(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function rpcVacancy(actorId, id, patch, action) {
  const { data, error } = await supabaseAdmin.rpc("admin_update_vacancy", {
    p_vacancy_id: id,
    p_actor_id: actorId,
    p_patch: patch,
    p_action: action,
  });
  if (error) throwDatabaseError(action, error);
  if (!data) throw new AppError(404, "VACANCY_NOT_FOUND", "Vacancy not found");
  return data;
}

async function readVacancy(id) {
  const { data, error } = await supabaseAdmin
    .from("vacancies")
    .select(vacancyFields)
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throwDatabaseError("read", error);
  if (!data) throw new AppError(404, "VACANCY_NOT_FOUND", "Vacancy not found");
  return data;
}

export async function getAdminVacancies(filters) {
  let query = supabaseAdmin
    .from("vacancies")
    .select(vacancyFields)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.deadline_soon === "true") {
    const today = dateInIndia(new Date());
    const soonDate = new Date(`${today}T00:00:00Z`);
    soonDate.setUTCDate(soonDate.getUTCDate() + 7);
    const soon = soonDate.toISOString().slice(0, 10);
    query = query.gte("deadline", today).lte("deadline", soon).neq("status", "closed");
  }

  const { data, error } = await query.limit(100);
  if (error) throwDatabaseError("list", error);
  return { vacancies: data };
}

export async function getAdminVacancy(id) {
  const vacancy = await readVacancy(id);
  const { data: changes, error } = await supabaseAdmin
    .from("vacancy_changes")
    .select("id, field_name, old_value, new_value, changed_by, changed_at")
    .eq("vacancy_id", id)
    .order("changed_at", { ascending: false })
    .limit(200);
  if (error) throwDatabaseError("history read", error);
  return { vacancy, changes };
}

export async function getAdminReviewQueue() {
  const { data, error } = await supabaseAdmin
    .from("vacancies")
    .select(vacancyFields)
    .eq("status", "awaiting_verification")
    .in("ingestion_status", ["ready_for_review", "needs_review", "needs_manual_entry"])
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throwDatabaseError("review queue read", error);
  return { vacancies: data };
}

export async function createAdminVacancy(actorId, fields) {
  const { data, error } = await supabaseAdmin.rpc("admin_create_vacancy", {
    p_actor_id: actorId,
    p_vacancy: fields,
  });
  if (error) throwDatabaseError("create", error);
  return refreshMatches(data);
}

export async function deleteAdminVacancy(actorId, id) {
  const vacancy = await readVacancy(id);
  if (vacancy.status !== "draft") {
    failState(
      "Only a draft vacancy can be deleted; other statuses must retain their audit history",
    );
  }
  return refreshMatches(
    await rpcVacancy(actorId, id, { archived_at: new Date().toISOString() }, "delete"),
  );
}

export async function updateAdminVacancy(actorId, id, patch) {
  const current = await readVacancy(id);
  if (current.status === "closed") failState("Reopen a closed vacancy before editing it");
  const completeFields = vacancyFieldsSchema.safeParse({
    title: current.title,
    recruiting_organization: current.recruiting_organization,
    official_source_url: current.official_source_url,
    pdf_url: current.pdf_url,
    application_start_date: current.application_start_date,
    deadline: current.deadline,
    age_cutoff_date: current.age_cutoff_date,
    rule_json: current.rule_json,
    verification_checklist: current.verification_checklist,
    ...patch,
  });
  if (!completeFields.success) throw completeFields.error;

  const contentFields = Object.keys(patch).filter((key) => key !== "verification_checklist");
  const checklistChanged =
    Object.hasOwn(patch, "verification_checklist") &&
    JSON.stringify(patch.verification_checklist) !== JSON.stringify(current.verification_checklist);
  const nextPatch = { ...patch };
  if (contentFields.length > 0 || checklistChanged) {
    nextPatch.verification_status = "pending";
    nextPatch.last_verified_at = null;
    if (contentFields.length > 0) nextPatch.verification_checklist = blankChecklist;
    if (current.status === "verified_open") nextPatch.status = "awaiting_verification";
  }
  return refreshMatches(await rpcVacancy(actorId, id, nextPatch, "update"));
}

export async function submitAdminVacancy(actorId, id) {
  const vacancy = await readVacancy(id);
  if (vacancy.status !== "draft")
    failState("Only a draft vacancy can be submitted for verification");
  return refreshMatches(
    await rpcVacancy(actorId, id, { status: "awaiting_verification" }, "submit"),
  );
}

export async function returnAdminVacancyToDraft(actorId, id) {
  const vacancy = await readVacancy(id);
  if (vacancy.status !== "awaiting_verification")
    failState("Only an awaiting-verification vacancy can return to draft");
  return refreshMatches(
    await rpcVacancy(
      actorId,
      id,
      {
        status: "draft",
        verification_status: "pending",
        verification_checklist: blankChecklist,
        last_verified_at: null,
      },
      "return_to_draft",
    ),
  );
}

export async function verifyAdminVacancy(actorId, id) {
  const vacancy = await readVacancy(id);
  if (vacancy.status !== "awaiting_verification")
    failState("Submit the vacancy for verification before verifying it");
  validateVacancyForApproval(vacancy);
  const now = new Date().toISOString();
  return refreshMatches(
    await rpcVacancy(
      actorId,
      id,
      { verification_status: "verified", last_verified_at: now },
      "verify",
    ),
  );
}

export async function publishAdminVacancy(actorId, id) {
  const vacancy = await readVacancy(id);
  if (vacancy.status !== "awaiting_verification")
    failState("Only a vacancy awaiting verification can be published");
  if (
    vacancy.verification_status !== "verified" ||
    !vacancy.last_verified_at ||
    !Object.values(vacancy.verification_checklist ?? {}).every(Boolean)
  ) {
    failState("Verify the source, dates, and eligibility rules before publishing");
  }
  validateVacancyForApproval(vacancy);
  const refreshed = await refreshMatches(
    await rpcVacancy(actorId, id, { status: "verified_open" }, "publish"),
  );
  await enqueueVacancyNotifications(id, refreshed.vacancy.next_notification_type);
  return refreshed;
}

export async function approveAndPublishAdminVacancy(actorId, id) {
  const vacancy = await readVacancy(id);
  if (vacancy.status !== "awaiting_verification")
    failState("Only a vacancy awaiting verification can be approved");
  validateVacancyForApproval(vacancy);
  const { data, error } = await supabaseAdmin.rpc("admin_approve_publish_vacancy", {
    p_vacancy_id: id,
    p_actor_id: actorId,
  });
  if (error) throwDatabaseError("approve and publish", error);
  if (!data) throw new AppError(404, "VACANCY_NOT_FOUND", "Vacancy not found");
  const refreshed = await refreshMatches(data);
  await enqueueVacancyNotifications(id, refreshed.vacancy.next_notification_type);
  return refreshed;
}

export async function rejectIngestedAdminVacancy(actorId, id) {
  const { data, error } = await supabaseAdmin.rpc("admin_reject_ingested_vacancy", {
    p_vacancy_id: id,
    p_actor_id: actorId,
  });
  if (error) throwDatabaseError("reject", error);
  if (!data) throw new AppError(404, "VACANCY_NOT_FOUND", "Vacancy not found");
  return refreshMatches(data);
}

export async function closeAdminVacancy(actorId, id) {
  const vacancy = await readVacancy(id);
  if (vacancy.status !== "verified_open") failState("Only an open verified vacancy can be closed");
  return refreshMatches(await rpcVacancy(actorId, id, { status: "closed" }, "close"));
}

export async function reopenAdminVacancy(actorId, id) {
  const vacancy = await readVacancy(id);
  if (vacancy.status !== "closed")
    failState("Only a closed vacancy can be reopened for verification");
  return refreshMatches(
    await rpcVacancy(
      actorId,
      id,
      {
        status: "awaiting_verification",
        verification_status: "pending",
        verification_checklist: blankChecklist,
        last_verified_at: null,
      },
      "reopen",
    ),
  );
}

export async function extendAdminVacancyDeadline(actorId, id, deadline) {
  const vacancy = await readVacancy(id);
  const audience = await getNotificationAudience(id);
  if (vacancy.status === "closed") failState("A closed vacancy cannot have its deadline extended");
  if (deadline <= vacancy.deadline) {
    throw new AppError(
      400,
      "DEADLINE_NOT_EXTENDED",
      "The new deadline must be later than the current deadline",
    );
  }
  const patch = {
    deadline,
    verification_status: "pending",
    verification_checklist: blankChecklist,
    last_verified_at: null,
  };
  if (vacancy.status === "verified_open") {
    patch.status = "awaiting_verification";
  }
  const refreshed = await refreshMatches(await rpcVacancy(actorId, id, patch, "extend_deadline"));
  await enqueueVacancyNotifications(id, "deadline_extended", {
    audienceMatches: audience,
    rulesVersion: refreshed.vacancy.rules_version,
  });
  return refreshed;
}

export async function getFailedAdminNotifications() {
  return listFailedNotifications();
}

export async function retryAdminNotification(id) {
  const result = await retryFailedNotification(id);
  if (!result) throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Failed notification not found");
  return { notification: result };
}

export async function getPreviewMatches({ age_cutoff_date: cutoffDate, rule_json: rules }) {
  const { data: profiles, error } = await supabaseAdmin
    .from("admin_test_profiles")
    .select("date_of_birth, qualification_level, discipline, category, state, experience_years");
  if (error) throwDatabaseError("preview", error);

  const previewVacancy = {
    age_cutoff_date: cutoffDate,
    deadline: "9999-12-31",
    status: "verified_open",
    verification_status: "verified",
    last_verified_at: new Date().toISOString(),
  };
  const matches = profiles.filter(
    (profile) =>
      evaluateVacancy({ ...profile, education: profile.qualification_level }, previewVacancy, rules)
        .status === "preliminary_match",
  );
  return {
    match_count: matches.length,
    test_profile_count: profiles.length,
    rule_basis: "age calculated on the notice cutoff date",
  };
}
