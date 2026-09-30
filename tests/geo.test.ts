import type { FileMetaData, LogicalType } from "hyparquet";
import { describe, expect, it } from "vitest";
import { geometryTypeName, nativeCrs, readGeo } from "../src/lib/parquet/geo";
import type { Leaf } from "../src/lib/parquet/model";
import { schemaLines } from "../src/lib/parquet/schema";
import { loadFixture } from "./helpers";

const geometryLine = async (path: string, name: string) => {
  const { model } = await loadFixture(path);
  return schemaLines(model.metadata).find((line) => line.name === name);
};

describe("geospatial schema", () => {
  it("keeps a GeoParquet 1.x column as plain binary, as the footer declares it", async () => {
    const line = await geometryLine("tests/fixtures/geo-v1.parquet", "geometry");
    expect(line?.type).toBe("binary");
    expect(line?.annotation).toBeUndefined();
  });

  it("shows the native GEOMETRY and GEOGRAPHY logical types", async () => {
    expect((await geometryLine("tests/fixtures/geo-native.parquet", "geom"))?.annotation).toContain("GEOMETRY");
    expect((await geometryLine("tests/fixtures/geo-native.parquet", "geog"))?.annotation).toContain("GEOGRAPHY");
    expect((await geometryLine("tests/fixtures/geo-v2.parquet", "geometry"))?.annotation).toContain("GEOMETRY");
  });
});

describe("geo model", () => {
  it("is null for files without geometry", async () => {
    expect((await loadFixture("public/sensors.parquet")).model.geo).toBeNull();
  });

  it("reads GeoParquet 1.0 metadata on a plain binary column", async () => {
    const geo = (await loadFixture("tests/fixtures/geo-v1.parquet")).model.geo;
    expect(geo?.version).toBe("1.0.0");
    expect(geo?.issues).toEqual([]);
    const [column] = geo?.columns ?? [];
    expect(column).toMatchObject({ name: "geometry", leaf: 1, type: "GEOMETRY", native: null, primary: true });
    expect(column?.edges).toBe("planar");
    expect(column?.crs).toMatchObject({ kind: "projjson", label: "EPSG:3857", name: "WGS 84 / Pseudo-Mercator" });
    expect(column?.geoKey?.geometry_types).toEqual(["LineString", "Point"]);
    // No native statistics and no covering, so nothing says where each row group is.
    expect(column?.rowGroups).toEqual([null, null]);
    expect(column?.bbox).toEqual({ xmin: 0, ymin: -5, xmax: 6, ymax: 0 });
  });

  it("gets row group bounds from the GeoParquet 1.1 bbox covering", async () => {
    const geo = (await loadFixture("tests/fixtures/geo-covering.parquet")).model.geo;
    expect(geo?.version).toBe("1.1.0");
    const column = geo?.columns.find((c) => c.name === "geometry");
    expect(column?.rowGroups).toEqual([
      { bbox: { xmin: 0, ymin: -2, xmax: 2, ymax: 0 }, types: null, source: "covering" },
      { bbox: { xmin: 3, ymin: -5, xmax: 6, ymax: -3 }, types: null, source: "covering" },
    ]);
  });

  it("prefers the native type and its statistics in GeoParquet 2.0", async () => {
    const geo = (await loadFixture("tests/fixtures/geo-v2.parquet")).model.geo;
    expect(geo?.version).toBe("2.0.0");
    expect(geo?.issues).toEqual([]);
    const [column] = geo?.columns ?? [];
    expect(column?.native?.type).toBe("GEOMETRY");
    expect(column?.geoKey?.encoding).toBe("WKB");
    expect(column?.rowGroups[1]).toMatchObject({ source: "statistics", types: [1, 2] });
  });

  it("reads native types with no geo key, in every crs form", async () => {
    const geo = (await loadFixture("tests/fixtures/geo-native.parquet")).model.geo;
    expect(geo?.version).toBeNull();
    const byName = Object.fromEntries((geo?.columns ?? []).map((c) => [c.name, c]));
    expect(byName.geom?.crs).toEqual({ kind: "code", label: "EPSG:3857" });
    expect(byName.geog).toMatchObject({ type: "GEOGRAPHY", edges: "spherical", crs: { kind: "default" } });
    expect(byName.unknown?.crs.kind).toBe("unknown");
    expect(byName.utm?.crs).toMatchObject({ kind: "projjson", label: "EPSG:32631" });
    expect(byName.geom?.rowGroups[0]).toEqual({
      bbox: { xmin: 0, xmax: 2, ymin: -2, ymax: 0 },
      types: [1],
      source: "statistics",
    });
    // Arrow doesn't write geospatial statistics for GEOGRAPHY.
    expect(byName.geog?.rowGroups.every((g) => g === null)).toBe(true);
  });
});

const geometry = (logical?: LogicalType): Leaf[] => [
  { path: "geometry", element: { name: "geometry", type: "BYTE_ARRAY", logical_type: logical } },
];
const footer = (geo: unknown, kv: { key: string; value: string }[] = []) =>
  ({
    row_groups: [{ columns: [{ meta_data: {} }] }],
    key_value_metadata: [...kv, ...(geo === undefined ? [] : [{ key: "geo", value: JSON.stringify(geo) }])],
  }) as unknown as FileMetaData;
