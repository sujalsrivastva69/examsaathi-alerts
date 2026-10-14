import { supabaseAuth } from "../config/supabase.js";
import { AppError } from "../utils/app-error.js";

export async function authenticate(req, _res, next) {
  const authorization = req.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return next(new AppError(401, "AUTHENTICATION_REQUIRED", "A valid bearer token is required"));
  }

  try {
    const { data, error } = await supabaseAuth.auth.getUser(match[1]);

    if (error || !data.user) {
      return next(new AppError(401, "INVALID_TOKEN", "The access token is invalid or expired"));
    }

    req.user = { id: data.user.id, email: data.user.email };
    return next();
  } catch (error) {
    return next(error);
  }
}
