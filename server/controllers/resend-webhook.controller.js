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
      bounce: z
        .object({
          type: z.string().optional(),
        })
        .optional(),
      bounce_type: z.string().optional(),
    })
    .passthrough(),
});

function validSignature(req, rawBody, secret, now) {
  const messageId = req.get("svix-id");
  const timestamp = req.get("svix-timestamp");
  const signatures = req.get("svix-signature");
  if (!secret || !messageId || !timestamp || !signatures) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isInteger(timestampSeconds) || Math.abs(now() / 1000 - timestampSeconds) > 300) {
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

export function createResendWebhookController({
  supabase = supabaseAdmin,
  webhookSecret = env.RESEND_WEBHOOK_SECRET,
  now = Date.now,
} = {}) {
  return async function receiveResendWebhook(req, res, next) {
    try {
      if (!Buffer.isBuffer(req.body) || !validSignature(req, req.body, webhookSecret, now)) {
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
      const event = parsed.data;
      if (!["email.delivered", "email.bounced", "email.complained"].includes(event.type)) {
        return res.status(200).json({ received: true, ignored: true });
      }
      const bounceType = event.data.bounce?.type ?? event.data.bounce_type;
      const isHardBounce =
        event.type === "email.bounced" && /^(hard|permanent)$/i.test(bounceType ?? "");

      const { error } = await supabase.from("email_provider_events").upsert(
        {
          event_id: req.get("svix-id"),
          message_id: event.data.email_id,
          event_type: event.type,
          occurred_at: event.created_at ?? new Date(now()).toISOString(),
          payload: {
            email_id: event.data.email_id,
            ...(bounceType ? { bounce_type: bounceType } : {}),
          },
        },
        { onConflict: "event_id", ignoreDuplicates: true },
      );
      if (error) throw error;

      if (event.type === "email.complained" || isHardBounce) {
        const { data: queueItem, error: queueError } = await supabase
          .from("notification_queue")
          .select("user_id")
          .eq("provider_message_id", event.data.email_id)
          .maybeSingle();
        if (queueError) throw queueError;
        if (queueItem) {
          const suppressedAt = new Date(now()).toISOString();
          const { error: preferenceError } = await supabase.from("notification_preferences").upsert(
            {
              user_id: queueItem.user_id,
              email_consent: false,
              email_enabled: false,
              unsubscribed_at: suppressedAt,
              updated_at: suppressedAt,
            },
            { onConflict: "user_id" },
          );
          if (preferenceError) throw preferenceError;
        }
      }

      return res.status(200).json({ received: true });
    } catch (error) {
      return next(error);
    }
  };
}

export const receiveResendWebhook = createResendWebhookController();
