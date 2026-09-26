import { test, expect } from "@playwright/test";

test("agents page shows registry ids", async ({ page }) => {
  await page.goto("/agents");
  await expect(page.getByRole("heading", { name: /エージェント登録/ })).toBeVisible();
  for (const id of ["scout", "researcher", "verifier"]) {
    await expect(page.getByRole("heading", { name: id, exact: true })).toBeVisible();
  }
  await expect(page.getByText("A2A Agent Card", { exact: false }).first()).toBeVisible();
});

test("sources CRUD: add via form, then delete", async ({ page }) => {
  await page.goto("/sources");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // シードが表示される
  await expect(page.getByText("NIST AI Risk Management Framework")).toBeVisible();

  const form = page.locator('section[aria-label="ソース追加フォーム"]');
  // 無効な入力はエラー表示
  await form.getByLabel("タイトル").fill("不正ソース");
  await form.getByLabel("URL").fill("not-a-url");
  await page.getByRole("button", { name: "ソースを追加" }).click();
  await expect(form.getByRole("alert")).toContainText("有効なURL");

  const title = `E2Eソース ${Date.now()}`;
  await form.getByLabel("タイトル").fill(title);
  await form.getByLabel("URL").fill("https://example.com/e2e-source");
  await form.getByLabel("信頼度").fill("70");
  await form.getByLabel("メモ").fill("E2Eテスト用のメモ");
  await page.getByRole("button", { name: "ソースを追加" }).click();
  await expect(page.getByText(title)).toBeVisible();

  // 信頼度ボタンで +5
  const card = page.getByRole("article", { name: `ソース: ${title}` });
  await page.getByRole("button", { name: `信頼度を上げる: ${title}` }).click();
  await expect(card.getByText("信頼度: 75")).toBeVisible();

  await page.getByRole("button", { name: `削除: ${title}` }).click();
  await expect(page.getByText(title)).toHaveCount(0);
});

test("sources shows empty state when none", async ({ page }) => {
  await page.goto("/sources");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByText("NIST AI Risk Management Framework")).toBeVisible();
  for (const seed of ["NIST AI Risk Management Framework", "GPT-4 System Card", "GPT-4 Technical Report"]) {
    await page.getByRole("button", { name: `削除: ${seed}` }).click();
  }
  await expect(page.getByText("ソースがありません")).toBeVisible();
});
