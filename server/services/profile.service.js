import { supabaseAdmin } from "../config/supabase.js";
import { env } from "../config/env.js";
import { profileSchema } from "../utils/profile-schema.js";
import { AppError } from "../utils/app-error.js";
import { reevaluateMatchesForUser } from "./matching/match-persistence.service.js";

const baseProfileColumns = "education, date_of_birth, state, job_preferences";
const matchingProfileColumns = "category, discipline, experience_years";

function throwDatabaseError(error) {
  console.error("Profile storage operation failed", error);
  throw new AppError(500, "PROFILE_STORAGE_ERROR", "Could not access profile data");
}

export async function getProfile(userId) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(
      env.PROFILE_MATCHING_FIELDS_ENABLED
        ? `${baseProfileColumns}, ${matchingProfileColumns}`
        : baseProfileColumns,
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throwDatabaseError(error);
  return data;
}

export async function updateProfile(userId, patch) {
  const hasMatchingFields = ["category", "discipline", "experience_years"].some((field) =>
    Object.hasOwn(patch, field),
  );
  if (!env.PROFILE_MATCHING_FIELDS_ENABLED && hasMatchingFields) {
    throw new AppError(
      409,
      "PROFILE_MIGRATION_REQUIRED",
      "Optional matching profile fields are not enabled for this database",
    );
  }

  const current = await getProfile(userId);
  const profile = profileSchema.safeParse({ ...current, ...patch });

  if (!profile.success) {
    throw new AppError(400, "PROFILE_INCOMPLETE", "Complete all profile fields before saving");
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .upsert({ user_id: userId, ...profile.data }, { onConflict: "user_id" })
    .select(
      env.PROFILE_MATCHING_FIELDS_ENABLED
        ? `${baseProfileColumns}, ${matchingProfileColumns}`
        : baseProfileColumns,
    )
    .single();

  if (error) throwDatabaseError(error);
  await reevaluateMatchesForUser(userId);
  return data;
}
