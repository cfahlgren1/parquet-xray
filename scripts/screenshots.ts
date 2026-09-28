/**
 * Regenerates the README screenshot in docs/ from the production build.
 * Run with `npm run screenshots` (it builds and serves the app itself).
 */
import { chromium, type Page } from "@playwright/test";
import { spawn } from "node:child_process";

const PORT = 4174;
const BASE = `http://localhost:${PORT}`;

async function open(page: Page, query: string) {
  await page.goto(`${BASE}/?${query}`);
  await page.getByRole("region", { name: "File summary" }).waitFor({ timeout: 90_000 });
  await page.waitForTimeout(300);
}

async function hoverStrip(page: Page, label: string, at: number) {
  const box = await page.getByLabel(label).boundingBox();
  if (!box) throw new Error(`no ${label}`);
  await page.mouse.move(box.x + box.width * at, box.y + box.height / 2);
  await page.getByRole("tooltip").waitFor();
}

const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
await new Promise((resolve) => setTimeout(resolve, 1500));
const browser = await chromium.launch();

try {
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });

  await open(desktop, "url=sensors.parquet&rg=2");
  await hoverStrip(desktop, "File layout", 0.31);
  await desktop.screenshot({ path: "docs/overview.png" });
} finally {
  await browser.close();
  server.kill();
}
