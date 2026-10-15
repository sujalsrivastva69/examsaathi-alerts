import { supabaseAdmin } from "../../config/supabase.js";
import { env } from "../../config/env.js";
import { createUnsubscribeToken } from "./unsubscribe-token.js";
import { renderVacancyEmail } from "./email-templates.js";
import { shouldSuppressDeadlineReminder } from "./reminder-policy.js";

const reminderTypes = new Set(["deadline_reminder_3d", "deadline_reminder_1d"]);
const maxBatchSize = 25;
const deliveryTimeZone = "Asia/Kolkata";

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

function reminderIsCurrent(item, deadline) {
  if (!reminderTypes.has(item.notification_type) || !deadline) return true;
  const today = new Date(`${dateInIndia(new Date())}T00:00:00Z`);
  const due = new Date(`${deadline.slice(0, 10)}T00:00:00Z`);
  const days = Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  return days === (item.notification_type === "deadline_reminder_3d" ? 3 : 1);
}

function nextDeliveryWindow(frequency, now = new Date()) {
  if (frequency === "immediate") return now;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: deliveryTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const windowDate = new Date(`${values.year}-${values.month}-${values.day}T09:00:00+05:30`);
  const isMonday = values.weekday === "Mon";
  if (frequency === "weekly" && !isMonday) {
    windowDate.setUTCDate(windowDate.getUTCDate() + ((8 - windowDate.getUTCDay()) % 7 || 7));
  } else if (now.getTime() >= windowDate.getTime()) {
    windowDate.setUTCDate(windowDate.getUTCDate() + (frequency === "weekly" ? 7 : 1));
  }
  return windowDate;
}

async function recordLog(item, status, reason = null, providerMessageId = null) {
  const { error } = await supabaseAdmin.from("notification_logs").insert({
    queue_id: item.id,
    user_id: item.user_id,
    vacancy_id: item.vacancy_id,
    notification_type: item.notification_type,
    attempt: item.attempt_count,
    status,
    provider_message_id: providerMessageId,
    reason,
  });
  if (error) throw error;
}

async function updateQueue(item, patch) {
  const { error } = await supabaseAdmin
    .from("notification_queue")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", item.id);
  if (error) throw error;
}

async function suppress(item, reason) {
  await updateQueue(item, {
    status: "suppressed",
    locked_at: null,
    last_error: reason,
  });
  await recordLog(item, "suppressed", reason);
}

async function defer(item, reason) {
  const delay = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  await updateQueue(item, {
    status: "pending",
    attempt_count: Math.max(item.attempt_count - 1, 0),
    available_at: delay,
    locked_at: null,
    last_error: reason,
  });
}

async function getCurrentPreferences(userId) {
  const { data, error } = await supabaseAdmin
    .from("notification_preferences")
    .select("email_enabled, unsubscribed_at, language, email_frequency, deadline_reminders_enabled")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function shouldSuppressForAction(item) {
  if (!reminderTypes.has(item.notification_type)) return false;
  const { data, error } = await supabaseAdmin
    .from("user_vacancy_actions")
    .select("status")
    .eq("user_id", item.user_id)
    .eq("vacancy_id", item.vacancy_id)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data && shouldSuppressDeadlineReminder(data.status));
}

