import { test, expect } from "@playwright/test";

test("activity feed API returns merged newest-first events", async ({ request }) => {
  const r = await request.get("/api/activity/feed");
  expect(r.ok()).toBeTruthy();
  const j = await r.json();
  expect(Array.isArray(j.events)).toBeTruthy();
  expect(j.events.length).toBeGreaterThan(5);
  // Newest-first: seq descending.
  const seqs = j.events.map((e: { seq: number }) => e.seq);
  const sorted = [...seqs].sort((a, b) => b - a);
  expect(seqs).toEqual(sorted);
  // Both worlds present with counts.
  const worlds = new Set(j.events.map((e: { worldId: string }) => e.worldId));
  expect(worlds.has("production")).toBeTruthy();
  expect(worlds.has("sim:fast-001")).toBeTruthy();
  expect(j.counts["sim:fast-001"]).toBeGreaterThan(0);
  expect(j.counts.production).toBeGreaterThan(0);
  // Shape check.
  for (const e of j.events) {
    expect(typeof e.seq).toBe("number");
    expect(typeof e.worldId).toBe("string");
    expect(typeof e.type).toBe("string");
    expect(typeof e.entityId).toBe("string");
    expect(typeof e.at).toBe("string");
  }
});

test("neon city renders SVG nodes", async ({ page }) => {
  await page.goto("/neon-city");
  await expect(page.getByTestId("city-svg")).toBeVisible();
  await expect(page.getByText(/読み取り専用/)).toBeVisible();
  const nodes = page.getByTestId("city-node");
  await expect(nodes.first()).toBeVisible();
  expect(await nodes.count()).toBeGreaterThanOrEqual(4);
});

test("activity filters by world", async ({ page }) => {
  await page.goto("/activity");
  // Table loads.
  await expect(page.getByRole("table")).toBeVisible();
  const rows = page.locator("tbody tr");
  expect(await rows.count()).toBeGreaterThan(0);
  // Filter to production: every visible world cell must read production.
  await page.getByRole("button", { name: "production", exact: true }).click();
  const cells = page.locator("tbody tr td:nth-child(2)");
  expect(await cells.count()).toBeGreaterThan(0);
  for (const text of await cells.allTextContents()) {
    expect(text.trim()).toBe("production");
  }
  // Back to all shows both worlds.
  await page.getByRole("button", { name: "すべて" }).click();
  const allCells = await page.locator("tbody tr td:nth-child(2)").allTextContents();
  expect(new Set(allCells.map((t) => t.trim())).size).toBeGreaterThan(1);
});

test("settings world selection persists across reload", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("radio", { name: "sim:fast-001" }).click();
  await expect(page.getByText("保存済み: sim:fast-001")).toBeVisible();
  // Toggle a flag and check saved state line updates.
  const flag = page.getByRole("checkbox", { name: /economy-sim/ });
  const before = await flag.isChecked();
  await flag.click();
  await expect(page.getByText(/保存済み:/).last()).toContainText(
    before ? `"economy-sim":false` : `"economy-sim":true`,
  );
  await page.reload();
  await expect(page.getByText("保存済み: sim:fast-001")).toBeVisible();
  // Restore default for other tests.
  await page.getByRole("radio", { name: "production", exact: true }).click();
});
