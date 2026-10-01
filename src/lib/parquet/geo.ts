import type { BoundingBox, FileMetaData, KeyValue, LogicalType } from "hyparquet";
import type { Leaf } from "./model";
import { statsOf } from "./stats";

/** The native Parquet geospatial logical types. */
export type NativeGeoType = Extract<LogicalType, { type: "GEOMETRY" | "GEOGRAPHY" }>;

const EDGES = ["planar", "spherical", "vincenty", "thomas", "andoyer", "karney"] as const;
export type Edges = (typeof EDGES)[number];

type CoveringPath = [string, string];

/** One column of the GeoParquet `geo` key, as written. */
export interface GeoParquetColumn {
  encoding: string;
  geometry_types: string[];
  /** PROJJSON; `null` means unknown, absent means OGC:CRS84. Older writers sometimes put a string here. */
  crs?: Record<string, unknown> | string | null;
  edges?: Edges;
  orientation?: "counterclockwise";
  bbox?: number[];
  epoch?: number;
  covering?: { bbox?: { xmin: CoveringPath; ymin: CoveringPath; xmax: CoveringPath; ymax: CoveringPath } };
}

/** The GeoParquet `geo` key, as written. */
export interface GeoParquetKey {
  version: string;
  primary_column: string;
  columns: Record<string, GeoParquetColumn>;
}

/** A CRS resolved the way a GeoParquet 2.0 reader resolves it. */
export interface Crs {
  /** `default` is OGC:CRS84 because none was given; `unknown` is `srid:0` or a `null` GeoParquet crs. */
  kind: "default" | "unknown" | "code" | "srid" | "projjson";
  /** `EPSG:3857`, `OGC:CRS84`, `srid:4326`, or a PROJJSON id or name. */
  label: string;
  /** The CRS name from PROJJSON, e.g. `WGS 84 / UTM zone 31N`. */
  name?: string;
  projjson?: Record<string, unknown>;
}

export interface RowGroupGeo {
  bbox: BoundingBox;
  /** WKB geometry type codes, from native statistics only. */
  types: number[] | null;
  /** Native geospatial statistics, or min/max of the GeoParquet bbox covering columns. */
  source: "statistics" | "covering";
}

export interface GeoColumn {
  /** Leaf path, which for GeoParquet columns is the top-level column name. */
  name: string;
  /** The leaf holding the WKB, or null when the column isn't a single binary leaf. */
  leaf: number | null;
  type: "GEOMETRY" | "GEOGRAPHY";
  /** The logical type in the footer, or null for plain binary described only by the `geo` key. */
  native: NativeGeoType | null;
  /** The column's entry in the `geo` key. */
  geoKey: GeoParquetColumn | null;
  primary: boolean;
  /** From the native type when there is one, since GeoParquet 2.0 makes it the source of truth. */
  crs: Crs;
  edges: Edges;
  /** Per row group bounds, null where the file has neither statistics nor a covering. */
  rowGroups: (RowGroupGeo | null)[];
  /** The file-wide bbox from the `geo` key, which writers compute separately from the statistics. */
  bbox: BoundingBox | null;
}

export interface GeoModel {
  /** GeoParquet `version`, or null when only the native types mark the file as geospatial. */
  version: string | null;
  geoKey: GeoParquetKey | null;
  columns: GeoColumn[];
  /** Places where the file breaks the GeoParquet or Parquet geospatial spec. */
  issues: string[];
}

const DEFAULT_CRS: Crs = { kind: "default", label: "OGC:CRS84" };
const LON_LAT_CODES = new Set(["OGC:CRS84", "EPSG:4326", "EPSG:4979", "OGC:CRS83", "EPSG:4269", "srid:4326"]);
const WKB_TYPES = [
  "Geometry",
  "Point",
  "LineString",
  "Polygon",
  "MultiPoint",
  "MultiLineString",
  "MultiPolygon",
  "GeometryCollection",
];

