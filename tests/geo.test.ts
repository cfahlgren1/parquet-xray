import { describe, expect, it } from "vitest";
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
