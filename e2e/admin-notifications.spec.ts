import { expect, test } from "@playwright/test";
import { requireE2E, serviceRoleRequest, signIn, supabaseUrl } from "./test-support.js";

test("admin publishes a verified vacancy and delivery is recorded as a dry run", async ({
  page,
}) => {
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  const draftId = process.env.E2E_VERIFIED_DRAFT_ID;
  const recipientUserId = process.env.E2E_NOTIFICATION_USER_ID;
  requireE2E(
    [supabaseUrl, adminEmail, adminPassword, draftId, recipientUserId],
    "admin, draft-vacancy, and notification-recipient",
  );
  test.setTimeout(100_000);

  const startedAt = new Date().toISOString();
  await serviceRoleRequest(
    "notification_queue",
    `?vacancy_id=eq.${encodeURIComponent(draftId!)}&user_id=eq.${encodeURIComponent(recipientUserId!)}&notification_type=eq.new_vacancy`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } },
  );
  await serviceRoleRequest("vacancies", `?id=eq.${encodeURIComponent(draftId!)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      status: "awaiting_verification",
      verification_status: "verified",
      verification_checklist: {
        source_checked: true,
        dates_checked: true,
        rules_checked: true,
      },
      archived_at: null,
      next_notification_type: "new_vacancy",
    }),
  });

  await signIn(page, adminEmail!, adminPassword!);
  await page.goto(`/admin?edit=${encodeURIComponent(draftId!)}`);
  const publish = page.getByRole("button", { name: "Publish", exact: true });
  await expect(publish).toBeEnabled({ timeout: 15_000 });
  await publish.click();
  await expect(page.getByText("Verified and open")).toBeVisible();

  const deadline = Date.now() + 80_000;
  let dryRunLog: unknown[] = [];
  while (Date.now() < deadline && dryRunLog.length === 0) {
    dryRunLog = (await serviceRoleRequest(
      "notification_logs",
      `?vacancy_id=eq.${encodeURIComponent(draftId!)}&user_id=eq.${encodeURIComponent(recipientUserId!)}&status=eq.dry_run&created_at=gt.${encodeURIComponent(startedAt)}&select=id,status,created_at&limit=1`,
    )) as unknown[];
    if (!dryRunLog.length) await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  expect(dryRunLog, "Notification worker should record a dry-run email.").not.toHaveLength(0);
});