/** Finds geometry columns from the native logical types and the `geo` key, or null if the file has neither. */
export function readGeo(metadata: FileMetaData, leaves: Leaf[]): GeoModel | null {
  const kv = metadata.key_value_metadata ?? [];
  const issues: string[] = [];
  const geo = parseGeoKey(kv, issues);
  const names = new Set([
    ...leaves.filter((l) => isNativeGeo(l.element.logical_type)).map((l) => l.path),
    ...Object.keys(geo?.columns ?? {}),
  ]);
  if (!names.size && !geo && !issues.length) return null;
  const major = geo ? Number.parseInt(geo.version, 10) : null;
  if (geo && !(geo.primary_column in geo.columns)) {
    issues.push(`primary_column "${geo.primary_column}" is not in the geo columns`);
  }

  const columns = [...names].map((name): GeoColumn => {
    const leaf = leaves.findIndex((l) => l.path === name);
    const logical = leaf >= 0 ? leaves[leaf]?.element.logical_type : undefined;
    const native = isNativeGeo(logical) ? logical : null;
    const meta = geo?.columns[name] ?? null;
    const inSchema = leaf >= 0 || leaves.some((l) => l.path.startsWith(`${name}.`));
    if (meta && !inSchema) issues.push(`geo column "${name}" is not in the schema`);
    if (meta && major !== null && major >= 2) {
      if (meta.encoding !== "WKB")
        issues.push(`"${name}" uses encoding ${meta.encoding}, and GeoParquet 2 allows only WKB`);
      if (!native && inSchema)
        issues.push(`"${name}" must use the native GEOMETRY or GEOGRAPHY type in GeoParquet ${geo?.version}`);
    }
    const edges = resolveEdges(name, native, meta, issues);
    const keyCrs = meta ? geoParquetCrs(name, meta, issues) : null;
    const crs = native ? nativeCrs(native.crs, kv) : (keyCrs ?? DEFAULT_CRS);
    if (native && keyCrs && !sameCrs(crs, keyCrs)) {
      issues.push(`"${name}" is ${crs.label} in its ${native.type} type but ${keyCrs.label} in the geo key`);
    }
    const rowGroups = metadata.row_groups.map((_, rg) => rowGroupGeo(name, metadata, leaves, rg, leaf, meta, issues));
    if (isLonLat(crs) && rowGroups.some((g) => g && !inLonLatRange(g.bbox))) {
      issues.push(`"${name}" has row group bboxes outside longitude/latitude range, so its statistics look wrong`);
    }
    return {
      name,
      leaf: leaf >= 0 ? leaf : null,
      type: native?.type ?? (edges === "planar" ? "GEOMETRY" : "GEOGRAPHY"),
      native,
      geoKey: meta,
      primary: geo?.primary_column === name,
      crs,
      edges,
      rowGroups,
      bbox: meta?.bbox === undefined ? null : geoKeyBbox(name, meta.bbox, issues),
    };
  });
  return { version: geo?.version ?? null, geoKey: geo, columns, issues: [...new Set(issues)] };
}

/** Reads a native logical type `crs` in any Parquet-core form: absent, `srid:`, `projjson:`, inline PROJJSON or a code. */
export function nativeCrs(crs: string | undefined, kv: KeyValue[]): Crs {
  if (!crs) return DEFAULT_CRS;
  if (crs === "srid:0") return { kind: "unknown", label: "srid:0" };
  if (crs.startsWith("srid:")) return { kind: "srid", label: crs };
  if (crs.startsWith("projjson:")) {
    const key = crs.slice("projjson:".length);
    const value = kv.find((entry) => entry.key === key)?.value;
    return (value ? projjsonCrs(value) : null) ?? { kind: "projjson", label: crs };
  }
  if (crs.trimStart().startsWith("{")) return projjsonCrs(crs) ?? { kind: "code", label: crs };
  return { kind: "code", label: crs };
}

/** Whether x and y are longitude and latitude. Parquet stores longitude first, whatever the CRS's axis order. */
export function isLonLat(crs: Crs): boolean {
  if (crs.kind === "default" || LON_LAT_CODES.has(crs.label)) return true;
  return /^Geographic(2D|3D)?CRS$/.test(String(crs.projjson?.type));
}

