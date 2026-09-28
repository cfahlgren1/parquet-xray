import { chunkAt, type ParquetModel } from "./model";
import { orderOf, statsOf } from "./stats";

export interface Check {
  label: string;
  passed: boolean;
  /** Column names the check passed for, if it is per column. */
  columns: string[];
  /** One sentence on what this means for readers. */
  detail: string;
}

const MAX_DETAIL_NAMES = 8;

/** Whether readers can skip data in this file: by row group min/max, page index, bloom filters, and dedupe on Xet. */
export function readEfficiency(model: ParquetModel): Check[] {
  const { rowGroups, leaves, pieces, metadata } = model;
  const sorted = leaves
    .filter((_, leaf) => orderOf(rowGroups.map((g) => statsOf(chunkAt(g, leaf).meta.statistics))) === "sorted")
    .map((l) => l.path);
  const bloom = [...new Set(pieces.flatMap((p) => (p.kind === "bloom" ? [leaves[p.chunk.leaf]?.path ?? ""] : [])))];
  const cdc = (metadata.key_value_metadata ?? []).some((kv) => kv.key.includes("content_defined_chunking"));

  return [
    {
      label: "Sorted",
      passed: sorted.length > 0,
      columns: sorted,
      detail: sorted.length
        ? `Range filters on ${listNames(sorted)} skip row groups: their min/max don't overlap.`
        : rowGroups.length < 2
          ? "One row group, so every read scans it."
          : "No column has non-overlapping min/max across row groups, so range filters read every row group.",
    },
    {
      label: "Page index",
      passed: model.hasPageIndex,
      columns: [],
      detail: model.hasPageIndex
        ? "Readers can seek to single pages and skip pages by min/max."
        : "Reaching a row means reading its whole column chunk.",
    },
    {
      label: "Bloom",
      passed: bloom.length > 0,
      columns: bloom,
      detail: bloom.length
        ? `= and IN lookups on ${listNames(bloom)} skip row groups.`
        : "No bloom filters: point lookups rely on min/max only.",
    },
    {
      label: "CDC",
      passed: cdc,
      columns: [],
      detail: cdc
        ? "Written with content-defined chunking, so edited versions dedupe well on Xet."
        : "Not marked as written with content-defined chunking.",
    },
  ];
}

/** Badge text: the first column plus a count, so files with many matching columns keep a one-line badge. */
export function summarizeNames(names: string[]): string {
  if (names.length <= 2 && names.join(", ").length <= 32) return names.join(", ");
  return `${names[0]} +${names.length - 1}`;
}

function listNames(names: string[]): string {
  if (names.length <= MAX_DETAIL_NAMES) return names.join(", ");
  return `${names.slice(0, MAX_DETAIL_NAMES).join(", ")} and ${(names.length - MAX_DETAIL_NAMES).toLocaleString("en-US")} more`;
}
