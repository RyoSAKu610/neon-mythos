import { test, expect } from "@playwright/test";
test("home explains vertical flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/economic subjects/i)).toBeVisible();
});
test("economy demo button exists", async ({ page }) => {
  await page.goto("/economy");
  await expect(page.getByRole("button", { name: /hire/i })).toBeVisible();
});
test("demo hire→settle API shape", async ({ request }) => {
  const r = await request.post("/api/economy/demo", {
    data: { worldId: "sim:fast-001", priceCredits: 100, verdict: "pass" },
  });
  expect(r.ok()).toBeTruthy();
  const j = await r.json();
  expect(j.contract.status).toBe("settled");
  expect(j.task.status).toBe("succeeded");
  expect(j.balances.B).toBe(100);
  expect(j.corr).toMatch(/^corr_/);
});
test("demo rejects invalid input", async ({ request }) => {
  const r = await request.post("/api/economy/demo", {
    data: { worldId: "sim:fast-001", priceCredits: -5, verdict: "pass" },
  });
  expect(r.status()).toBe(400);
});
