import assert from "node:assert/strict";
import test from "node:test";
import { renderVacancyEmail } from "../../services/notifications/email-templates.js";
import { notificationIdempotencyKey } from "../../services/notifications/idempotency.js";
import { shouldSuppressDeadlineReminder } from "../../services/notifications/reminder-policy.js";
import {
  createUnsubscribeToken,
  resolveUnsubscribeSecret,
  verifyUnsubscribeToken,
} from "../../services/notifications/unsubscribe-token.js";
import {
  drainNotificationBatches,
  nextDeliveryWindow,
  sendViaResend,
} from "../../services/notifications/worker.js";

const secret = "test-only-notification-signing-key-with-32-bytes";
const userId = "2f1c62c1-5ad4-4f89-8b2f-d5eb0e9a8614";
const types = [
  "new_vacancy",
  "deadline_reminder_3d",
  "deadline_reminder_1d",
  "deadline_extended",
  "important_correction",
];

const shared = {
  vacancy: {
    title: "Junior Engineer",
    recruiting_organization: "Public Works Department",
    deadline: "2026-12-31",
    official_source_url: "https://jobs.gov.in/notice/1",
    application_url: "https://jobs.gov.in/apply/1",
    last_verified_at: "2026-10-14T12:00:00.000Z",
  },
  match: {
    status: "preliminary_match",
    explanation: {
      qualification: {
        status: "matched",
        reason: {
          en: "Your education meets the stated level.",
          hi: "आपकी शिक्षा बताई गई योग्यता से मेल खाती है।",
        },
      },
    },
  },
  unsubscribeUrl: "https://examsaathi.example/api/unsubscribe/signed-token",
};

for (const language of ["en", "hi"]) {
  for (const notificationType of types) {
    test(`${language} ${notificationType} email includes all required content`, () => {
      const email = renderVacancyEmail({
        ...shared,
        language,
        notificationType,
      });
      const requiredContent =
        language === "en"
          ? [
              "Junior Engineer",
              "Public Works Department",
              "31",
              "Deadline",
              "Why it matched",
              "Official notification",
              "Application link",
              "Last verified",
              "unsubscribe",
              "official notice is final",
            ]
          : [
              "Junior Engineer",
              "Public Works Department",
              "अंतिम तारीख",
              "मेल का कारण",
              "आधिकारिक सूचना",
              "आवेदन लिंक",
              "अंतिम सत्यापन",
              "ईमेल अलर्ट बंद करें",
              "आधिकारिक सूचना ही अंतिम है",
            ];
      for (const value of requiredContent) {
        assert.ok(
          `${email.html}\n${email.text}`.toLowerCase().includes(value.toLowerCase()),
          value,
        );
      }
      assert.match(email.html, /https:\/\/jobs\.gov\.in\/notice\/1/);
      assert.match(email.html, /https:\/\/jobs\.gov\.in\/apply\/1/);
      assert.match(email.html, /signed-token/);
      assert.ok(email.text.includes("2026"));
    });
  }
}

test("HTML escapes untrusted notice text", () => {
  const email = renderVacancyEmail({
    ...shared,
    notificationType: "new_vacancy",
    language: "en",
    vacancy: { ...shared.vacancy, title: "<script>alert(1)</script>" },
  });

  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.html, /&lt;script&gt;/);
});

test("submitted and not-interested applications suppress deadline reminders", () => {
  assert.equal(shouldSuppressDeadlineReminder("submitted"), true);
  assert.equal(shouldSuppressDeadlineReminder("applied"), true);
  assert.equal(shouldSuppressDeadlineReminder("not_interested"), true);
  assert.equal(shouldSuppressDeadlineReminder("application_started"), false);
  assert.equal(shouldSuppressDeadlineReminder("interested"), false);
});

