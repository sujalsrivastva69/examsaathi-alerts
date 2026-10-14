import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../utils/app-error.js";

export async function requireAdmin(req, _res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", req.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (error) {
      console.error("Could not verify administrative role", error);
      return next(
        new AppError(500, "ADMIN_ROLE_CHECK_FAILED", "Could not verify administrative access"),
      );
    }

    if (!data) {
      return next(new AppError(403, "ADMIN_ACCESS_REQUIRED", "Administrative access is required"));
    }

    return next();
  } catch (error) {
    return next(error);
  }
}
