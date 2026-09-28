import type { PieceKind } from "./parquet/model";

interface KindInfo {
  label: string;
  color: string;
  /** What this byte range is for, in one or two sentences. */
  what: string;
}

export const KINDS: Record<PieceKind, KindInfo> = {
  page: {
    label: "Data page",
    color: "#c3c8d0",
    what: "The unit a reader fetches and decompresses. Its byte range and first row come from the offset index.",
  },
  pages: {
    label: "Data pages",
    color: "#c3c8d0",
    what: "No page index, so this span is opaque: a reader has to read all of it to reach any row in it.",
  },
  dict: {
    label: "Dictionary page",
    color: "#e2e5ea",
    what: "Each distinct value stored once. The data pages after it store small integer ids that point here.",
  },
  columnIndex: {
    label: "Column index",
    color: "#d8b4fe",
    what: "Min, max and null count for every page of one column chunk, so readers can skip pages that can't match a filter.",
  },
  offsetIndex: {
    label: "Offset index",
    color: "#93c5fd",
    what: "Byte offset and first row of every page of one column chunk, so readers can jump straight to a row.",
  },
  bloom: {
    label: "Bloom filter",
    color: "#6ee7b7",
    what: 'Answers "is this value definitely absent?" so = and IN lookups can skip a whole row group.',
  },
  footer: {
    label: "Footer",
    color: "#4b5563",
    what: "Thrift-encoded FileMetaData: the schema, every row group and column chunk, their statistics, and the offsets of every other piece.",
  },
  footerLength: {
    label: "Footer length",
    color: "#1f2937",
    what: "4-byte little-endian length of the footer. Readers fetch the last 8 bytes first to find it.",
  },
  rowGroup: {
    label: "Row group",
    color: "#c3c8d0",
    what: "A horizontal slice of rows. Each column's values for these rows sit together as one column chunk.",
  },
  magic: { label: "PAR1 magic", color: "#111827", what: "4 bytes that open and close every Parquet file." },
};
