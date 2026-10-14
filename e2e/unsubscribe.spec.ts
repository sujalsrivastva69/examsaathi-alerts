import { expect, test } from "@playwright/test";
import { apiUrl, requireE2E, serviceRoleRequest, signUnsubscribeToken } from "./test-support.js";

test("signed unsubscribe link asks for confirmation, then disables email alerts", async ({
  page,
}) => {
  const userId = process.env.E2E_NOTIFICATION_USER_ID;
  requireE2E([userId, apiUrl, process.env.E2E_UNSUBSCRIBE_TOKEN_SECRET], "unsubscribe");
  const token = await signUnsubscribeToken(userId!);
  await page.goto(`${apiUrl}/api/unsubscribe/${token}`);
  await expect(page.getByRole("heading", { name: "Unsubscribe from email alerts?" })).toBeVisible();
  await page.getByRole("button", { name: "Unsubscribe", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Email alerts stopped" })).toBeVisible();

  const preferences = (await serviceRoleRequest(
    "notification_preferences",
    `?user_id=eq.${encodeURIComponent(userId!)}&select=email_enabled,unsubscribed_at`,
  )) as Array<{ email_enabled: boolean; unsubscribed_at: string | null }>;
  expect(preferences[0]?.email_enabled).toBe(false);
  expect(preferences[0]?.unsubscribed_at).not.toBeNull();

  let rateLimited = false;
  for (let attempt = 0; attempt < 25 && !rateLimited; attempt += 1) {
    const response = await page.request.get(`${apiUrl}/api/unsubscribe/invalid-test-token`);
    rateLimited = response.status() === 429;
  }
  expect(rateLimited, "Unsubscribe endpoint should enforce its per-IP request limit.").toBe(true);
});
