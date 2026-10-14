import { env } from "../../config/env.js";
import { supabaseAdmin } from "../../config/supabase.js";
import { verifyUnsubscribeToken } from "./unsubscribe-token.js";

export async function unsubscribeWithToken(token) {
  const secret = env.UNSUBSCRIBE_TOKEN_SECRET ?? env.SUPABASE_SERVICE_ROLE_KEY;
  const verified = verifyUnsubscribeToken(token, secret);
  if (!verified) return false;

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("notification_preferences").upsert(
    {
      user_id: verified.userId,
      email_consent: false,
      email_enabled: false,
      unsubscribed_at: now,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );
  if (error?.code === "23503") return false;
  if (error) throw error;
  return true;
}