/**
 * How many row group bboxes overlap at least one other, which a spatial filter can't tell apart.
 * A bbox whose xmin is past its xmax wraps across the antimeridian. Touching counts as overlapping.
 */
export function overlappingBoxes(boxes: (BoundingBox | null)[]): number {
  // Sweep along x: a wrapping bbox covers everything from xmin up and everything up to xmax.
  const spans = boxes
    .flatMap((b, i) => {
      if (!b) return [];
      const xs =
        b.xmin <= b.xmax
          ? [[b.xmin, b.xmax]]
          : [
              [-Infinity, b.xmax],
              [b.xmin, Infinity],
            ];
      return xs.map(([lo = 0, hi = 0]) => ({ i, lo, hi, b }));
    })
    .sort((a, b) => a.lo - b.lo);
  const overlapping = new Set<number>();
  for (const [s, a] of spans.entries()) {
    for (let t = s + 1; t < spans.length; t++) {
      const b = spans[t];
      if (!b || b.lo > a.hi) break;
      if (a.i !== b.i && a.b.ymin <= b.b.ymax && b.b.ymin <= a.b.ymax) overlapping.add(a.i).add(b.i);
    }
  }
  return overlapping.size;
}

/** `Point`, `MultiPolygon Z`, `LineString ZM` for a WKB geometry type code. */
export function geometryTypeName(code: number): string {
  const base = WKB_TYPES[code % 1000];
  const dims = ["", " Z", " M", " ZM"][Math.floor(code / 1000)];
  return base === undefined || dims === undefined ? `type ${code}` : base + dims;
}

function isNativeGeo(t: LogicalType | undefined): t is NativeGeoType {
  return t?.type === "GEOMETRY" || t?.type === "GEOGRAPHY";
}

function parseGeoKey(kv: KeyValue[], issues: string[]): GeoParquetKey | null {
  const value = kv.find((entry) => entry.key === "geo")?.value;
  if (value === undefined) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    issues.push("the geo key is not valid JSON");
    return null;
  }
  const geo = parsed as Partial<GeoParquetKey> | null;
  if (!geo || typeof geo !== "object" || typeof geo.columns !== "object" || geo.columns === null) {
    issues.push("the geo key has no columns");
    return null;
  }
  if (typeof geo.version !== "string") issues.push("the geo key has no version");
  return { version: String(geo.version ?? ""), primary_column: String(geo.primary_column ?? ""), columns: geo.columns };
}

function projjsonCrs(json: string | Record<string, unknown>): Crs | null {
  let projjson: unknown;
  try {
    projjson = typeof json === "string" ? JSON.parse(json) : json;
  } catch {
    return null;
  }
  if (!isObject(projjson)) return null;
  const id = (projjson.id ?? (projjson.ids as unknown[] | undefined)?.[0]) as
    { authority?: string; code?: string | number } | undefined;
  const name = typeof projjson.name === "string" ? projjson.name : undefined;
  const label = id?.authority && id.code !== undefined ? `${id.authority}:${id.code}` : (name ?? "PROJJSON");
  return { kind: "projjson", label, name, projjson };
}

function geoParquetCrs(name: string, meta: GeoParquetColumn, issues: string[]): Crs {
  if (meta.crs === undefined) return DEFAULT_CRS;
  if (meta.crs === null) return { kind: "unknown", label: "unknown" };
  const crs = projjsonCrs(meta.crs);
  if (crs) return crs;
  issues.push(`"${name}" has a geo crs that isn't PROJJSON`);
  return { kind: "code", label: typeof meta.crs === "string" ? meta.crs : "invalid PROJJSON" };
}

/**
 * Whether two CRSs are the same, when that can be told from their codes. GeoParquet 2.0 says the native type
 * and the geo key must not disagree. Parquet stores longitude first either way, so EPSG:4326 matches OGC:CRS84.
 */
function sameCrs(a: Crs, b: Crs): boolean {
  const key = (crs: Crs) => {
    if (crs.kind === "default" || crs.kind === "unknown") return crs.kind === "default" ? "OGC:CRS84" : "unknown";
    if (crs.kind === "srid" || !/^[A-Za-z]+:\w+$/.test(crs.label)) return null;
    const label = crs.label.toUpperCase();
    return label === "EPSG:4326" ? "OGC:CRS84" : label;
  };
  const [ka, kb] = [key(a), key(b)];
  return ka === null || kb === null || ka === kb;
}

