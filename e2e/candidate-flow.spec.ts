import { expect, test } from "@playwright/test";
import {
  currentUserId,
  deleteTestUser,
  fixtureVacancyId,
  requireE2E,
  seedMatchForUser,
  supabaseUrl,
  anonKey,
} from "./test-support.js";

let createdUserId: string | undefined;

test.afterEach(async () => {
  if (createdUserId) {
    await deleteTestUser(createdUserId);
    createdUserId = undefined;
  }
});

test("candidate signs up, completes profile, sees a match and tracks application progress", async ({
  page,
}) => {
  requireE2E([supabaseUrl, anonKey, fixtureVacancyId], "Supabase and fixture-vacancy");
  const email = `beta-${Date.now()}@${process.env.E2E_EMAIL_DOMAIN ?? "example.test"}`;
  const password = process.env.E2E_SIGNUP_PASSWORD ?? "Beta-Only-Password-2026!";

  await page.goto("/signup");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile\/setup$/);
  const userId = await currentUserId(page);
  createdUserId = userId;

  await page.getByLabel("Highest education completed").selectOption("undergraduate");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Date of birth").fill("1995-06-15");
  await page.getByLabel("State or union territory").selectOption("Maharashtra");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Engineering").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("I agree to receive vacancy alerts by email.").check();
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();

  await seedMatchForUser(userId);
  await page.goto("/dashboard");
  await expect(
    page.getByText("Preliminary match only. Please verify the official notification."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Review vacancy" }).first().click();
  await expect(page.getByRole("heading", { name: "Match explanation" })).toBeVisible();
  await page.getByLabel("Recruitment progress").selectOption("submitted");
  await page.getByLabel("Private notes (optional)").fill("Keep the submitted application receipt.");
  await page.getByRole("button", { name: "Save tracker" }).click();
  await expect(page.getByText("Application status updated.")).toBeVisible();
  await expect(page.getByText("Current status")).toBeVisible();
  await expect(page.getByText("Submitted", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Keep the submitted application receipt.")).toBeVisible();

  await page.goto(`/feedback?vacancy_id=${encodeURIComponent(fixtureVacancyId!)}`);
  await page
    .getByLabel("What happened?")
    .fill("This test feedback is intentionally incorrect for QA.");
  await page.getByRole("button", { name: "Send feedback" }).click();
  await expect(
    page.getByText("Thank you. Your feedback was recorded for the beta team."),
  ).toBeVisible();
});
