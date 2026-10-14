import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../utils/app-error.js";

export async function deleteAccount(req, res, next) {
  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(req.user.id);

    if (error) {
      console.error("Account deletion failed", error);
      throw new AppError(500, "ACCOUNT_DELETION_FAILED", "Could not delete the account");
    }

    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
}