test("non-HTTPS application links fall back to the HTTPS official notice", () => {
  const email = renderVacancyEmail({
    ...shared,
    notificationType: "new_vacancy",
    language: "en",
    vacancy: { ...shared.vacancy, application_url: "javascript:alert(1)" },
  });
  assert.doesNotMatch(email.html, /href="javascript:/);
  assert.equal((email.html.match(/https:\/\/jobs\.gov\.in\/notice\/1/g) ?? []).length, 2);
});

test("idempotency key is stable for an event and distinct by type or rules version", () => {
  const first = notificationIdempotencyKey(userId, "vacancy-1", "new_vacancy", 1);
  assert.equal(first, notificationIdempotencyKey(userId, "vacancy-1", "new_vacancy", 1));
  assert.notEqual(first, notificationIdempotencyKey(userId, "vacancy-1", "deadline_extended", 1));
  assert.notEqual(first, notificationIdempotencyKey(userId, "vacancy-1", "new_vacancy", 2));
  assert.match(first, /^[a-f0-9]{64}$/);
});

test("unsubscribe token verifies for its user", () => {
  const token = createUnsubscribeToken(userId, secret, 1_800_000_000_000);
  assert.deepEqual(verifyUnsubscribeToken(token, secret, 1_800_000_000_000), { userId });
});

test("unsubscribe token rejects tampering", () => {
  const token = createUnsubscribeToken(userId, secret, 1_800_000_000_000);
  const [payload, signature] = token.split(".");
  const replacement = signature[0] === "a" ? "b" : "a";
  assert.equal(
    verifyUnsubscribeToken(`${payload}.${replacement}${signature.slice(1)}`, secret),
    null,
  );
});

test("unsubscribe token rejects expiration", () => {
  const issuedAt = 1_800_000_000_000;
  const token = createUnsubscribeToken(userId, secret, issuedAt);
  assert.equal(
    verifyUnsubscribeToken(token, secret, issuedAt + 5 * 365 * 24 * 60 * 60 * 1000),
    null,
  );
});

test("unsubscribe signing secret falls back only outside production", () => {
  for (const environment of ["development", "test"]) {
    assert.equal(
      resolveUnsubscribeSecret({ environment, fallbackSecret: "service-role-fallback" }),
      "service-role-fallback",
    );
  }
  assert.throws(
    () =>
      resolveUnsubscribeSecret({
        environment: "production",
        fallbackSecret: "service-role-fallback",
      }),
    /UNSUBSCRIBE_TOKEN_SECRET/,
  );
});

test("daily and weekly delivery windows become due at 09:00 India time", () => {
  const beforeDailyWindow = new Date("2026-10-15T02:00:00.000Z");
  const afterDailyWindow = new Date("2026-10-15T04:00:00.000Z");
  const beforeWeeklyWindow = new Date("2026-10-13T02:00:00.000Z");
  const mondayAfterWindow = new Date("2026-10-12T04:00:00.000Z");

  assert.equal(
    nextDeliveryWindow("daily", beforeDailyWindow).toISOString(),
    "2026-10-15T03:30:00.000Z",
  );
  assert.equal(nextDeliveryWindow("daily", afterDailyWindow), afterDailyWindow);
  assert.equal(
    nextDeliveryWindow("weekly", beforeWeeklyWindow).toISOString(),
    "2026-10-19T03:30:00.000Z",
  );
  assert.equal(nextDeliveryWindow("weekly", mondayAfterWindow), mondayAfterWindow);
});

test("five-minute worker ticks deliver daily and weekly digests once per window over ten days", () => {
  const start = Date.parse("2026-10-11T18:30:00.000Z");
  const dayMilliseconds = 24 * 60 * 60 * 1000;
  const tickMilliseconds = 5 * 60 * 1000;
  const pending = [];
  const delivered = [];
  let nextDailyDay = 0;
  let nextWeeklyDay = 0;

  for (let tick = start; tick < start + 10 * dayMilliseconds; tick += tickMilliseconds) {
    const now = new Date(tick);
    const elapsedDays = Math.floor((tick - start) / dayMilliseconds);
    if (elapsedDays === nextDailyDay && tick === start + elapsedDays * dayMilliseconds) {
      pending.push({ id: `daily-${elapsedDays}`, frequency: "daily", availableAt: tick });
      nextDailyDay += 1;
    }
    if (
      (elapsedDays === 0 || elapsedDays === 7) &&
      elapsedDays === nextWeeklyDay &&
      tick === start + elapsedDays * dayMilliseconds
    ) {
      pending.push({ id: `weekly-${elapsedDays}`, frequency: "weekly", availableAt: tick });
      nextWeeklyDay += 7;
    }

    for (let index = pending.length - 1; index >= 0; index -= 1) {
      const item = pending[index];
      if (item.availableAt > tick) continue;
      const window = nextDeliveryWindow(item.frequency, now);
      if (window > now) {
        item.availableAt = window.getTime();
      } else {
        delivered.push(item.id);
        pending.splice(index, 1);
      }
    }
  }

  assert.deepEqual(
    delivered.filter((id) => id.startsWith("daily-")).sort(),
    Array.from({ length: 10 }, (_, day) => `daily-${day}`),
  );
  assert.deepEqual(delivered.filter((id) => id.startsWith("weekly-")).sort(), [
    "weekly-0",
    "weekly-7",
  ]);
  assert.equal(new Set(delivered).size, delivered.length);
  assert.deepEqual(pending, []);
});

test("Resend receives list-unsubscribe headers in the email request body", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (_url, options) => {
    request = options;
    return { ok: true, json: async () => ({ id: "email_test_123" }) };
  };

  try {
    const message = {
      subject: "New vacancy",
      html: "<p>Notice</p>",
      text: "Notice",
      unsubscribeUrl: "https://api.example.com/api/unsubscribe/token",
    };
    const messageId = await sendViaResend("candidate@example.com", message, "idempotency-key");
    const body = JSON.parse(request.body);

    assert.equal(messageId, "email_test_123");
    assert.deepEqual(body.headers, {
      "List-Unsubscribe": `<${message.unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });

    test("notification worker drains batches until the queue is empty", async () => {
      const batches = [[{ id: 1 }, { id: 2 }], [{ id: 3 }], []];
      const processed = [];
      const result = await drainNotificationBatches({
        claimBatch: async () => batches.shift(),
        processItem: async ({ id }) => processed.push(id),
        releaseItems: async () => {},
      });

      assert.deepEqual(result, { processed: 3 });
      assert.deepEqual(processed, [1, 2, 3]);
    });

    test("notification worker stops claiming batches after its time budget", async () => {
      let clock = 0;
      let claims = 0;
      const processed = [];
      const released = [];
      const result = await drainNotificationBatches({
        claimBatch: async () => {
          claims += 1;
          return [{ id: 11 }, { id: 12 }];
        },
        processItem: async ({ id }) => {
          processed.push(id);
          clock += 25;
        },
        releaseItems: async (items) => released.push(...items.map(({ id }) => id)),
        now: () => clock,
        timeBudgetMs: 50,
      });

      assert.deepEqual(result, { processed: 2 });
      assert.equal(claims, 1);
      assert.deepEqual(processed, [11, 12]);
      assert.deepEqual(released, []);
    });

    test("notification worker releases unprocessed claimed rows when the budget expires", async () => {
      let clock = 0;
      const processed = [];
      const released = [];
      const result = await drainNotificationBatches({
        claimBatch: async () => [{ id: 1 }, { id: 2 }, { id: 3 }],
        processItem: async ({ id }) => {
          processed.push(id);
          clock += 50;
        },
        releaseItems: async (items) => released.push(...items.map(({ id }) => id)),
        now: () => clock,
        timeBudgetMs: 50,
      });

      assert.deepEqual(result, { processed: 1 });
      assert.deepEqual(processed, [1]);
      assert.deepEqual(released, [2, 3]);
    });
    assert.equal(request.headers["List-Unsubscribe"], undefined);
    assert.equal(request.headers["List-Unsubscribe-Post"], undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
