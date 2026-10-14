import { supabaseAdmin } from "../../config/supabase.js";
import { notificationIdempotencyKey } from "./idempotency.js";

const reminders = new Set(["deadline_reminder_3d", "deadline_reminder_1d"]);
const pageSize = 500;

async function readAllRows(queryFactory) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await queryFactory().range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

export async function enqueueVacancyNotifications(
  vacancyId,
  notificationType,
  { audienceMatches, rulesVersion } = {},
) {
  const { data: vacancy, error: vacancyError } = await supabaseAdmin
    .from("vacancies")
    .select(
      "id, rules_version, deadline, title, recruiting_organization, official_source_url, pdf_url, last_verified_at, extraction_payload",
    )
    .eq("id", vacancyId)
    .maybeSingle();
  if (vacancyError) throw vacancyError;
  if (!vacancy) throw new Error(`Cannot enqueue notifications: vacancy ${vacancyId} was not found`);

  const version = rulesVersion ?? vacancy.rules_version;
  let matches =
    audienceMatches ??
    (await readAllRows(() =>
      supabaseAdmin
        .from("user_vacancy_matches")
        .select("user_id, status, explanation, rules_version")
        .eq("vacancy_id", vacancyId)
        .in("status", ["preliminary_match", "needs_review"])
        .order("user_id"),
    ));
  if (!audienceMatches) {
    matches = matches.filter((match) => match.rules_version === version);
  }
  if (!matches.length) return { enqueued: 0 };

  const userIds = [...new Set(matches.map((match) => match.user_id))];
  const preferences = [];
  for (let offset = 0; offset < userIds.length; offset += pageSize) {
    const ids = userIds.slice(offset, offset + pageSize);
    preferences.push(
      ...(await readAllRows(() =>
        supabaseAdmin
          .from("notification_preferences")
          .select("user_id, email_enabled, notify_needs_review, language, unsubscribed_at")
          .in("user_id", ids)
          .eq("email_enabled", true)
          .is("unsubscribed_at", null)
          .order("user_id"),
      )),
    );
  }
  const preferenceByUser = new Map(
    preferences.map((preference) => [preference.user_id, preference]),
  );
  const applicationUrl =
    vacancy.extraction_payload?.post?.application_url?.value ||
    vacancy.extraction_payload?.post?.application_url ||
    vacancy.official_source_url;

  const records = [];
  for (const match of matches) {
    const preferencesForUser = preferenceByUser.get(match.user_id);
    if (!preferencesForUser) continue;
    if (match.status === "needs_review" && !preferencesForUser.notify_needs_review) continue;
    if (reminders.has(notificationType)) {
      const { data: action, error: actionError } = await supabaseAdmin
        .from("user_vacancy_actions")
        .select("status")
        .eq("user_id", match.user_id)
        .eq("vacancy_id", vacancyId)
        .maybeSingle();
      if (actionError) throw actionError;
      if (action && ["applied", "not_interested"].includes(action.status)) continue;
    }

    records.push({
      user_id: match.user_id,
      vacancy_id: vacancyId,
      notification_type: notificationType,
      idempotency_key: notificationIdempotencyKey(
        match.user_id,
        vacancyId,
        notificationType,
        version,
      ),
      rules_version: version,
      match_snapshot: {
        status: match.status,
        explanation: match.explanation,
        rules_version: match.rules_version,
        vacancy: {
          title: vacancy.title,
          recruiting_organization: vacancy.recruiting_organization,
          deadline: vacancy.deadline,
          official_source_url: vacancy.official_source_url,
          application_url:
            typeof applicationUrl === "string" ? applicationUrl : vacancy.official_source_url,
          last_verified_at: vacancy.last_verified_at,
        },
        language: preferencesForUser.language,
      },
      status: "pending",
    });
  }

  if (!records.length) return { enqueued: 0 };
  const { data, error } = await supabaseAdmin
    .from("notification_queue")
    .upsert(records, { onConflict: "idempotency_key", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;
  return { enqueued: data.length };
}

export async function getNotificationAudience(vacancyId) {
  return readAllRows(() =>
    supabaseAdmin
      .from("user_vacancy_matches")
      .select("user_id, status, explanation, rules_version")
      .eq("vacancy_id", vacancyId)
      .in("status", ["preliminary_match", "needs_review"])
      .order("user_id"),
  );
}

export async function listFailedNotifications() {
  const { data, error } = await supabaseAdmin
    .from("notification_queue")
    .select(
      "id, user_id, vacancy_id, notification_type, status, attempt_count, last_error, created_at, match_snapshot",
    )
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return { notifications: data };
}

export async function retryFailedNotification(id) {
  const { data, error } = await supabaseAdmin
    .from("notification_queue")
    .update({
      status: "pending",
      attempt_count: 0,
      available_at: new Date().toISOString(),
      locked_at: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "failed")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getReminderVacancies(targetDate) {
  const { data, error } = await supabaseAdmin
    .from("vacancies")
    .select("id, deadline, rules_version")
    .eq("status", "verified_open")
    .eq("verification_status", "verified")
    .eq("deadline", targetDate)
    .is("archived_at", null);
  if (error) throw error;
  return data;
}

export async function getPublishedVacancies() {
  return readAllRows(() =>
    supabaseAdmin
      .from("vacancies")
      .select("id, rules_version, next_notification_type")
      .eq("status", "verified_open")
      .eq("verification_status", "verified")
      .is("archived_at", null)
      .order("id"),
  );
}

export async function flagStaleVacancies() {
  const threshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("vacancies")
    .update({ stale_verification_flag: true, updated_at: new Date().toISOString() })
    .eq("status", "verified_open")
    .eq("verification_status", "verified")
    .lt("last_verified_at", threshold)
    .eq("stale_verification_flag", false)
    .select("id");
  if (error) throw error;
  return { flagged: data.length };
}
