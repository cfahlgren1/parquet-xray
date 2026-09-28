import type { Statistics } from "hyparquet";

export type StatValue = bigint | boolean | number | string | Date | Uint8Array;

export interface Bounds {
  min: StatValue;
  max: StatValue;
}

/** Min/max from column chunk statistics, preferring the newer `min_value`/`max_value` fields. */
export function statsOf(s: Statistics | undefined): Bounds | null {
  if (!s) return null;
  const min = s.min_value ?? s.min;
  const max = s.max_value ?? s.max;
  return min === undefined || max === undefined ? null : { min, max };
}

export function compare(a: StatValue, b: StatValue): number {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if ((typeof a === "bigint" || typeof a === "number") && (typeof b === "bigint" || typeof b === "number")) {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  const x = String(a);
  const y = String(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

export type Order = "single" | "missing" | "constant" | "sorted" | "overlapping";

/** How a column's min/max ranges line up across row groups, which decides whether range filters can skip any. */
export function orderOf(bounds: (Bounds | null)[]): Order {
  if (bounds.some((b) => !b)) return "missing";
  const known = bounds as Bounds[];
  if (known.length < 2) return "single";
  const [first] = known as [Bounds];
  if (known.every((b) => compare(b.min, first.min) === 0 && compare(b.max, first.max) === 0)) return "constant";
  const sorted = known.every((b, i) => i === 0 || compare(b.min, (known[i - 1] as Bounds).max) >= 0);
  return sorted ? "sorted" : "overlapping";
}

/** Maps a min/max value to 0..1 across all row groups: by value for numbers and dates, by rank otherwise. */
export function rangePositions(bounds: Bounds[]): ((v: StatValue) => number) | null {
  const sample = bounds[0]?.min;
  if (sample === undefined || sample instanceof Uint8Array) return null;
  const values = bounds.flatMap((b) => [b.min, b.max]);
  if (typeof sample === "number" || typeof sample === "bigint" || sample instanceof Date) {
    const nums = values.map(Number);
    const lo = Math.min(...nums);
    const hi = Math.max(...nums);
    return (v) => (hi > lo ? (Number(v) - lo) / (hi - lo) : 0);
  }
  const ranked = [...new Set(values.map(String))].sort(compare);
  const rank = new Map(ranked.map((v, i) => [v, i]));
  return (v) => (ranked.length > 1 ? (rank.get(String(v)) ?? 0) / (ranked.length - 1) : 0);
}
