import { expect, test } from "@playwright/test";
import { anonKey, apiUrl, requireE2E, signIn, supabaseUrl } from "./test-support.js";

async function loginAccessToken(email: string, password: string) {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey!, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  expect(response.ok, `Auth test user login failed (${response.status}).`).toBeTruthy();
  return (await response.json()).access_token as string;
}

test("database RLS hides another user's profile and role; ordinary candidate cannot call admin APIs", async ({
  page,
}) => {
  const candidateEmail = process.env.E2E_CANDIDATE_EMAIL;
  const candidatePassword = process.env.E2E_CANDIDATE_PASSWORD;
  const otherEmail = process.env.E2E_OTHER_USER_EMAIL;
  const otherPassword = process.env.E2E_OTHER_USER_PASSWORD;
  requireE2E(
    [supabaseUrl, anonKey, apiUrl, candidateEmail, candidatePassword, otherEmail, otherPassword],
    "two pre-provisioned candidate accounts",
  );
  const [candidateToken, otherToken] = await Promise.all([
    loginAccessToken(candidateEmail!, candidatePassword!),
    loginAccessToken(otherEmail!, otherPassword!),
  ]);
  const otherUserResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey!, Authorization: `Bearer ${otherToken}` },
  });
  expect(otherUserResponse.ok).toBeTruthy();
  const otherUser = (await otherUserResponse.json()) as { id: string };

  const userScopedTables = [
    "profiles",
    "notification_preferences",
    "user_vacancy_matches",
    "user_vacancy_actions",
    "user_vacancy_action_history",
    "beta_feedback",
    "user_roles",
    "notification_queue",
    "notification_logs",
  ];
  for (const table of userScopedTables) {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/${table}?user_id=eq.${encodeURIComponent(otherUser.id)}&select=user_id`,
      {
        headers: { apikey: anonKey!, Authorization: `Bearer ${candidateToken}` },
      },
    );
    expect([200, 401, 403], `${table} must not disclose another user's row`).toContain(
      response.status,
    );
    if (response.ok) expect(await response.json(), table).toEqual([]);
  }

  await signIn(page, candidateEmail!, candidatePassword!);
  const apiResponse = await page.request.get(`${apiUrl}/api/admin/vacancies`);
  expect(apiResponse.status()).toBe(403);

  const invalidFeedback = await page.request.post(`${apiUrl}/api/beta-feedback`, {
    headers: { Authorization: `Bearer ${candidateToken}` },
    data: { feedback_type: "made_up", details: "bad" },
  });
  expect(invalidFeedback.status()).toBe(400);

  const health = await page.request.get(`${apiUrl}/api/health`, {
    headers: { Origin: "https://untrusted-origin.example" },
  });
  expect(health.status()).toBe(200);
  expect(health.headers()["access-control-allow-origin"]).toBeUndefined();
  expect(health.headers()["x-content-type-options"]).toBe("nosniff");
  expect(health.headers()["x-powered-by"]).toBeUndefined();
});
