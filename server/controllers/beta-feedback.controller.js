import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../utils/app-error.js";

export async function submitBetaFeedback(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from("beta_feedback")
      .insert({
        user_id: req.user.id,
        ...req.validated.body,
      })
      .select("id, feedback_type, created_at")
      .single();
    if (error) {
      console.error("Could not store beta feedback", error);
      throw new AppError(500, "FEEDBACK_STORAGE_ERROR", "Could not store your feedback");
    }
    return res.status(201).json({ feedback: data });
  } catch (error) {
    return next(error);
  }
}
