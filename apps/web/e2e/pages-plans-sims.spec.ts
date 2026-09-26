import { test, expect } from "@playwright/test";

test("sims API returns N runs with mixed verdicts", async ({ request }) => {
  const r = await request.post("/api/sims/run", {
    data: { runs: 3, priceCredits: 100 },
  });
  expect(r.ok()).toBeTruthy();
  const j = await r.json();
  expect(j.runs).toHaveLength(3);
  expect(j.runs.map((x: { verdict: string }) => x.verdict)).toEqual([
    "pass",
    "partial",
    "fail",
  ]);
  expect(j.runs[0].paid).toBe(100);
  expect(j.runs[1].paid).toBe(50);
  expect(j.runs[2].paid).toBe(0);
  expect(j.totals.paidTotal).toBe(150);
  expect(j.totals.eventsTotal).toBeGreaterThan(10);
});

test("sims API rejects invalid input", async ({ request }) => {
  const r = await request.post("/api/sims/run", {
    data: { runs: 99, priceCredits: -5 },
  });
  expect(r.status()).toBe(400);
});

test("simulations page runs and shows table", async ({ page }) => {
  await page.goto("/simulations");
  await page.getByRole("button", { name: /シミュレーション実行/ }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByText("pass=全額")).toBeVisible();
});

test("plans empty state visible without localStorage", async ({ page }) => {
  await page.goto("/plans");
  await expect(page.getByText(/まだ実行履歴がない/)).toBeVisible();
  await expect(page.getByText(/プランの型/)).toBeVisible();
});
