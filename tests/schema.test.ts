import { describe, expect, it } from "vitest";
import { schemaLines, type SchemaLine } from "../src/lib/parquet/schema";
import { loadFixture } from "./helpers";

const render = (line: SchemaLine) =>
  `${"  ".repeat(line.depth)}${[line.keyword, line.type, line.name].filter(Boolean).join(" ")}${line.annotation ?? ""}${line.punct === "}" ? "}" : ` ${line.punct}`}`.replace(
    / ;$/,
    ";",
  );

describe("schemaLines", async () => {
  const { model } = await loadFixture("tests/fixtures/nested.parquet");
  const lines = schemaLines(model.metadata);

  it("folds LIST wrappers into [] and keeps structs as groups", () => {
    expect(lines.map(render)).toEqual([
      "message schema {",
      "  optional int64 id;",
      "  optional binary city (STRING);",
      "  optional binary (STRING)[] tags;",
      "  optional double[][][] stats/observation.images.head_stereo_left/q50;",
      "  optional group point {",
      "    optional int32 x;",
      "    optional int32 y;",
      "  }",
      "  optional group[] points {",
      "    optional int32 x;",
      "    optional int32 y;",
      "  }",
      "}",
    ]);
  });

  it("numbers leaf lines in the same order as the column chunks", () => {
    const leaves = lines.filter((l) => l.leaf !== undefined).map((l) => [l.leaf, l.name]);
    expect(leaves.map(([leaf]) => leaf)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(model.leaves.map((l) => l.path)).toEqual([
      "id",
      "city",
      "tags.list.element",
      "stats/observation.images.head_stereo_left/q50.list.element.list.element.list.element",
      "point.x",
      "point.y",
      "points.list.element.x",
      "points.list.element.y",
    ]);
  });
});