/** GEOMETRY edges are planar and GEOGRAPHY edges follow its algorithm; `edges` in the geo key must agree. */
function resolveEdges(
  name: string,
  native: NativeGeoType | null,
  meta: GeoParquetColumn | null,
  issues: string[],
): Edges {
  const declared = meta?.edges;
  if (declared !== undefined && !(EDGES as readonly string[]).includes(declared)) {
    issues.push(`"${name}" has unknown edges "${declared}"`);
  }
  if (!native) return declared ?? "planar";
  // The Parquet spec makes SPHERICAL the default when a GEOGRAPHY has no algorithm.
  const edges = native.type === "GEOMETRY" ? "planar" : ((native.algorithm ?? "SPHERICAL").toLowerCase() as Edges);
  // A geo key with no edges means planar, so it disagrees with a spherical GEOGRAPHY too.
  if (meta && (declared ?? "planar") !== edges) {
    issues.push(`"${name}" says edges are ${declared ?? "planar"} but its ${native.type} type means ${edges}`);
  }
  return edges;
}

function rowGroupGeo(
  name: string,
  metadata: FileMetaData,
  leaves: Leaf[],
  rg: number,
  leaf: number,
  meta: GeoParquetColumn | null,
  issues: string[],
): RowGroupGeo | null {
  const columns = metadata.row_groups[rg]?.columns ?? [];
  const stats = leaf >= 0 ? columns[leaf]?.meta_data?.geospatial_statistics : undefined;
  if (stats?.bbox) {
    // An empty list of types means the writer didn't say.
    const types = stats.geospatial_types?.length ? stats.geospatial_types : null;
    return { bbox: stats.bbox, types, source: "statistics" };
  }
  const covering = meta?.covering?.bbox;
  if (!covering) return null;
  const paths = [covering.xmin, covering.ymin, covering.xmax, covering.ymax] as unknown[];
  if (!paths.every((p) => Array.isArray(p) && p.every((s) => typeof s === "string"))) {
    issues.push(`"${name}" has a bbox covering whose paths aren't lists of column names`);
    return null;
  }
  const bound = (path: CoveringPath, side: "min" | "max") => {
    const at = leaves.findIndex((l) => l.path === path.join("."));
    const value = statsOf(columns[at]?.meta_data?.statistics)?.[side];
    // `+ 0` turns the -0 that float statistics often store as a min into 0.
    return typeof value === "number" || typeof value === "bigint" ? Number(value) + 0 : null;
  };
  const xmin = bound(covering.xmin, "min");
  const ymin = bound(covering.ymin, "min");
  const xmax = bound(covering.xmax, "max");
  const ymax = bound(covering.ymax, "max");
  if (xmin === null || ymin === null || xmax === null || ymax === null) return null;
  return { bbox: { xmin, ymin, xmax, ymax }, types: null, source: "covering" };
}

/** The `geo` key's bbox is [xmin, ymin, (zmin, (mmin,)) xmax, ymax, ...]; x and y come first in each half. */
function geoKeyBbox(name: string, bbox: unknown, issues: string[]): BoundingBox | null {
  const values = Array.isArray(bbox) ? (bbox as unknown[]) : [];
  const half = values.length / 2;
  const [xmin, ymin] = values;
  const [xmax, ymax] = values.slice(half);
  if (![2, 3, 4].includes(half) || ![xmin, ymin, xmax, ymax].every((v) => typeof v === "number")) {
    issues.push(`"${name}" has a geo bbox that isn't 4, 6 or 8 numbers`);
    return null;
  }
  return { xmin, ymin, xmax, ymax } as BoundingBox;
}

function inLonLatRange(b: BoundingBox): boolean {
  const lon = (x: number) => x >= -180 && x <= 180;
  const lat = (y: number) => y >= -90 && y <= 90;
  return lon(b.xmin) && lon(b.xmax) && lat(b.ymin) && lat(b.ymax);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
