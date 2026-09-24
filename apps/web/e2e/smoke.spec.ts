import { test, expect } from "@playwright/test";
test("home explains vertical flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/economic subjects/i)).toBeVisible();
});
test("economy demo button exists", async ({ page }) => {
  await page.goto("/economy");
  await expect(page.getByRole("button", { name: /hire/i })).toBeVisible();
});
