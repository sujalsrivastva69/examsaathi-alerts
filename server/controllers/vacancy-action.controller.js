import { supabaseAdmin } from "../config/supabase.js";

export async function saveVacancyAction(req, res, next) {
  try {
    const { error } = await supabaseAdmin.from("user_vacancy_actions").upsert(
      {
        user_id: req.user.id,
        vacancy_id: req.validated.params.id,
        status: req.validated.body.status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,vacancy_id" },
    );
    if (error) throw error;
    return res.status(200).json({ status: req.validated.body.status });
  } catch (error) {
    return next(error);
  }
}
