import { formatBytes, formatNumber, formatValue, percent, rowRange } from "./format";
import { KINDS } from "./kinds";
import { leafAt, type ParquetModel, type Piece } from "./parquet/model";
import { statsOf } from "./parquet/stats";

export interface PopoverContent {
  title: string;
  /** Column path, for pieces that belong to one column. */
  column: string | null;
  where: string;
  what: string;
  rows: [string, string][];
}

/** The details shown when hovering or tapping a piece of the file. */
export function describePiece(p: Piece, model: ParquetModel): PopoverContent {
  const leaf = "chunk" in p ? leafAt(model.leaves, p.chunk.leaf) : null;
  const rows: [string, string][] = [
    ["Bytes", `${formatNumber(p.start)} – ${formatNumber(p.end)}`],
    ["Size", `${formatBytes(p.end - p.start)} · ${percent(p.end - p.start, model.fileSize)} of file`],
  ];

  switch (p.kind) {
    case "page": {
      const stats = p.chunk.index?.stats;
      rows.push(["Rows", rowRange(p.firstRow, p.numRows)]);
      if (stats && !stats.null_pages[p.page]) {
        rows.push(["min", formatValue(stats.min_values[p.page], leaf?.element)]);
        rows.push(["max", formatValue(stats.max_values[p.page], leaf?.element)]);
      }
      const nulls = stats?.null_counts?.[p.page];
      if (nulls !== undefined) rows.push(["Nulls", formatNumber(nulls)]);
      rows.push(["Codec", p.chunk.meta.codec]);
      break;
    }
    case "pages": {
      const { meta } = p.chunk;
      const bounds = statsOf(meta.statistics);
      rows.push(
        ["Rows", rowRange(p.firstRow, p.numRows)],
        ["Uncompressed", formatBytes(Number(meta.total_uncompressed_size))],
        ["Encodings", meta.encodings.join(", ")],
        ["Codec", meta.codec],
      );
      if (bounds)
        rows.push(["min", formatValue(bounds.min, leaf?.element)], ["max", formatValue(bounds.max, leaf?.element)]);
      break;
    }
    case "dict":
      rows.push(["Encodings", p.chunk.meta.encodings.join(", ")], ["Codec", p.chunk.meta.codec]);
      break;
    case "columnIndex": {
      const stats = p.chunk.index?.stats;
      if (stats) rows.push(["Pages", formatNumber(stats.min_values.length)], ["Order", stats.boundary_order]);
      break;
    }
    case "offsetIndex": {
      const offsets = p.chunk.index?.offsets;
      if (offsets) rows.push(["Pages", formatNumber(offsets.page_locations.length)]);
      break;
    }
    case "rowGroup": {
      const g = p.group;
      const uncompressed = g.chunks.reduce((sum, c) => sum + Number(c.meta.total_uncompressed_size), 0);
      rows.push(
        ["Rows", rowRange(g.firstRow, g.numRows)],
        ["Columns", formatNumber(g.chunks.length)],
        ["Uncompressed", formatBytes(uncompressed)],
      );
      break;
    }
    case "footer": {
      const groups = model.metadata.row_groups.length;
      rows.push(
        ["Row groups", formatNumber(groups)],
        ["Column chunks", formatNumber(groups * model.leaves.length)],
        ["Version", String(model.metadata.version)],
      );
      break;
    }
    case "footerLength":
      rows.push(["Value", `${formatNumber(p.value)} bytes`]);
      break;
    case "bloom":
    case "magic":
      break;
    default: {
      const unhandled: never = p;
      throw new Error(`unhandled piece ${JSON.stringify(unhandled)}`);
    }
  }

  return {
    title: p.kind === "page" ? `Data page ${p.page}` : KINDS[p.kind].label,
    column: leaf?.path ?? null,
    where: whereOf(p),
    what: KINDS[p.kind].what,
    rows,
  };
}

function whereOf(p: Piece): string {
  if (p.kind === "rowGroup") return `row_group[${p.group.rg}]`;
  if (p.kind === "page") return `row_group[${p.chunk.rg}] · page ${p.page}`;
  if ("chunk" in p) return `row_group[${p.chunk.rg}]`;
  return p.kind === "footer" || p.kind === "footerLength" || p.start > 0 ? "end of file" : "start of file";
}

/** The row group a click on this piece would open, if any. */
export function rowGroupOf(p: Piece): number | null {
  if (p.kind === "rowGroup") return p.group.rg;
  return "chunk" in p ? p.chunk.rg : null;
}
