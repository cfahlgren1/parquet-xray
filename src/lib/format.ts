import type { SchemaElement } from "hyparquet";
import type { StatValue } from "./parquet/stats";

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(n < 100 * 1024 ** 2 ? 1 : 0)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function formatNumber(n: number | bigint): string {
  return n.toLocaleString("en-US");
}

export function percent(part: number, whole: number): string {
  const v = (part / whole) * 100;
  if (v > 0 && v < 0.01) return "<0.01%";
  return `${v < 0.1 ? v.toFixed(2) : v.toFixed(1)}%`;
}

export function rowRange(firstRow: number, numRows: number): string {
  return `${formatNumber(firstRow)} – ${formatNumber(firstRow + numRows - 1)}`;
}

const MAX_STRING = 60;
const MAX_BYTES = 16;

/** A statistics value as a reader would write it: quoted strings, trimmed floats, hex bytes. */
export function formatValue(v: StatValue | undefined | null, element?: SchemaElement): string {
  if (v === undefined || v === null) return "–";
  if (v instanceof Date) {
    return v
      .toISOString()
      .replace("T", " ")
      .replace(/(:00)?\.000Z$/, "")
      .replace(/Z$/, "");
  }
  if (typeof v === "bigint") return formatNumber(v);
  // `+ 0` turns -0, which float stats often store as a min, into 0.
  if (typeof v === "number") return Number.isInteger(v) ? formatNumber(v + 0) : String(+v.toPrecision(6));
  if (v instanceof Uint8Array) {
    const hex = [...v.slice(0, MAX_BYTES)].map((b) => b.toString(16).padStart(2, "0")).join("");
    return `0x${hex}${v.length > MAX_BYTES ? "…" : ""}`;
  }
  if (typeof v === "string") {
    const isText = element?.logical_type?.type === "STRING" || element?.converted_type === "UTF8";
    return isText ? JSON.stringify(v.length > MAX_STRING ? `${v.slice(0, MAX_STRING)}…` : v) : v;
  }
  return String(v);
}
