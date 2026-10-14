import assert from "node:assert/strict";
import test from "node:test";
import { renderVacancyEmail } from "../../services/notifications/email-templates.js";
import { notificationIdempotencyKey } from "../../services/notifications/idempotency.js";
import {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
} from "../../services/notifications/unsubscribe-token.js";

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
