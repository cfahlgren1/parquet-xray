<script lang="ts">
  import type { BoundingBox } from "hyparquet";
  import { leafColor } from "../lib/colors";
  import { formatBytes, formatNumber, formatValue, percent } from "../lib/format";
  import { getInspector } from "../lib/inspector.svelte";
  import { isLonLat, overlappingBoxes } from "../lib/parquet/geo";
  import { chunkAt, leafAt } from "../lib/parquet/model";
  import { orderOf, rangePositions, statsOf, type Bounds } from "../lib/parquet/stats";

  /** Long files show this many row groups until asked for the rest. */
  const MAX_ROWS = 100;
  const rowClass =
    "grid w-full h-5.5 items-center gap-2.5 px-1 py-0 border-0 rounded-[4px] text-left compact:grid-cols-[26px_minmax(0,1fr)_minmax(0,1fr)_52px] compact:[grid-template-areas:'rg_min_max_size'_'._bar_bar_bar'] compact:gap-y-[3px] compact:h-auto compact:p-1 [&>span]:truncate";

  let { leaf, depth }: { leaf: number; depth: number } = $props();

  const inspector = getInspector();
  const { model } = inspector;
  const { rowGroups } = model;

  const column = $derived(leafAt(model.leaves, leaf));
  const bytes = $derived(model.leafBytes[leaf] ?? 0);
  const uncompressed = $derived(
    rowGroups.reduce((sum, g) => sum + Number(chunkAt(g, leaf).meta.total_uncompressed_size), 0),
  );
  const bounds = $derived(rowGroups.map((g) => statsOf(chunkAt(g, leaf).meta.statistics)));
  const order = $derived(orderOf(bounds));
  const position = $derived(rangePositions(bounds.filter((b): b is Bounds => b !== null)));
  const missing = $derived(bounds.filter((b) => !b).length);
  const orderText = $derived(
    {
      single: "",
      missing: `${formatNumber(missing)} of ${formatNumber(bounds.length)} row groups have no min/max`,
      constant: "same range in every row group",
      sorted: "sorted: filters on it skip row groups",
      overlapping: "ranges overlap across row groups",
    }[order],
  );
  // Geometry columns show each row group's bbox, since their min/max statistics are raw WKB.
  const geo = $derived(model.geo?.columns.find((c) => c.leaf === leaf) ?? null);
  const boxes = $derived(geo?.rowGroups.map((g) => g?.bbox ?? null) ?? []);
  const lonLat = $derived(!!geo && isLonLat(geo.crs));
  const extent = $derived.by(() => {
    const known = boxes.filter((b) => b !== null);
    if (!known.length) return null;
    const wraps = known.some((b) => b.xmin > b.xmax);
    const xs = known.flatMap((b) => [b.xmin, b.xmax]);
    const ys = known.flatMap((b) => [b.ymin, b.ymax]);
    return {
      xmin: wraps && lonLat ? -180 : Math.min(...xs),
      xmax: wraps && lonLat ? 180 : Math.max(...xs),
      ymin: Math.min(...ys),
      ymax: Math.max(...ys),
    };
  });
  /** Enough decimals to show the smallest bbox's size: none for meters, one or two for a city in degrees. */
  const digits = $derived.by(() => {
    const sides = boxes.flatMap((b) => (b ? [Math.abs(b.xmax - b.xmin), b.ymax - b.ymin] : [])).filter((d) => d > 0);
    const smallest = sides.length ? Math.min(...sides) : 1;
    return Math.min(6, Math.max(0, Math.ceil(1 - Math.log10(smallest))));
  });
  const placedBoxes = $derived(boxes.filter((b) => b !== null).length);
  const overlapping = $derived(geo ? overlappingBoxes(boxes) : 0);
  const disjoint = $derived(placedBoxes === boxes.length && boxes.length > 1 && !overlapping);
  const geoText = $derived.by(() => {
    if (!geo) return "";
    if (!placedBoxes) return "no row group bboxes: the file has no geospatial statistics or bbox covering";
    if (placedBoxes < boxes.length) {
      return `${formatNumber(boxes.length - placedBoxes)} of ${formatNumber(boxes.length)} row groups have no bbox`;
    }
    if (boxes.length < 2) return "";
    if (disjoint) return "bboxes don't overlap: spatial filters skip row groups";
    return `${formatNumber(overlapping)} of ${formatNumber(boxes.length)} row group bboxes overlap another`;
  });
  const columns = $derived(
    geo
      ? "grid-cols-[34px_minmax(0,1.4fr)_minmax(0,1.4fr)_40px_50px_64px]"
      : "grid-cols-[34px_minmax(0,1fr)_minmax(0,1fr)_minmax(80px,1.1fr)_50px_64px]",
  );
  const shown = $derived(inspector.showAllRowGroups ? rowGroups : rowGroups.slice(0, MAX_ROWS));

  function span(lo: number, hi: number): string {
    return `${lo.toFixed(digits)} to ${hi.toFixed(digits)}`;
  }

  /** The bbox as rects in a 100×100 thumbnail of the column's extent, in two when it wraps the antimeridian. */
  function thumbnail(b: BoundingBox): { x: number; y: number; width: number; height: number }[] {
    if (!extent) return [];
    const { xmin, xmax, ymin, ymax } = extent;
    const xs =
      b.xmin <= b.xmax
        ? [[b.xmin, b.xmax]]
        : [
            [b.xmin, xmax],
            [xmin, b.xmax],
          ];
    const y = ((ymax - b.ymax) / (ymax - ymin || 1)) * 100;
    // Big enough to see a row group of points, and kept inside the thumbnail.
    const height = Math.max(22, ((b.ymax - b.ymin) / (ymax - ymin || 1)) * 100);
    return xs.map(([lo = 0, hi = 0]) => {
      const width = Math.max(10, ((hi - lo) / (xmax - xmin || 1)) * 100);
      const x = ((lo - xmin) / (xmax - xmin || 1)) * 100;
      return { x: Math.min(x, 100 - width), y: Math.min(y, 100 - height), width, height };
    });
  }

  function open(event: MouseEvent, rg: number) {
    event.stopPropagation();
    inspector.openRowGroup(rg);
  }
