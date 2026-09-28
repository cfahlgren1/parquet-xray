import type { Piece } from "./parquet/model";
import { KINDS } from "./kinds";

/** Muted hues cycled per column; a dictionary page is a lighter tint of its column's data pages. */
const HUES = [215, 28, 150, 330, 262, 45, 180, 0];

/** A column's color. With a column selected, the others fade to gray so it stands out in the file map. */
export function leafColor(leaf: number, selectedLeaf: number | null, dict = false): string {
  const hue = HUES[leaf % HUES.length];
  if (selectedLeaf === null) return `hsl(${hue} 45% ${dict ? 87 : 74}%)`;
  if (leaf === selectedLeaf) return `hsl(${hue} 60% ${dict ? 80 : 60}%)`;
  return dict ? "#eef0f3" : "#dfe2e6";
}

export function pieceColor(p: Piece, selectedLeaf: number | null): string {
  if (p.kind === "page" || p.kind === "pages" || p.kind === "dict") {
    return leafColor(p.chunk.leaf, selectedLeaf, p.kind === "dict");
  }
  return KINDS[p.kind].color;
}
