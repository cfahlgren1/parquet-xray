import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function openSensors(page: Page, query = "") {
  await page.goto(`/?url=sensors.parquet${query}`);
  await expect(page.getByRole("region", { name: "File summary" })).toContainText(/read .* of 4\.7 MB/);
}

test("shows the file facts and read efficiency", async ({ page }) => {
  await openSensors(page);
  await expect(page.getByText("400,000")).toBeVisible();
  const sorted = page.getByRole("button", { name: /Sorted/ });
  await expect(sorted).toContainText("event_id, ts");
  await expect(page.getByRole("button", { name: /Bloom/ })).toContainText("sensor_id");
});

test("opens a row group from the file map and mirrors it in the URL", async ({ page, isMobile }) => {
  await openSensors(page);
  const strip = page.getByLabel("File layout");
  const box = await strip.boundingBox();
  if (!box) throw new Error("no strip");
  if (isMobile) await strip.tap({ position: { x: box.width * 0.3, y: box.height / 2 } });
  else await strip.click({ position: { x: box.width * 0.3, y: box.height / 2 } });
  const open = page.locator("[aria-expanded=true]");
  await expect(open).toHaveCount(1);
  await expect(page).toHaveURL(/rg=2/);
  await expect(page.getByText("event_id").nth(1)).toBeVisible();
});

test("selecting a column shows its per-row-group ranges", async ({ page }) => {
  await openSensors(page);
  await page.getByRole("button", { name: /^Column event_id,/ }).click();
  await expect(page).toHaveURL(/col=event_id/);
  await expect(page.getByText("sorted: filters on it skip row groups")).toBeVisible();
  await page.getByTitle("Open row_group[5]").click();
  await expect(page).toHaveURL(/rg=5/);
  await expect(page.locator("[aria-expanded=true]")).toContainText("250,000–299,999");
});

test("restores a shared link", async ({ page }) => {
  await openSensors(page, "&rg=3&col=city");
  await expect(page.locator("[aria-expanded=true]")).toContainText("150,000–199,999");
  await expect(page.getByText("same range in every row group")).toBeVisible();
});

test("hovering the file map explains the page under the pointer", async ({ page, isMobile }) => {
  test.skip(isMobile, "no hover on touch screens");
  await openSensors(page);
  const strip = page.getByLabel("File layout");
  const box = await strip.boundingBox();
  if (!box) throw new Error("no strip");
  await page.mouse.move(box.x + box.width * 0.01, box.y + box.height / 2);
  const popover = page.getByRole("tooltip");
  await expect(popover).toContainText("Dictionary page");
  await expect(popover).toContainText("event_id");
  await expect(popover).toContainText("Click to open row_group[0]");
});

test("reports files that aren't Parquet", async ({ page }) => {
  await page.goto("/?url=index.html");
  await expect(page.getByRole("status")).toContainText("doesn't look like a Parquet file");
});

/** Serves a test fixture with Range support, so geo files needn't be committed to public/. */
async function serveFixture(page: Page, name: string) {
  const bytes = await readFile(`tests/fixtures/${name}`);
  await page.route(`**/${name}`, async (route) => {
    const headers = { "accept-ranges": "bytes", "content-type": "application/octet-stream" };
    const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range ?? "");
    if (route.request().method() === "HEAD" || !range) {
      const body = route.request().method() === "HEAD" ? undefined : bytes;
      return route.fulfill({ headers: { ...headers, "content-length": String(bytes.length) }, body });
    }
    const start = Number(range[1]);
    const end = range[2] ? Math.min(Number(range[2]), bytes.length - 1) : bytes.length - 1;
    await route.fulfill({
      status: 206,
      headers: { ...headers, "content-range": `bytes ${start}-${end}/${bytes.length}` },
      body: bytes.subarray(start, end + 1),
    });
  });
}

test("maps row group and geo key bboxes, without a basemap when it can't load", async ({ page }) => {
  await page.route("**/tiles.openfreemap.org/**", (route) => route.abort());
  await serveFixture(page, "geo-covering.parquet");
  await page.goto("/?url=geo-covering.parquet");
  const map = page.getByRole("region", { name: "Geometry map" });
  await expect(map).toContainText("2 of 2 row groups have a bbox (from the bbox covering columns)");
  await expect(map).toContainText("WKB binary · WGS 84");
  await expect(map.getByText("geo key bbox")).toBeVisible();
  await expect(map).toContainText("File bbox from the geo key");
  await expect(map).toContainText("The basemap couldn't load");
});

test("doesn't load the map for files without geometry", async ({ page }) => {
  const chunks: string[] = [];
  page.on("request", (request) => chunks.push(request.url()));
  await openSensors(page);
  await expect(page.getByRole("region", { name: "Geometry map" })).toHaveCount(0);
  expect(chunks.filter((url) => /maplibre|lonlat|GeoMap/.test(url))).toEqual([]);
});
