import { test, expect } from "@playwright/test";

test("intel board API returns hypotheses and critiques", async ({ request }) => {
  const r = await request.get("/api/intel/board");
  expect(r.ok()).toBeTruthy();
  const j = await r.json();
  expect(Array.isArray(j.hypotheses)).toBe(true);
  expect(j.hypotheses.length).toBeGreaterThanOrEqual(2);
  expect(Array.isArray(j.critiques)).toBe(true);
  expect(j.critiques.length).toBeGreaterThanOrEqual(1);
  expect(Array.isArray(j.contractIds)).toBe(true);
  expect(j.contractIds.length).toBe(2);
});

test("intelligence page renders hypotheses", async ({ page }) => {
  await page.goto("/intelligence");
  await expect(page.getByText(/競合3社|新興2社/).first()).toBeVisible();
  await expect(page.locator('[aria-label="読み込み中"]')).toBeHidden({ timeout: 10000 });
});

test("decisions approve flow changes status", async ({ page }) => {
  await page.goto("/decisions");
  await page.evaluate(() => window.localStorage.removeItem("neon:decisions"));
  await page.reload();
  await expect(page.getByText("決定キュー")).toBeVisible();
  const approveBtn = page.getByRole("button", { name: "承認" }).first();
  await expect(approveBtn).toBeVisible();
  await approveBtn.click();
  await expect(page.getByText("承認済み").first()).toBeVisible();
});
