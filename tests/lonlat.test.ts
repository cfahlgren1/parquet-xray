import { describe, expect, it } from "vitest";
import { bboxOutline, outlineBounds, lonLatProjector } from "../src/lib/parquet/lonlat";
import type { Crs } from "../src/lib/parquet/geo";
import { loadFixture } from "./helpers";

function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("expected a value");
  return value;
}

const crsOf = async (path: string, name: string): Promise<Crs> => {
  const { model } = await loadFixture(path);
  return defined(model.geo?.columns.find((c) => c.name === name)).crs;
};

const project = (crs: Crs) => defined(lonLatProjector(crs));
const lonLat = project({ kind: "default", label: "OGC:CRS84" });

describe("lonLatProjector", () => {
  it("places each crs form Arrow writes", async () => {
    const native = "tests/fixtures/geo-native.parquet";
    // EPSG:3857 by code: the edge of the Web Mercator square is the antimeridian.
    const [lon, lat] = project(await crsOf(native, "geom"))(20037508.342789244, 0);
    expect(lon).toBeCloseTo(180, 6);
    expect(lat).toBeCloseTo(0, 6);
    expect(project(await crsOf(native, "geog"))(10, 20)).toEqual([10, 20]);
    expect(lonLatProjector(await crsOf(native, "unknown"))).toBeNull();
    // Inline PROJJSON through proj4: UTM 31N's false easting is on its 3°E central meridian.
    const [utmLon, utmLat] = project(await crsOf(native, "utm"))(500000, 0);
    expect(utmLon).toBeCloseTo(3, 6);
    expect(utmLat).toBeCloseTo(0, 6);
  });

  it("keeps x as longitude for a PROJJSON EPSG:4326, whose axes are latitude first", async () => {
    expect(project(await crsOf("tests/fixtures/geo-covering.parquet", "geometry"))(10, 50)).toEqual([10, 50]);
  });

  it("can't place a bare code it would have to look up", () => {
    expect(lonLatProjector({ kind: "code", label: "EPSG:32631" })).toBeNull();
  });
});

describe("bboxOutline", () => {
  it("splits a Web Mercator box at the antimeridian's x in meters", () => {
    const mercator = project({ kind: "code", label: "EPSG:3857" });
    const outline = defined(bboxOutline({ xmin: 19e6, xmax: -19e6, ymin: 0, ymax: 1e6 }, mercator));
    const lons = outline.map((polygon) => polygon[0]?.map(([lon]) => Math.round(lon)));
    expect(lons.map((l) => [Math.min(...(l ?? [])), Math.max(...(l ?? []))])).toEqual([
      [171, 180],
      [-180, -171],
    ]);
  });

  it("won't guess the antimeridian in other projected CRSs, or draw corners that don't project", async () => {
    const utm = project(await crsOf("tests/fixtures/geo-native.parquet", "utm"));
    expect(bboxOutline({ xmin: 700000, xmax: 300000, ymin: 0, ymax: 1 }, utm)).toBeNull();
    expect(bboxOutline({ xmin: 0, xmax: 1, ymin: 0, ymax: 1 }, () => [Number.NaN, 0])).toBeNull();
  });

  it("clamps coordinates to the globe", () => {
    const ring = defined(bboxOutline({ xmin: -200, xmax: 200, ymin: -95, ymax: 95 }, lonLat)?.[0]?.[0]);
    expect(ring[0]).toEqual([-180, -90]);
    expect(ring[2]).toEqual([180, 90]);
  });

  it("closes a single ring for an ordinary box", () => {
    expect(bboxOutline({ xmin: 0, xmax: 2, ymin: -2, ymax: 0 }, lonLat)).toEqual([
      [
        [
          [0, -2],
          [2, -2],
          [2, 0],
          [0, 0],
          [0, -2],
        ],
      ],
    ]);
  });

  it("splits a box that crosses the antimeridian, where xmin > xmax", () => {
    const outline = defined(bboxOutline({ xmin: 170, xmax: -170, ymin: -10, ymax: 10 }, lonLat));
    expect(outline.map((polygon) => polygon[0]?.[1]?.[0])).toEqual([180, -170]);
    expect(outlineBounds([outline])).toEqual([170, -10, 190, 10]);
  });

  it("doesn't wrap boxes that already span the whole world", () => {
    const west = defined(bboxOutline({ xmin: -179.9, xmax: -0.1, ymin: -60, ymax: 60 }, lonLat));
    const east = defined(bboxOutline({ xmin: 0.1, xmax: 179.9, ymin: -60, ymax: 60 }, lonLat));
    expect(outlineBounds([west, east])).toEqual([-179.9, -60, 179.9, 60]);
  });

  it("has no bounds for no outlines, and handles many points", () => {
    expect(outlineBounds([])).toBeNull();
    const many = Array.from({ length: 100_000 }, (_, i) =>
      defined(bboxOutline({ xmin: i % 90, xmax: 90, ymin: 0, ymax: 1 }, lonLat)),
    );
    expect(outlineBounds(many)).toEqual([0, 0, 90, 1]);
  });

  it("densifies projected boxes so their edges follow the projection", async () => {
    const utm = project(await crsOf("tests/fixtures/geo-native.parquet", "utm"));
    const ring = defined(bboxOutline({ xmin: 300000, xmax: 700000, ymin: 0, ymax: 5000000 }, utm)?.[0]?.[0]);
    expect(ring).toHaveLength(65);
    // A UTM northing line bends toward the pole away from the central meridian, so lat is not constant along it.
    const top = ring.slice(32, 49).map(([, lat]) => lat);
    expect(Math.max(...top) - Math.min(...top)).toBeGreaterThan(0.01);
  });
});
