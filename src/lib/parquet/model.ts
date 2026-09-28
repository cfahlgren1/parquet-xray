import { parquetSchema, readColumnIndex, readOffsetIndex } from "hyparquet";
import type { AsyncBuffer, ColumnIndex, ColumnMetaData, FileMetaData, OffsetIndex, SchemaElement } from "hyparquet";

/** Skip page indexes spread over more than this; fetching them would cost more than the footer. */
const MAX_INDEX_FETCH = 32 * 1024 * 1024;

export interface Leaf {
  element: SchemaElement;
  /** Dotted path from the root, e.g. `tasks.list.element`. */
  path: string;
}

export interface ChunkIndex {
  offsets: OffsetIndex | null;
  stats: ColumnIndex | null;
}

export interface Chunk {
  rg: number;
  leaf: number;
  start: number;
  end: number;
  meta: ColumnMetaData;
  index: ChunkIndex | null;
  /** The chunk's dictionary and data pages, in file order. */
  parts: (DictPiece | PagePiece | PagesPiece)[];
}

export interface RowGroupInfo {
  rg: number;
  numRows: number;
  firstRow: number;
  chunks: Chunk[];
  start: number;
  end: number;
}

interface Span {
  start: number;
  end: number;
}

export interface DictPiece extends Span {
  kind: "dict";
  chunk: Chunk;
}
/** One data page, known from the offset index. */
export interface PagePiece extends Span {
  kind: "page";
  chunk: Chunk;
  page: number;
  firstRow: number;
  numRows: number;
}
/** All data pages of a chunk as one opaque span, when there is no offset index. */
export interface PagesPiece extends Span {
  kind: "pages";
  chunk: Chunk;
  firstRow: number;
  numRows: number;
}
export interface IndexPiece extends Span {
  kind: "columnIndex" | "offsetIndex" | "bloom";
  chunk: Chunk;
}
export interface FooterPiece extends Span {
  kind: "magic" | "footer";
}
export interface FooterLengthPiece extends Span {
  kind: "footerLength";
  value: number;
}
export interface RowGroupPiece extends Span {
  kind: "rowGroup";
  group: RowGroupInfo;
}

export type Piece = DictPiece | PagePiece | PagesPiece | IndexPiece | FooterPiece | FooterLengthPiece | RowGroupPiece;
export type PieceKind = Piece["kind"];

export interface ParquetModel {
  name: string;
  fileSize: number;
  metadata: FileMetaData;
  leaves: Leaf[];
  rowGroups: RowGroupInfo[];
  /** Every byte range we can place, sorted by offset. */
  pieces: Piece[];
  footerStart: number;
  footerLength: number;
  /** Where the page indexes, bloom filters and footer begin. */
  tailStart: number;
  /** Compressed bytes per leaf column across all row groups. */
  leafBytes: number[];
  hasPageIndex: boolean;
}

export function leafColumns(metadata: FileMetaData): Leaf[] {
  const leaves: Leaf[] = [];
  const walk = (node: ReturnType<typeof parquetSchema>, path: string[]) => {
    if (!node.children.length) leaves.push({ element: node.element, path: path.join(".") });
    for (const child of node.children) walk(child, [...path, child.element.name]);
  };
  walk(parquetSchema(metadata), []);
  return leaves;
}

/** Fetches every column and offset index in one request; writers put them together before the footer. */
export async function readIndexes(file: AsyncBuffer, metadata: FileMetaData): Promise<ChunkIndex[][] | null> {
  const ranges: [number, number][] = [];
  for (const rowGroup of metadata.row_groups) {
    for (const column of rowGroup.columns) {
      if (column.offset_index_offset !== undefined && column.offset_index_length !== undefined) {
        ranges.push([Number(column.offset_index_offset), column.offset_index_length]);
      }
      if (column.column_index_offset !== undefined && column.column_index_length !== undefined) {
        ranges.push([Number(column.column_index_offset), column.column_index_length]);
      }
    }
  }
  if (!ranges.length) return null;
  const start = Math.min(...ranges.map(([offset]) => offset));
  const end = Math.max(...ranges.map(([offset, length]) => offset + length));
  if (end - start > MAX_INDEX_FETCH) return null;
  const buffer = await file.slice(start, end);
  const reader = (offset: bigint, length: number) => ({
    view: new DataView(buffer, Number(offset) - start, length),
    offset: 0,
  });
  const leaves = leafColumns(metadata);
  return metadata.row_groups.map((rowGroup) =>
    rowGroup.columns.map((column, leaf) => ({
      offsets:
        column.offset_index_offset !== undefined && column.offset_index_length !== undefined
          ? readOffsetIndex(reader(column.offset_index_offset, column.offset_index_length))
          : null,
      stats:
        column.column_index_offset !== undefined && column.column_index_length !== undefined
          ? readColumnIndex(
              reader(column.column_index_offset, column.column_index_length),
              leafAt(leaves, leaf).element,
            )
          : null,
    })),
  );
}