</script>

<div
  class="mt-1 mr-3 mb-2 ml-7.5 rounded-lg bg-surface px-3 py-2.5 font-sans outline outline-[#e0e7ff] outline-solid compact:mx-0!"
  style:margin-left="calc(30px + {depth * 2}ch)"
>
  <div class="mb-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[12.5px]">
    <b class="font-mono">{column.path}</b>
    {#if geo}
      {#if geoText}<span class={["text-[12px]", disjoint ? "text-ok" : "text-faint"]}>{geoText}</span>{/if}
    {:else if orderText}<span class={["text-[12px]", order === "sorted" ? "text-ok" : "text-faint"]}>{orderText}</span
      >{/if}
  </div>
  <div class="mb-2 flex flex-wrap gap-x-4.5 gap-y-0.5 text-[12px]">
    <span><span class="text-faint">size</span> {formatBytes(bytes)} ({percent(bytes, model.fileSize)} of file)</span>
    <span><span class="text-faint">uncompressed</span> {formatBytes(uncompressed)}</span>
    <span><span class="text-faint">row groups</span> {formatNumber(rowGroups.length)}</span>
    {#if geo}<span><span class="text-faint">crs</span> {geo.crs.name ?? geo.crs.label}</span>{/if}
  </div>
  {#if geo && model.geo?.issues.length}
    <ul class="m-0 mb-2 list-none p-0 text-[12px] text-error">
      {#each model.geo.issues as issue (issue)}<li>{issue}</li>{/each}
    </ul>
  {/if}
  <div class="max-h-[420px] [scrollbar-gutter:stable] overflow-y-auto font-mono text-[11.5px]">
    <div class={[rowClass, columns, "sticky top-0 cursor-default bg-surface font-sans text-[11px] text-faint"]}>
      <span class="compact:[grid-area:rg]">rg</span><span class="compact:[grid-area:min]"
        >{geo ? (lonLat ? "lon" : "x") : "min"}</span
      ><span class="compact:[grid-area:max]">{geo ? (lonLat ? "lat" : "y") : "max"}</span><span class="compact:hidden"
        >{geo ? "bbox" : position ? "range" : ""}</span
      >
      <span class="text-right compact:hidden">nulls</span><span class="text-right compact:[grid-area:size]">size</span>
    </div>
    {#each shown as g (g.rg)}
      {@const chunk = chunkAt(g, leaf)}
      {@const b = bounds[g.rg]}
      {@const box = boxes[g.rg]}
      <button
        type="button"
        class={[
          rowClass,
          columns,
          "cursor-pointer hover:bg-accent-soft",
          inspector.selectedRg === g.rg ? "bg-accent-soft" : "bg-transparent",
        ]}
        title="Open row_group[{g.rg}]"
        onclick={(event) => open(event, g.rg)}
      >
        <span class="text-faint compact:[grid-area:rg]">{g.rg}</span>
        {#if geo}
          <span class="compact:[grid-area:min]">{box ? span(box.xmin, box.xmax) : "–"}</span>
          <span class="compact:[grid-area:max]">{box ? span(box.ymin, box.ymax) : "–"}</span>
          <svg
            class="h-4.5 w-10 rounded-[2px] bg-line-soft compact:hidden"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {#if box}
              {#each thumbnail(box) as r, i (i)}
                <rect {...r} fill={leafColor(leaf, inspector.selectedLeaf)} />
              {/each}
            {/if}
          </svg>
        {:else}
          <span class="compact:[grid-area:min]">{b ? formatValue(b.min, column.element) : "–"}</span>
          <span class="compact:[grid-area:max]">{b ? formatValue(b.max, column.element) : "–"}</span>
          <span class="relative h-1.5 rounded-[1px] bg-line-soft compact:[grid-area:bar]">
            {#if b && position}
              {@const lo = position(b.min)}
              <span
                class="absolute inset-y-0 rounded-[1px]"
                style:left="{lo * 100}%"
                style:width="{Math.max(0.8, (position(b.max) - lo) * 100)}%"
                style:background={leafColor(leaf, inspector.selectedLeaf)}
              ></span>
            {/if}
          </span>
        {/if}
        <span class="text-right text-faint compact:hidden"
          >{formatNumber(Number(chunk.meta.statistics?.null_count ?? 0))}</span
        >
        <span class="text-right compact:[grid-area:size]">{formatBytes(Number(chunk.meta.total_compressed_size))}</span>
      </button>
    {/each}
    {#if shown.length < rowGroups.length}
      <button
        type="button"
        class="mt-1 cursor-pointer border-0 bg-transparent p-1 font-sans text-[12px] text-accent"
        onclick={(event) => {
          event.stopPropagation();
          inspector.showAllRowGroups = true;
        }}>Show all {formatNumber(rowGroups.length)} row groups</button
      >
    {/if}
  </div>
</div>
