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
test("QR intent executes end-to-end", async ({ request }) => {
  const r = await request.post("/api/intents/execute", {
    data: { v: 1, t: "Scout rivals", b: "Summarize 3 rival releases", k: "mission_investigation", p: 80 },
  });
  expect(r.ok()).toBeTruthy();
  const j = await r.json();
  expect(j.kind).toBe("mission_investigation");
  expect(j.contract.status).toBe("settled");
  expect(j.events.length).toBeGreaterThan(10);
});
test("QR intent rejects garbage", async ({ request }) => {
  const r = await request.post("/api/intents/execute", { data: { v: 1 } });
  expect(r.status()).toBe(400);
});
test("scan page decodes payload", async ({ page }) => {
  await page.goto("/s?m=eyJ2IjoxLCJ0IjoiVCIsImIiOiJCIiwiayI6InNlcnZpY2VfaGlyZSIsInAiOjEwMH0");
  await expect(page.getByRole("button", { name: /実行/ })).toBeVisible();
});
test("share page generates QR", async ({ page }) => {
  await page.goto("/share");
  await page.getByRole("button", { name: /QRを生成/ }).click();
  await expect(page.getByAltText("intent QR")).toBeVisible();
});
