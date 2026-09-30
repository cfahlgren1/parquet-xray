<script lang="ts">
  import type { GeoJSONSource, Map as MapLibre, MapLayerMouseEvent, Marker, StyleSpecification } from "maplibre-gl";
  import { onMount } from "svelte";
  import { formatNumber, formatValue } from "../lib/format";
  import { getInspector } from "../lib/inspector.svelte";
  import { geometryTypeName, type GeoColumn } from "../lib/parquet/geo";
  import type * as LonLat from "../lib/parquet/lonlat";

  /** Free vector tiles with no key; OpenFreeMap's style carries the OpenStreetMap attribution. */
  const STYLE = "https://tiles.openfreemap.org/styles/positron";
  /** Drawn instead when the basemap can't load, so the boxes still show. */
  const BLANK: StyleSpecification = {
    version: 8,
    sources: {},
    layers: [{ id: "background", type: "background", paint: { "background-color": "#f9fafb" } }],
  };

  const inspector = getInspector();
  const { model } = inspector;
  const geo = model.geo;
  const columns = geo?.columns ?? [];
  const issues = geo?.issues ?? [];

  let columnName = $state(columns.find((c) => c.primary)?.name ?? columns[0]?.name ?? "");
  let globe = $state(true);
  let container = $state<HTMLDivElement>();
  let map = $state.raw<MapLibre | null>(null);
  let label = $state.raw<Marker | null>(null);
  let lonlat = $state.raw<typeof LonLat | null>(null);
  let failed = $state<string | null>(null);
  let basemapFailed = $state(false);

  const column = $derived(columns.find((c) => c.name === columnName) ?? null);
  const project = $derived(column && lonlat ? lonlat.lonLatProjector(column.crs) : null);
  const placed = $derived(column?.rowGroups.filter(Boolean).length ?? 0);
  const source = $derived(column?.rowGroups.find(Boolean)?.source ?? null);
  const focusRg = $derived(inspector.hoveredRg?.rg ?? inspector.selectedRg);
  const focus = $derived(focusRg === null ? null : (column?.rowGroups[focusRg] ?? null));

  const rowGroupFeatures = $derived.by(() => {
    if (!column || !lonlat || !project) return [];
    const { bboxOutline } = lonlat;
    return column.rowGroups.flatMap((g, rg) => {
      const outline = g && bboxOutline(g.bbox, project);
      return outline ? [{ type: "Feature" as const, id: rg, properties: { rg }, geometry: multi(outline) }] : [];
    });
  });
  const fileOutline = $derived(column?.bbox && project && lonlat ? lonlat.bboxOutline(column.bbox, project) : null);
  const fileFeatures = $derived(
    fileOutline ? [{ type: "Feature" as const, properties: {}, geometry: multi(fileOutline) }] : [],
  );

  onMount(() => {
    let destroyed = false;
    let instance: MapLibre | undefined;
    const hover = matchMedia("(hover: hover)");
    void Promise.all([import("../lib/maplibre"), import("../lib/parquet/lonlat")])
      .then(([maplibregl, lonlatModule]) => {
        if (destroyed || !container) return;
        lonlat = lonlatModule;
        instance = new maplibregl.Map({ container, style: STYLE, center: [0, 20], zoom: 1.2 });
        const created = instance;
        created.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        created.on("error", () => {
          // Only a style that never loaded matters here; a missing tile later just leaves a gap.
          if (map || basemapFailed) return;
          basemapFailed = true;
          created.setStyle(BLANK);
        });
        created.on("style.load", () => {
          if (destroyed) return;
          created.setProjection({ type: globe ? "globe" : "mercator" });
          addLayers(created, hover);
          label = new maplibregl.Marker({ element: labelElement(), anchor: "bottom" });
          map = created;
        });
      })
      .catch((error: unknown) => (failed = error instanceof Error ? error.message : String(error)));
    return () => {
      destroyed = true;
      instance?.remove();
    };
  });

  function addLayers(instance: MapLibre, hover: MediaQueryList) {
    const empty = { type: "FeatureCollection" as const, features: [] };
    const css = getComputedStyle(document.documentElement);
    const accent = css.getPropertyValue("--color-accent").trim();
    const extent = css.getPropertyValue("--color-extent").trim();
    instance.addSource("file", { type: "geojson", data: empty });
    instance.addSource("rowGroups", { type: "geojson", data: empty });
    instance.addLayer({
      id: "rowGroups-fill",
      type: "fill",
      source: "rowGroups",
      paint: {
        "fill-color": accent,
        "fill-opacity": ["case", ["boolean", ["feature-state", "focus"], false], 0.35, 0.08],
      },
    });
    instance.addLayer({
      id: "rowGroups-line",
      type: "line",
      source: "rowGroups",
      paint: {
        "line-color": accent,
        "line-width": ["case", ["boolean", ["feature-state", "focus"], false], 2.2, 0.8],
      },
    });
    instance.addLayer({
      id: "file",
      type: "line",
      source: "file",
      paint: { "line-color": extent, "line-width": 1.8, "line-dasharray": [3, 2] },
    });
    instance.on("mousemove", "rowGroups-fill", (event) => {
      // Taps send a mousemove too, and nothing would ever clear the hover they leave behind.
      if (!hover.matches) return;
      instance.getCanvas().style.cursor = "pointer";
      inspector.hoveredRg = model.rowGroups[pick(event) ?? -1] ?? null;
    });
    instance.on("mouseleave", "rowGroups-fill", () => {
      instance.getCanvas().style.cursor = "";
      inspector.hoveredRg = null;
    });
    instance.on("click", "rowGroups-fill", (event) => {
      const rg = pick(event);
      if (rg !== null) inspector.openRowGroup(rg);
    });
  }

  function labelElement(): HTMLElement {
    const element = document.createElement("div");
    element.className =
      "pointer-events-none mb-0.5 rounded bg-surface/90 px-1 font-sans text-[10.5px] font-medium text-extent";
    element.textContent = "geo key bbox";
    return element;
  }

  /** The smallest box under the pointer, so row groups nested inside bigger ones can still be picked. */
  function pick(event: MapLayerMouseEvent): number | null {
    const rgs = (event.features ?? []).map((f) => Number(f.properties.rg));
    const area = (rg: number) => {
      const b = column?.rowGroups[rg]?.bbox;
      if (!b) return Infinity;
      // A box with xmin > xmax wraps across the antimeridian, so its width goes the other way round.
      const width = b.xmin > b.xmax ? b.xmax - b.xmin + 360 : b.xmax - b.xmin;
      return width * (b.ymax - b.ymin);
    };
    return rgs.sort((a, b) => area(a) - area(b))[0] ?? null;
  }

  $effect(() => {
    if (!map || !lonlat) return;
    // The container is hidden while a column can't be placed, which leaves the canvas at zero size.
    if (project) map.resize();
    (map.getSource("rowGroups") as GeoJSONSource).setData({ type: "FeatureCollection", features: rowGroupFeatures });
    (map.getSource("file") as GeoJSONSource).setData({ type: "FeatureCollection", features: fileFeatures });
    const fileBounds = fileOutline && lonlat.outlineBounds([fileOutline]);
    // The middle of the top edge stays on the visible side of the globe, unlike a corner of a world-wide box.
    if (label && fileBounds) label.setLngLat([(fileBounds[0] + fileBounds[2]) / 2, fileBounds[3]]).addTo(map);
    else label?.remove();
    const bounds = lonlat.outlineBounds([...rowGroupFeatures, ...fileFeatures].map((f) => f.geometry.coordinates));
    if (!bounds) return;
    const [west, south, east, north] = bounds;
    // Fitting a near-global extent zooms past the whole globe; show all of it instead.
    if (east - west > 180 || north - south > 120) map.jumpTo({ center: [(west + east) / 2, 0], zoom: 1.2 });
    else map.fitBounds(bounds, { padding: 32, maxZoom: 19, duration: 0 });
  });

  $effect(() => {
    if (!map) return;
    const instance = map;
    const rg = focusRg;
    instance.removeFeatureState({ source: "rowGroups" });
    if (rg !== null && rowGroupFeatures.some((f) => f.id === rg)) {
      instance.setFeatureState({ source: "rowGroups", id: rg }, { focus: true });
    }
  });

  $effect(() => {
    map?.setProjection({ type: globe ? "globe" : "mercator" });
  });

  function multi(coordinates: LonLat.Outline) {
    return { type: "MultiPolygon" as const, coordinates };
  }

  function range(min: number | undefined, max: number | undefined): string {
    return `${formatValue(min)} to ${formatValue(max)}`;
  }

  function describe(c: GeoColumn): string {
    const parts = [c.native ? c.native.type : "WKB binary", c.crs.name ?? c.crs.label];
    if (c.type === "GEOGRAPHY") parts.push(`${c.edges} edges`);
    return parts.join(" · ");
  }