async function getVacancy(item) {
  const { data, error } = await supabaseAdmin
    .from("vacancies")
    .select(
      "title, recruiting_organization, deadline, official_source_url, last_verified_at, status, verification_status, archived_at, extraction_payload",
    )
    .eq("id", item.vacancy_id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function applicationUrl(vacancy, snapshot) {
  const extracted = vacancy.extraction_payload?.post?.application_url;
  const value =
    (typeof extracted === "object" ? extracted?.value : extracted) ||
    snapshot.application_url ||
    vacancy.official_source_url;
  if (typeof value !== "string") return vacancy.official_source_url;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : vacancy.official_source_url;
  } catch {
    return vacancy.official_source_url;
  }
}

async function sendViaResend(email, message, idempotencyKey) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
      "List-Unsubscribe": `<${message.unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    body: JSON.stringify({
      from: `ExamSaathi Alerts <${env.RESEND_FROM_EMAIL}>`,
      to: [email],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (!response.ok) {
    throw new Error(`Resend rejected the request with HTTP ${response.status}`);
  }
  if (typeof payload.id !== "string") {
    throw new Error("Resend response did not include a provider message ID");
  }
  return payload.id;
}

async function handleFailure(item, error) {
  const reason = error instanceof Error ? error.message.slice(0, 1000) : "Unknown delivery failure";
  const permanent = item.attempt_count >= 3;
  const delaySeconds = 30 * 2 ** (item.attempt_count - 1);
  await updateQueue(item, {
    status: permanent ? "failed" : "pending",
    available_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
    locked_at: null,
    last_error: reason,
  });
  await recordLog(item, permanent ? "failed" : "retrying", reason);
}

async function processItem(item) {
  try {
    const preferences = await getCurrentPreferences(item.user_id);
    if (!preferences?.email_enabled || preferences.unsubscribed_at) {
      await suppress(item, "Email alerts are disabled or the user unsubscribed.");
      return;
    }
    if (reminderTypes.has(item.notification_type) && !preferences.deadline_reminders_enabled) {
      await suppress(item, "Deadline reminders are disabled in notification settings.");
      return;
    }
    const deliveryWindow = reminderTypes.has(item.notification_type)
      ? new Date()
      : nextDeliveryWindow(preferences.email_frequency ?? "immediate");
    if (deliveryWindow.getTime() > Date.now()) {
      await updateQueue(item, {
        status: "pending",
        attempt_count: Math.max(item.attempt_count - 1, 0),
        available_at: deliveryWindow.toISOString(),
        locked_at: null,
        last_error: null,
      });
      return;
    }
    if (await shouldSuppressForAction(item)) {
      await suppress(item, "User marked this vacancy Applied or Not interested.");
      return;
    }

    const vacancy = await getVacancy(item);
    if (!vacancy) {
      await suppress(item, "Vacancy no longer exists.");
      return;
    }
    if (vacancy.status !== "verified_open" || vacancy.verification_status !== "verified") {
      if (vacancy.status === "closed" || vacancy.archived_at) {
        await suppress(item, "Vacancy is closed or archived.");
        return;
      }
      await defer(item, "Vacancy is not currently verified and open.");
      return;
    }
    if (vacancy.deadline && vacancy.deadline.slice(0, 10) < dateInIndia(new Date())) {
      await suppress(item, "Vacancy deadline passed before this notification could be delivered.");
      return;
    }
    if (!reminderIsCurrent(item, vacancy.deadline)) {
      await suppress(item, "Reminder is no longer due because the vacancy deadline changed.");
      return;
    }

    const { data: authResult, error: authError } = await supabaseAdmin.auth.admin.getUserById(
      item.user_id,
    );
    if (authError) throw authError;
    const email = authResult.user?.email;
    if (!email) throw new Error("Recipient account has no email address");

    const tokenSecret = env.UNSUBSCRIBE_TOKEN_SECRET ?? env.SUPABASE_SERVICE_ROLE_KEY;
    const token = createUnsubscribeToken(item.user_id, tokenSecret);
    const unsubscribeUrl = new URL(`/api/unsubscribe/${token}`, env.API_URL ?? env.APP_URL).href;
    const snapshot = item.match_snapshot?.vacancy ?? {};
    const message = renderVacancyEmail({
      notificationType: item.notification_type,
      language: preferences.language ?? item.match_snapshot?.language ?? "en",
      vacancy: {
        ...snapshot,
        ...vacancy,
        application_url: applicationUrl(vacancy, snapshot),
      },
      match: {
        status: item.match_snapshot?.status ?? "needs_review",
        explanation: item.match_snapshot?.explanation ?? {},
      },
      unsubscribeUrl,
    });

    const latestPreferences = await getCurrentPreferences(item.user_id);
    if (!latestPreferences?.email_enabled || latestPreferences.unsubscribed_at) {
      await suppress(item, "Email alerts were disabled or unsubscribed before delivery.");
      return;
    }
    if (await shouldSuppressForAction(item)) {
      await suppress(item, "User marked this vacancy Applied or Not interested before delivery.");
      return;
    }

    if (env.NOTIFICATION_DRY_RUN) {
      console.info(
        JSON.stringify({
          event: "notification_dry_run",
          queue_id: item.id,
          to: email,
          type: item.notification_type,
          subject: message.subject,
          text: message.text,
        }),
      );
      await updateQueue(item, { status: "dry_run", locked_at: null, last_error: null });
      await recordLog(item, "dry_run", "NOTIFICATION_DRY_RUN is enabled");
      return;
    }

    const providerMessageId = await sendViaResend(email, message, item.idempotency_key);
    await updateQueue(item, {
      status: "sent",
      locked_at: null,
      provider_message_id: providerMessageId,
      last_error: null,
    });
    await recordLog(item, "sent", null, providerMessageId);
  } catch (error) {
    console.error(`Notification delivery failed for queue item ${item.id}`, error);
    await handleFailure(item, error);
  }
}

export async function processNotificationBatch() {
  const { data: items, error } = await supabaseAdmin.rpc("claim_notification_batch", {
    p_limit: maxBatchSize,
  });
  if (error) throw error;
  for (const item of items) await processItem(item);
  return { processed: items.length };
}
