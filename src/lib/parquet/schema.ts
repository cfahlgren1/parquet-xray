import { parquetSchema } from "hyparquet";
import type { FileMetaData, SchemaElement, SchemaTree } from "hyparquet";

/** One line of the schema in Parquet's message syntax, with LIST wrappers folded into `type[]`. */
export interface SchemaLine {
  depth: number;
  keyword?: string;
  type?: string;
  name?: string;
  annotation?: string;
  punct: "{" | ";" | "}";
  /** Index of the leaf column this line declares. */
  leaf?: number;
}

export function schemaLines(metadata: FileMetaData): SchemaLine[] {
  const lines: SchemaLine[] = [];
  let leaf = 0;
  const walk = (node: SchemaTree, depth: number) => {
    const e = node.element;
    const repetition = (e.repetition_type ?? "REQUIRED").toLowerCase();
    let body = node;
    if (depth === 0) {
      lines.push({ depth, keyword: "message", name: e.name, punct: "{" });
    } else {
      let lists = 0;
      for (let next = listElement(body); next; next = listElement(body)) {
        body = next;
        lists += 1;
      }
      const group = body.children.length > 0;
      if (lists || !group) {
        // A list's element annotation goes inside the type; a plain column's goes after its name.
        const type = group ? "group" : physicalType(body.element) + (lists ? annotation(body.element) : "");
        lines.push({
          depth,
          keyword: repetition,
          type: type + "[]".repeat(lists),
          name: e.name,
          annotation: lists ? undefined : annotation(e) || undefined,
          punct: group ? "{" : ";",
          leaf: group ? undefined : leaf++,
        });
      } else {
        lines.push({
          depth,
          keyword: `${repetition} group`,
          name: e.name,
          annotation: annotation(e) || undefined,
          punct: "{",
        });
      }
    }
    for (const child of body.children) walk(child, depth + 1);
    if (body.children.length) lines.push({ depth, punct: "}" });
  };
  walk(parquetSchema(metadata), 0);
  return lines;
}

/** The element under a LIST-annotated group (3-level or legacy 2-level encoding), or null. */
function listElement(node: SchemaTree): SchemaTree | null {
  const e = node.element;
  if (e.logical_type?.type !== "LIST" && e.converted_type !== "LIST") return null;
  const [repeated] = node.children;
  if (node.children.length !== 1 || !repeated || repeated.element.repetition_type !== "REPEATED") return null;
  const legacy =
    repeated.children.length !== 1 || repeated.element.name === "array" || repeated.element.name.endsWith("_tuple");
  return legacy ? repeated : (repeated.children[0] ?? null);
}

export function physicalType(e: SchemaElement): string {
  if (e.type === "BYTE_ARRAY") return "binary";
  if (e.type === "FIXED_LEN_BYTE_ARRAY") return `fixed_len_byte_array(${e.type_length})`;
  return e.type?.toLowerCase() ?? "";
}

export function annotation(e: SchemaElement): string {
  const t = e.logical_type;
  if (t?.type === "TIMESTAMP") return ` (TIMESTAMP(${t.unit},${t.isAdjustedToUTC}))`;
  if (t?.type === "DECIMAL") return ` (DECIMAL(${t.precision},${t.scale}))`;
  if (t?.type === "INTEGER") return ` (INTEGER(${t.bitWidth},${t.isSigned}))`;
  if (t?.type) return ` (${t.type})`;
  return e.converted_type ? ` (${e.converted_type})` : "";
}
