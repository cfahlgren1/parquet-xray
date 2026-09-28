import { describe, expect, it } from "vitest";
import { readEfficiency, summarizeNames } from "../src/lib/parquet/efficiency";
import { describePiece } from "../src/lib/popover";
import { loadFixture } from "./helpers";

describe("sensors.parquet", async () => {
  const { model, counter } = await loadFixture("public/sensors.parquet");

  it("reads the footer and indexes from the tail in one pass", () => {
    expect(counter.requests).toBeLessThanOrEqual(2);
    expect(model.rowGroups).toHaveLength(8);
    expect(model.leaves.map((l) => l.path)).toEqual(["event_id", "ts", "sensor_id", "city", "temperature"]);
  });

  it("places every piece inside the file without overlaps", () => {
    for (const [i, piece] of model.pieces.entries()) {
      expect(piece.start).toBeGreaterThanOrEqual(0);
      expect(piece.end).toBeLessThanOrEqual(model.fileSize);
      expect(piece.end).toBeGreaterThan(piece.start);
      const next = model.pieces[i + 1];
      if (next) expect(next.start).toBeGreaterThanOrEqual(piece.end);
    }
  });

  it("splits chunks into pages from the offset index", () => {
    const chunk = model.rowGroups[0]?.chunks[0];
    const pages = chunk?.parts.filter((p) => p.kind === "page") ?? [];
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.reduce((sum, p) => sum + (p.kind === "page" ? p.numRows : 0), 0)).toBe(50_000);
  });

  it("finds sorted columns, the page index and bloom filters", () => {
    const checks = Object.fromEntries(readEfficiency(model).map((c) => [c.label, c]));
    expect(checks.Sorted?.columns).toEqual(["event_id", "ts"]);
    expect(checks["Page index"]?.passed).toBe(true);
    expect(checks.Bloom?.columns).toEqual(["sensor_id"]);
    expect(checks.CDC?.passed).toBe(false);
  });

  it("describes a data page with its rows and min/max", () => {
    const page = model.pieces.find((p) => p.kind === "page" && p.chunk.leaf === 0 && p.page === 1);
    if (!page) throw new Error("no page");
    const content = describePiece(page, model);
    expect(content.title).toBe("Data page 1");
    expect(content.where).toBe("row_group[0] · page 1");
    expect(Object.fromEntries(content.rows).Rows).toBe("10,000 – 19,999");
  });
});

describe("summarizeNames", () => {
  it("keeps short lists whole and collapses long ones to a count", () => {
    expect(summarizeNames(["event_id", "ts"])).toBe("event_id, ts");
    expect(summarizeNames(["episode_index", "stats/frame_index/min", "stats/frame_index/max"])).toBe(
      "episode_index +2",
    );
  });
});
