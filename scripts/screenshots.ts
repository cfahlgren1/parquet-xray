/**
 * Regenerates the README screenshots in docs/ from the production build.
 * Run with `npm run screenshots` (it builds and serves the app itself).
 */
import { chromium, devices, type Page } from "@playwright/test";
import { spawn } from "node:child_process";

const PORT = 4174;
const BASE = `http://localhost:${PORT}`;
const UNITREE =
  "https://huggingface.co/datasets/unitreerobotics/G1_Dex1_Stack_Block/blob/main/meta/episodes/chunk-000/file-000.parquet";

async function open(page: Page, query: string) {
  await page.goto(`${BASE}/?${query}`);
  await page.getByRole("status").filter({ hasText: /Read / }).waitFor({ timeout: 90_000 });
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

  await open(desktop, "url=sensors.parquet&col=ts");
  await desktop.mouse.move(0, 0);
  const schema = desktop.getByRole("heading", { name: /Schema/ });
  await schema.scrollIntoViewIfNeeded();
  const top = (await schema.boundingBox())?.y ?? 0;
  await desktop.screenshot({ path: "docs/column.png", clip: { x: 0, y: top - 16, width: 1280, height: 560 } });

  await open(desktop, "url=sensors.parquet");
  await hoverStrip(desktop, "Indexes and footer", 0.45);
  const map = await desktop.locator("section.card").boundingBox();
  if (!map) throw new Error("no file map");
  await desktop.screenshot({
    path: "docs/indexes.png",
    clip: { x: 0, y: map.y - 16, width: 1280, height: map.height + 260 },
  });

  await open(desktop, `url=${encodeURIComponent(UNITREE)}&col=${encodeURIComponent("tasks.list.element")}`);
  await desktop
    .getByRole("button", { name: /^Column stats\/observation\.images\.head_stereo_left\/min\.list/ })
    .scrollIntoViewIfNeeded();
  const lines = await desktop.locator(".schema").boundingBox();
  const line = await desktop
    .getByRole("button", { name: /^Column stats\/observation\.images\.head_stereo_left\/min\.list/ })
    .boundingBox();
  if (!lines || !line) throw new Error("no schema");
  await desktop.screenshot({
    path: "docs/nested-lists.png",
    clip: { x: lines.x - 8, y: line.y - 140, width: lines.width + 16, height: 400 },
  });

  const phone = await browser.newPage({ ...devices["iPhone 14"], deviceScaleFactor: 3 });
  await open(phone, "url=sensors.parquet&col=ts");
  await phone.screenshot({ path: "docs/mobile-overview.png" });
  await open(phone, "url=sensors.parquet&rg=1");
  await phone.locator("[aria-expanded=true]").scrollIntoViewIfNeeded();
  await phone.locator("[aria-expanded=true] ~ div .pages > div").nth(3).tap();
  await phone.getByRole("tooltip").waitFor();
  await phone.screenshot({ path: "docs/mobile-page.png" });
} finally {
  await browser.close();
  server.kill();
}
