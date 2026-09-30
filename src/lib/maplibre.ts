// Loaded on demand by the geometry map, so MapLibre only downloads for files with geometry columns.
import { setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

// Bundlers can't find MapLibre 6's worker from import.meta.url, so point it at Vite's emitted chunk.
setWorkerUrl(workerUrl);

export { Map, Marker, NavigationControl } from "maplibre-gl";