</script>

{#if column || issues.length}
  <section class="rounded-xl border border-solid border-line px-4 py-3.5 compact:p-3" aria-label="Geometry map">
    {#if column}
      <div class="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-faint">
        <b class="font-medium text-secondary">Geometry</b>
        {#if columns.length > 1}
          <select
            class="rounded-md border border-solid border-line bg-surface px-1.5 py-0.5 font-mono text-[11.5px] text-secondary"
            aria-label="Geometry column"
            bind:value={columnName}
          >
            {#each columns as c (c.name)}<option value={c.name}>{c.name}</option>{/each}
          </select>
        {:else}
          <span class="font-mono text-[11.5px] text-secondary">{column.name}</span>
        {/if}
        <span>{describe(column)}</span>
        <span class="compact:basis-full"
          >{formatNumber(placed)} of {formatNumber(column.rowGroups.length)} row groups have a bbox{source ===
          "covering"
            ? " (from the bbox covering columns)"
            : source === "statistics"
              ? " (from geospatial statistics)"
              : ""}</span
        >
        <button
          type="button"
          class="ml-auto cursor-pointer rounded-md border border-solid border-line bg-surface px-2 py-0.5 text-[11.5px] text-secondary hover:border-[#d1d5db] aria-pressed:border-accent-line aria-pressed:bg-accent-soft aria-pressed:text-accent"
          aria-pressed={globe}
          onclick={() => (globe = !globe)}>Globe</button
        >
      </div>
    {/if}
    {#if issues.length}
      <ul class="m-0 mb-2 list-none p-0 text-[12px] text-error">
        {#each issues as issue (issue)}<li>{issue}</li>{/each}
      </ul>
    {/if}
    {#if column}
      {#if failed}
        <p class="m-0 text-[12px] text-error">The map couldn't load. {failed}</p>
      {:else if lonlat && !project}
        <p class="m-0 text-[12px] text-subtle">
          {column.crs.kind === "unknown"
            ? "The CRS is unknown, so these bounds can't be placed on a map."
            : `${column.crs.label} needs a CRS registry lookup to be placed on a map, and the file doesn't carry its PROJJSON.`}
        </p>
      {/if}
      <div class={["relative", lonlat && !project && "hidden"]}>
        <div bind:this={container} class="h-[360px] overflow-hidden rounded-lg bg-surface-alt compact:h-[280px]"></div>
        <div
          class="pointer-events-none absolute bottom-2 left-2 flex flex-col gap-0.5 rounded-md bg-surface/90 px-2 py-1 text-[10.5px] text-secondary"
        >
          <span class="flex items-center gap-1.5"
            ><i class="inline-block h-2.5 w-3.5 border border-solid border-accent bg-accent/15"></i>Row group bbox</span
          >
          {#if fileFeatures.length}
            <span class="flex items-center gap-1.5"
              ><i class="inline-block h-2.5 w-3.5 border-[1.5px] border-dashed border-extent"></i>File bbox from the geo
              key</span
            >
          {/if}
          {#if basemapFailed}<span class="text-subtle">The basemap couldn't load</span>{/if}
        </div>
      </div>
      <p class="mt-1.5 mb-0 min-h-[1.45em] font-mono text-[11.5px] text-subtle">
        {#if focus && focusRg !== null}
          <span class="text-secondary">row_group[{focusRg}]</span>
          x {range(focus.bbox.xmin, focus.bbox.xmax)} · y {range(focus.bbox.ymin, focus.bbox.ymax)}
          {#if focus.bbox.zmin !== undefined}· z {range(focus.bbox.zmin, focus.bbox.zmax)}{/if}
          {#if focus.bbox.mmin !== undefined}· m {range(focus.bbox.mmin, focus.bbox.mmax)}{/if}
          {#if focus.types?.length}· {focus.types.map(geometryTypeName).join(", ")}{/if}
        {:else if placed}
          <span class="font-sans [@media(hover:none)]:hidden"
            >Hover a box for its bounds, click to open its row group.</span
          >
          <span class="hidden font-sans [@media(hover:none)]:inline">Tap a box to open its row group.</span>
        {:else}
          <span class="font-sans"
            >The file has no geospatial statistics and no bbox covering column for row groups.</span
          >
        {/if}
      </p>
    {/if}
  </section>
{/if}
