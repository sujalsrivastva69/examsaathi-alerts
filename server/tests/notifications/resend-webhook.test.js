import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { createResendWebhookController } from "../../controllers/resend-webhook.controller.js";

const secret = `whsec_${Buffer.from("test-resend-webhook-secret").toString("base64")}`;
const now = 1_792_000_000_000;
const signingKey = Buffer.from(secret.slice("whsec_".length), "base64");
const userId = "2f1c62c1-5ad4-4f89-8b2f-d5eb0e9a8614";

function makeRequest(event, eventId = "evt_test_123") {
  const body = Buffer.from(JSON.stringify(event));
  const timestamp = String(Math.floor(now / 1000));
  const signature = createHmac("sha256", signingKey)
    .update(`${eventId}.${timestamp}.${body.toString("utf8")}`)
    .digest("base64");
  const headers = {
    "svix-id": eventId,
    "svix-timestamp": timestamp,
    "svix-signature": `v1,${signature}`,
  };
  return {
    body,
    get: (name) => headers[name.toLowerCase()],
  };
}

function makeSupabase() {
  const events = [];
  const preferences = [];
  let queueLookups = 0;

  return {
    events,
    preferences,
    get queueLookups() {
      return queueLookups;
    },
    from(table) {
      if (table === "email_provider_events") {
        return {
          upsert: async (record) => {
            events.push(record);
            return { error: null };
          },
        };
      }
      if (table === "notification_queue") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => {
                queueLookups += 1;
                return { data: { user_id: userId }, error: null };
              },
            }),
          }),
        };
      }
      if (table === "notification_preferences") {
        return {
          upsert: async (record) => {
            preferences.push(record);
            return { error: null };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
}

async function sendEvent(event, supabase) {
  const controller = createResendWebhookController({
    supabase,
    webhookSecret: secret,
    now: () => now,
  });
  const req = makeRequest(event);
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let nextError;
  await controller(req, res, (error) => {
    nextError = error;
  });
  if (nextError) throw nextError;
  return res;
}

test("complaints and permanent bounces are stored and suppress future email", async () => {
  const supabase = makeSupabase();
  const events = [
    {
      type: "email.complained",
      data: { email_id: "email_complaint", to: ["candidate@example.com"] },
    },
    {
      type: "email.bounced",
      data: {
        email_id: "email_hard_bounce",
        to: ["candidate@example.com"],
        bounce: { type: "Permanent" },
      },
    },
  ];

  for (const event of events) {
    const response = await sendEvent(event, supabase);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, { received: true });
  }

  assert.deepEqual(
    supabase.events.map(({ event_type }) => event_type),
    ["email.complained", "email.bounced"],
  );
  assert.deepEqual(
    supabase.preferences.map(({ user_id, email_consent, email_enabled }) => ({
      user_id,
      email_consent,
      email_enabled,
    })),
    [
      { user_id: userId, email_consent: false, email_enabled: false },
      { user_id: userId, email_consent: false, email_enabled: false },
    ],
  );
  assert.ok(supabase.preferences.every(({ unsubscribed_at }) => unsubscribed_at));
});

test("transient bounces are recorded but do not unsubscribe the recipient", async () => {
  const supabase = makeSupabase();
  const response = await sendEvent(
    {
      type: "email.bounced",
      data: {
        email_id: "email_soft_bounce",
        to: ["candidate@example.com"],
        bounce: { type: "Transient" },
      },
    },
    supabase,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(supabase.events.length, 1);
  assert.equal(supabase.events[0].event_type, "email.bounced");
  assert.equal(supabase.preferences.length, 0);
  assert.equal(supabase.queueLookups, 0);
});