export function buildModel(
  name: string,
  fileSize: number,
  metadata: FileMetaData,
  indexes: ChunkIndex[][] | null,
): ParquetModel {
  const leaves = leafColumns(metadata);
  const footerLength = metadata.metadata_length;
  const footerStart = fileSize - 8 - footerLength;
  const pieces: Piece[] = [{ kind: "magic", start: 0, end: 4 }];
  // Bloom filter lengths are optional; those without one run until the next piece.
  const openEnded = new Set<Piece>();
  let firstRow = 0;

  const rowGroups = metadata.row_groups.map((rowGroup, rg): RowGroupInfo => {
    const numRows = Number(rowGroup.num_rows);
    const chunks = rowGroup.columns.map((column, leaf): Chunk => {
      const meta = column.meta_data;
      if (!meta) throw new Error(`row group ${rg}, column ${leaf} can't be read: encrypted files aren't supported`);
      const dataStart = Number(meta.data_page_offset);
      const dictStart = meta.dictionary_page_offset !== undefined ? Number(meta.dictionary_page_offset) : null;
      const start = dictStart ?? dataStart;
      const end = start + Number(meta.total_compressed_size);
      const chunk: Chunk = { rg, leaf, start, end, meta, index: indexes?.[rg]?.[leaf] ?? null, parts: [] };

      if (dictStart !== null && dataStart > dictStart)
        pieces.push({ kind: "dict", start: dictStart, end: dataStart, chunk });
      const locations = chunk.index?.offsets?.page_locations;
      if (locations?.length) {
        locations.forEach((loc, page) => {
          const next = locations[page + 1];
          const pageRow = Number(loc.first_row_index);
          pieces.push({
            kind: "page",
            start: Number(loc.offset),
            end: Number(loc.offset) + loc.compressed_page_size,
            chunk,
            page,
            firstRow: firstRow + pageRow,
            numRows: (next ? Number(next.first_row_index) : numRows) - pageRow,
          });
        });
      } else {
        pieces.push({ kind: "pages", start: dataStart, end, chunk, firstRow, numRows });
      }
      if (column.column_index_offset !== undefined && column.column_index_length !== undefined) {
        const at = Number(column.column_index_offset);
        pieces.push({ kind: "columnIndex", start: at, end: at + column.column_index_length, chunk });
      }
      if (column.offset_index_offset !== undefined && column.offset_index_length !== undefined) {
        const at = Number(column.offset_index_offset);
        pieces.push({ kind: "offsetIndex", start: at, end: at + column.offset_index_length, chunk });
      }
      if (meta.bloom_filter_offset !== undefined) {
        const at = Number(meta.bloom_filter_offset);
        const bloom: Piece = { kind: "bloom", start: at, end: at + (meta.bloom_filter_length ?? 0), chunk };
        if (!meta.bloom_filter_length) openEnded.add(bloom);
        pieces.push(bloom);
      }
      return chunk;
    });
    const group = {
      rg,
      numRows,
      firstRow,
      chunks,
      start: Math.min(...chunks.map((c) => c.start)),
      end: Math.max(...chunks.map((c) => c.end)),
    };
    firstRow += numRows;
    return group;
  });

  pieces.push(
    { kind: "footer", start: footerStart, end: fileSize - 8 },
    { kind: "footerLength", start: fileSize - 8, end: fileSize - 4, value: footerLength },
    { kind: "magic", start: fileSize - 4, end: fileSize },
  );
  pieces.sort((a, b) => a.start - b.start);
  pieces.forEach((piece, i) => {
    if (openEnded.has(piece)) piece.end = pieces[i + 1]?.start ?? footerStart;
    if (piece.kind === "dict" || piece.kind === "page" || piece.kind === "pages") piece.chunk.parts.push(piece);
  });

  const indexStarts = pieces
    .filter((p) => p.kind === "columnIndex" || p.kind === "offsetIndex" || p.kind === "bloom")
    .map((p) => p.start);
  const leafBytes = leaves.map((_, leaf) =>
    rowGroups.reduce((sum, g) => sum + Number(chunkAt(g, leaf).meta.total_compressed_size), 0),
  );
  return {
    name,
    fileSize,
    metadata,
    leaves,
    rowGroups,
    pieces,
    footerStart,
    footerLength,
    tailStart: Math.min(footerStart, ...indexStarts),
    leafBytes,
    hasPageIndex: pieces.some((p) => p.kind === "offsetIndex"),
  };
}

export function leafAt(leaves: Leaf[], leaf: number): Leaf {
  const found = leaves[leaf];
  if (!found) throw new Error(`no leaf column ${leaf}`);
  return found;
}

export function chunkAt(group: RowGroupInfo, leaf: number): Chunk {
  const found = group.chunks[leaf];
  if (!found) throw new Error(`row group ${group.rg} has no column ${leaf}`);
  return found;
}
