import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "../config/supabase.js";
import { env } from "../config/env.js";

const eventSchema = z.object({
  type: z.string().min(1).max(100),
  created_at: z.string().datetime().optional(),
  data: z
    .object({
      email_id: z.string().min(1).max(200),
      to: z.array(z.string().email()).optional(),
    })
    .passthrough(),
});

function validSignature(req, rawBody) {
  const secret = env.RESEND_WEBHOOK_SECRET;
  const messageId = req.get("svix-id");
  const timestamp = req.get("svix-timestamp");
  const signatures = req.get("svix-signature");
  if (!secret || !messageId || !timestamp || !signatures) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isInteger(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) {
    return false;
  }

  const signingSecret = Buffer.from(secret.slice("whsec_".length), "base64");
  const expected = createHmac("sha256", signingSecret)
    .update(`${messageId}.${timestamp}.${rawBody.toString("utf8")}`)
    .digest("base64");
  return signatures
    .split(" ")
    .filter((value) => value.startsWith("v1,"))
    .some((value) => {
      const supplied = Buffer.from(value.slice(3));
      const expectedBuffer = Buffer.from(expected);
      return supplied.length === expectedBuffer.length && timingSafeEqual(supplied, expectedBuffer);
    });
}

export async function receiveResendWebhook(req, res, next) {
  try {
    if (!Buffer.isBuffer(req.body) || !validSignature(req, req.body)) {
      return res.status(401).json({ error: { code: "INVALID_WEBHOOK_SIGNATURE" } });
    }
    let raw;
    try {
      raw = JSON.parse(req.body.toString("utf8"));
    } catch {
      return res.status(400).json({ error: { code: "INVALID_WEBHOOK_JSON" } });
    }
    const parsed = eventSchema.safeParse(raw);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: "INVALID_WEBHOOK_EVENT" } });
    }
    if (!["email.delivered", "email.bounced"].includes(parsed.data.type)) {
      return res.status(200).json({ received: true, ignored: true });
    }

    const { error } = await supabaseAdmin.from("email_provider_events").upsert(
      {
        event_id: req.get("svix-id"),
        message_id: parsed.data.data.email_id,
        event_type: parsed.data.type,
        occurred_at: parsed.data.created_at ?? new Date().toISOString(),
        payload: { email_id: parsed.data.data.email_id },
      },
      { onConflict: "event_id", ignoreDuplicates: true },
    );
    if (error) throw error;
    return res.status(200).json({ received: true });
  } catch (error) {
    return next(error);
  }
}
