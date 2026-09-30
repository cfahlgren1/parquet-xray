import proj4 from "proj4";
import type { BoundingBox } from "hyparquet";
import type { Crs } from "./geo";

/** Turns a column's x/y into longitude/latitude. Parquet always stores x first, whatever the CRS's axis order. */
export type ToLonLat = (x: number, y: number) => [number, number];

/** A MultiPolygon's coordinates in longitude/latitude. */
export type Outline = [number, number][][][];

const LON_LAT = new Set(["OGC:CRS84", "EPSG:4326", "EPSG:4979", "OGC:CRS83", "EPSG:4269", "srid:4326"]);
const WEB_MERCATOR = new Set(["EPSG:3857", "EPSG:900913", "EPSG:102100", "srid:3857"]);
const EARTH_RADIUS = 6378137;
/** Half the width of the world in Web Mercator meters: the antimeridian's x. */
const MERCATOR_EDGE = Math.PI * EARTH_RADIUS;
/** Points per bbox side when projecting, so straight projected edges come out curved where they should. */
const STEPS = 16;

const identity: ToLonLat = (x, y) => [x, y];
const fromWebMercator: ToLonLat = (x, y) => [
  (x / EARTH_RADIUS) * (180 / Math.PI),
  (2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 2) * (180 / Math.PI),
];

/**
 * How to place a CRS on a map, or null when that needs a CRS registry lookup or the CRS is unknown.
 * Longitude/latitude and Web Mercator are known by code; any other CRS needs its PROJJSON.
 */
export function lonLatProjector(crs: Crs): ToLonLat | null {
  if (crs.kind === "default") return identity;
  if (crs.kind === "unknown") return null;
  if (LON_LAT.has(crs.label)) return identity;
  if (WEB_MERCATOR.has(crs.label)) return fromWebMercator;
  if (crs.kind !== "projjson" || !crs.projjson) return null;
  // Degrees on any datum are close enough to WGS 84 to draw a box.
  if (/^Geographic(2D|3D)?CRS$/.test(String(crs.projjson.type))) return identity;
  try {
    const converter = proj4(crs.projjson as Parameters<typeof proj4>[0], "WGS84");
    return (x, y) => converter.forward([x, y]) as [number, number];
  } catch {
    return null;
  }
}

/**
 * A bbox as polygons in longitude/latitude. A box whose xmin is past its xmax crosses the antimeridian
 * and is split in two, as the Parquet spec defines. Returns null if any corner can't be converted, or
 * for a wrapping box in a CRS whose antimeridian isn't a known x.
 */
export function bboxOutline(bbox: BoundingBox, project: ToLonLat): Outline | null {
  const { xmin, xmax, ymin, ymax } = bbox;
  const edge = project === identity ? 180 : project === fromWebMercator ? MERCATOR_EDGE : null;
  let boxes: [number, number][] = [[xmin, xmax]];
  if (xmin > xmax) {
    if (edge === null) return null;
    boxes = [
      [xmin, edge],
      [-edge, xmax],
    ];
  }
  const steps = project === identity ? 1 : STEPS;
  const polygons: Outline = [];
  for (const [west, east] of boxes) {
    const ring: [number, number][] = [];
    const side = (x0: number, y0: number, x1: number, y1: number) => {
      for (let i = 0; i < steps; i++) ring.push(project(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps));
    };
    side(west, ymin, east, ymin);
    side(east, ymin, east, ymax);
    side(east, ymax, west, ymax);
    side(west, ymax, west, ymin);
    if (ring.some(([lon, lat]) => !Number.isFinite(lon) || !Number.isFinite(lat))) return null;
    ring.push(ring[0] as [number, number]);
    polygons.push([ring.map(([lon, lat]) => [clamp(lon, 180), clamp(lat, 90)])]);
  }
  return polygons;
}

/** [west, south, east, north] around outlines, with east past 180 when they cross the antimeridian. */
export function outlineBounds(outlines: Outline[]): [number, number, number, number] | null {
  // Loops rather than Math.min(...), which throws past about 65k points in some engines.
  let [west, south, east, north] = [Infinity, Infinity, -Infinity, -Infinity];
  // The same box with western longitudes shifted past 180, to go east across the antimeridian.
  let [shiftedWest, shiftedEast] = [Infinity, -Infinity];
  for (const outline of outlines) {
    for (const [lon, lat] of outline.flat(2)) {
      const shifted = lon < 0 ? lon + 360 : lon;
      [west, east, south, north] = [
        Math.min(west, lon),
        Math.max(east, lon),
        Math.min(south, lat),
        Math.max(north, lat),
      ];
      [shiftedWest, shiftedEast] = [Math.min(shiftedWest, shifted), Math.max(shiftedEast, shifted)];
    }
  }
  if (west > east) return null;
  // Only when that is clearly tighter: data spread over the whole world would otherwise tie and wrap.
  const wrapped = shiftedEast - shiftedWest < east - west - 1;
  return wrapped ? [shiftedWest, south, shiftedEast, north] : [west, south, east, north];
}

function clamp(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}
