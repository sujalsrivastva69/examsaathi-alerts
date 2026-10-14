import { expect, test } from "@playwright/test";

test("public privacy and coverage pages are available in English and Hindi", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  await expect(page.getByText(/needs legal review/i)).toBeVisible();
  await page.getByRole("button", { name: "हिन्दी" }).click();
  await expect(page.getByRole("heading", { name: "गोपनीयता नीति" })).toBeVisible();

  await page.goto("/about");
  await expect(page.getByText(/मौजूदा स्वचालित स्रोत कवरेज: कोई नहीं/)).toBeVisible();
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByText(/Current automated source coverage: none/)).toBeVisible();
});
