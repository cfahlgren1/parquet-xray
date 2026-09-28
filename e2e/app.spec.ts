import { expect, test, type Page } from "@playwright/test";

async function openSensors(page: Page, query = "") {
  await page.goto(`/?url=sensors.parquet${query}`);
  await expect(page.getByRole("status")).toContainText("Read ");
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