const key = (column: Record<string, unknown>, version = "1.1.0") => ({
  version,
  primary_column: "geometry",
  columns: { geometry: { encoding: "WKB", geometry_types: [], ...column } },
});

describe("geo metadata checks", () => {
  it("reports a broken geo key instead of failing", () => {
    const broken = { key: "geo", value: "{not json" };
    expect(readGeo(footer(undefined, [broken]), geometry())?.issues).toEqual(["the geo key is not valid JSON"]);
    expect(readGeo(footer({ version: "1.0.0", columns: null }), geometry())?.issues).toEqual([
      "the geo key has no columns",
    ]);
    const covering = { bbox: { xmin: "bbox.xmin", ymin: "bbox.ymin", xmax: "bbox.xmax", ymax: "bbox.ymax" } };
    const geo = readGeo(footer(key({ covering })), geometry());
    expect(geo?.columns[0]?.rowGroups).toEqual([null]);
    expect(geo?.issues).toEqual(['"geometry" has a bbox covering whose paths aren\'t lists of column names']);
  });

  it("flags a geo crs that isn't PROJJSON, and PROJJSON that is null", () => {
    const geo = readGeo(footer(key({ crs: "EPSG:4326" })), geometry());
    expect(geo?.columns[0]?.crs).toEqual({ kind: "code", label: "EPSG:4326" });
    expect(geo?.issues).toEqual(['"geometry" has a geo crs that isn\'t PROJJSON']);
    expect(nativeCrs("projjson:k", [{ key: "k", value: "null" }])).toEqual({ kind: "projjson", label: "projjson:k" });
  });

  it("flags a native type and geo key that disagree", () => {
    const mercator = { id: { authority: "EPSG", code: 3857 } };
    expect(readGeo(footer(key({ crs: mercator })), geometry({ type: "GEOMETRY" }))?.issues).toEqual([
      '"geometry" is OGC:CRS84 in its GEOMETRY type but EPSG:3857 in the geo key',
    ]);
    const wgs84 = { id: { authority: "EPSG", code: 4326 } };
    expect(readGeo(footer(key({ crs: wgs84 })), geometry({ type: "GEOMETRY" }))?.issues).toEqual([]);
    // A geo key with no edges means planar, which a spherical GEOGRAPHY contradicts.
    expect(readGeo(footer(key({})), geometry({ type: "GEOGRAPHY" }))?.issues).toEqual([
      '"geometry" says edges are planar but its GEOGRAPHY type means spherical',
    ]);
    const karney = readGeo(footer(key({ edges: "karney" })), geometry({ type: "GEOGRAPHY", algorithm: "KARNEY" }));
    expect(karney?.columns[0]?.edges).toBe("karney");
    expect(karney?.issues).toEqual([]);
  });

  it("holds GeoParquet 2 to WKB and the native types", () => {
    const geo = readGeo(footer(key({ encoding: "point" }, "2.0.0")), geometry());
    expect(geo?.issues).toEqual([
      '"geometry" uses encoding point, and GeoParquet 2 allows only WKB',
      '"geometry" must use the native GEOMETRY or GEOGRAPHY type in GeoParquet 2.0.0',
    ]);
    const missing = readGeo(footer({ ...key({}, "2.0.0"), primary_column: "geom" }), []);
    expect(missing?.issues).toEqual([
      'primary_column "geom" is not in the geo columns',
      'geo column "geometry" is not in the schema',
    ]);
  });

  it("reads the geo bbox with or without z", () => {
    expect(readGeo(footer(key({ bbox: [1, 2, 0, 3, 4, 9] })), geometry())?.columns[0]?.bbox).toEqual({
      xmin: 1,
      ymin: 2,
      xmax: 3,
      ymax: 4,
    });
    const bad = readGeo(footer(key({ bbox: [1, 2, 3] })), geometry());
    expect(bad?.columns[0]?.bbox).toBeNull();
    expect(bad?.issues).toEqual(['"geometry" has a geo bbox that isn\'t 4, 6 or 8 numbers']);
  });
});

describe("crs and geometry type helpers", () => {
  it("resolves projjson:<key> from the file metadata", () => {
    const kv = [{ key: "my_crs", value: JSON.stringify({ name: "Local", id: { authority: "EPSG", code: 2056 } }) }];
    expect(nativeCrs("projjson:my_crs", kv)).toMatchObject({ kind: "projjson", label: "EPSG:2056", name: "Local" });
    expect(nativeCrs("projjson:missing", [])).toEqual({ kind: "projjson", label: "projjson:missing" });
    expect(nativeCrs("srid:4326", [])).toEqual({ kind: "srid", label: "srid:4326" });
  });

  it("names WKB type codes with their dimensions", () => {
    expect([1017, 5001].map(geometryTypeName)).toEqual(["type 1017", "type 5001"]);
    expect([1, 2, 3, 6, 7, 1001, 2003, 3006].map(geometryTypeName)).toEqual([
      "Point",
      "LineString",
      "Polygon",
      "MultiPolygon",
      "GeometryCollection",
      "Point Z",
      "Polygon M",
      "MultiPolygon ZM",
    ]);
  });
});
