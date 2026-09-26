// How-to video recorder: QR指令 v1 walkthrough on the live site.
// Usage: SITE=https://neon-mythos-ryosaku610s-projects.vercel.app pnpm exec node scripts/record-howto.mjs
import { chromium } from "@playwright/test";

const SITE = process.env["SITE"] ?? "http://localhost:3000";
const OUT = process.env["OUT"] ?? "/tmp/qr-howto.webm";

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: "/tmp/pw-video", size: { width: 1280, height: 800 } },
});
const page = await context.newPage();

// 1. /share — fill idea, generate QR
await page.goto(`${SITE}/share`);
await page.getByLabel(/タイトル/).fill("競合の新機能を調査せよ");
await page.getByLabel(/指示文/).fill("直近3か月の競合リリースを集め、脅威度順に3点へ圧縮せよ");
await page.getByRole("button", { name: /QRを生成/ }).click();
await page.getByAltText("intent QR").waitFor();
await page.waitForTimeout(1500);

// 2. open the link (same as scanning) — confirm + execute
await page.getByRole("link", { name: /この端末で開く/ }).click();
await page.getByRole("button", { name: /実行させる/ }).waitFor();
await page.waitForTimeout(800);
await page.getByRole("button", { name: /実行させる/ }).click();
await page.getByText(/Strategy Roomで見る/).waitFor({ timeout: 30000 });
await page.waitForTimeout(2000);

// 3. strategy room shows the run
await page.getByRole("link", { name: /Strategy Roomで見る/ }).click();
await page.getByText(/最新の指令/).waitFor();
await page.waitForTimeout(1500);

await context.close();
await browser.close();

// move video to OUT
import { readdirSync, renameSync } from "node:fs";
const files = readdirSync("/tmp/pw-video").filter((f) => f.endsWith(".webm"));
if (files.length === 0) throw new Error("no video recorded");
renameSync(`/tmp/pw-video/${files[0]}`, OUT);
console.log(`saved ${OUT}`);
