import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../utils/app-error.js";

const defaultPreferences = {
  email_consent: false,
  email_enabled: false,
  notify_needs_review: false,
  language: "en",
  email_frequency: "immediate",
  deadline_reminders_enabled: true,
  unsubscribed_at: null,
  sms_consent: false,
};

function throwDatabaseError(error) {
  console.error("Notification preference storage operation failed", error);
  throw new AppError(500, "PREFERENCES_STORAGE_ERROR", "Could not access notification preferences");
}

export async function getNotificationPreferences(userId) {
  const { data, error } = await supabaseAdmin
    .from("notification_preferences")
    .select(
      "email_consent, email_enabled, notify_needs_review, language, unsubscribed_at, sms_consent, email_frequency, deadline_reminders_enabled",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throwDatabaseError(error);
  return data ?? defaultPreferences;
}

export async function updateNotificationPreferences(userId, patch) {
  const current = await getNotificationPreferences(userId);
  const emailConsent = patch.email_consent ?? patch.email_enabled ?? current.email_consent;
  const preferences = {
    ...current,
    ...patch,
    email_consent: emailConsent,
    email_enabled: emailConsent,
    unsubscribed_at: emailConsent ? null : (current.unsubscribed_at ?? null),
    sms_consent: false,
  };

  const { data, error } = await supabaseAdmin
    .from("notification_preferences")
    .upsert({ user_id: userId, ...preferences }, { onConflict: "user_id" })
    .select(
      "email_consent, email_enabled, notify_needs_review, language, unsubscribed_at, sms_consent, email_frequency, deadline_reminders_enabled",
    )
    .single();

  if (error) throwDatabaseError(error);
  return data;
}
