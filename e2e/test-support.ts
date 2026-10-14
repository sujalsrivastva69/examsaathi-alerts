import { expect, type Page } from "@playwright/test";
import { createUnsubscribeToken } from "../server/services/notifications/unsubscribe-token.js";

export const supabaseUrl = process.env.E2E_SUPABASE_URL;
export const anonKey = process.env.E2E_SUPABASE_ANON_KEY;
export const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
export const fixtureVacancyId = process.env.E2E_VACANCY_ID;
export const apiUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:3000";

export function requireE2E(values: Array<string | undefined>, label: string) {
  const missing = values.some((value) => !value);
  expect(missing, `Set all required ${label} environment variables before running E2E.`).toBe(
    false,
  );
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
}

export async function currentUserId(page: Page) {
  const accessToken = await page.evaluate(() => {
    const authEntry = Object.entries(window.localStorage).find(([key]) =>
      key.endsWith("-auth-token"),
    );
    if (!authEntry) throw new Error("Supabase auth session was not found in local storage.");
    return JSON.parse(authEntry[1]).access_token as string;
  });
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey!, Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Could not read signed-in test user (${response.status}).`);
  const user = (await response.json()) as { id: string };
  return user.id;
}

export async function serviceRoleRequest(table: string, query: string, init: RequestInit = {}) {
  requireE2E([supabaseUrl, serviceRoleKey], "Supabase service-role");
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}${query}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey!,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(
      `Supabase test fixture request failed (${response.status}): ${await response.text()}`,
    );
  }
  return response.status === 204 ? null : response.json();
}

export async function seedMatchForUser(userId: string) {
  const vacancies = (await serviceRoleRequest(
    "vacancies",
    `?id=eq.${encodeURIComponent(fixtureVacancyId!)}&select=id,rules_version`,
  )) as Array<{ id: string; rules_version: number }>;
  expect(vacancies, "E2E_VACANCY_ID must refer to an existing vacancy").toHaveLength(1);
  const vacancy = vacancies[0];
  await serviceRoleRequest("user_vacancy_matches", "?on_conflict=user_id,vacancy_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      user_id: userId,
      vacancy_id: vacancy.id,
      status: "preliminary_match",
      explanation: {
        qualification: {
          status: "matched",
          reason: { en: "Qualification matches.", hi: "योग्यता मेल खाती है।" },
        },
        age: {
          status: "matched",
          reason: {
            en: "Age is within the limit on the notice cutoff date.",
            hi: "कटऑफ़ तारीख़ पर आयु सीमा में है।",
          },
        },
        discipline: {
          status: "matched",
          reason: { en: "Discipline matches.", hi: "विषय मेल खाता है।" },
        },
        state: {
          status: "matched",
          reason: { en: "State requirement matches.", hi: "राज्य की शर्त मेल खाती है।" },
        },
        experience: {
          status: "matched",
          reason: { en: "Experience requirement matches.", hi: "अनुभव की शर्त मेल खाती है।" },
        },
      },
      missing: [],
      failed: [],
      rules_version: vacancy.rules_version,
      evaluated_at: new Date().toISOString(),
    }),
  });
}

export async function deleteTestUser(userId: string) {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: {
      apikey: serviceRoleKey!,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Could not remove disposable E2E user (${response.status}).`);
  }
}

export async function signUnsubscribeToken(userId: string) {
  const secret = process.env.E2E_UNSUBSCRIBE_TOKEN_SECRET;
  requireE2E([secret], "E2E_UNSUBSCRIBE_TOKEN_SECRET matching server configuration");
  return createUnsubscribeToken(userId, secret!);
}
