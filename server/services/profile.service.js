import { supabaseAdmin } from "../config/supabase.js";
import { profileSchema } from "../utils/profile-schema.js";
import { AppError } from "../utils/app-error.js";
import { reevaluateMatchesForUser } from "./matching/match-persistence.service.js";

function throwDatabaseError(error) {
  console.error("Profile storage operation failed", error);
  throw new AppError(500, "PROFILE_STORAGE_ERROR", "Could not access profile data");
}

export async function getProfile(userId) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("education, date_of_birth, state, job_preferences")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throwDatabaseError(error);
  await reevaluateMatchesForUser(userId);
  return data;
}

export async function updateProfile(userId, patch) {
  const current = await getProfile(userId);
  const profile = profileSchema.safeParse({ ...current, ...patch });

  if (!profile.success) {
    throw new AppError(400, "PROFILE_INCOMPLETE", "Complete all profile fields before saving");
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .upsert({ user_id: userId, ...profile.data }, { onConflict: "user_id" })
    .select("education, date_of_birth, state, job_preferences")
    .single();

  if (error) throwDatabaseError(error);
  return data;
}
