<script lang="ts">
  import { leafColor } from "../lib/colors";
  import { formatBytes, formatNumber, formatValue, percent } from "../lib/format";
  import { getInspector } from "../lib/inspector.svelte";
  import { chunkAt, leafAt } from "../lib/parquet/model";
  import { orderOf, rangePositions, statsOf, type Bounds } from "../lib/parquet/stats";

  /** Long files show this many row groups until asked for the rest. */
  const MAX_ROWS = 100;
  const rowClass =
    "grid w-full h-5.5 grid-cols-[34px_minmax(0,1fr)_minmax(0,1fr)_minmax(80px,1.1fr)_50px_64px] items-center gap-2.5 px-1 py-0 border-0 rounded-[4px] text-left compact:grid-cols-[26px_minmax(0,1fr)_minmax(0,1fr)_52px] compact:[grid-template-areas:'rg_min_max_size'_'._bar_bar_bar'] compact:gap-y-[3px] compact:h-auto compact:p-1 [&>span]:truncate";

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
  const shown = $derived(inspector.showAllRowGroups ? rowGroups : rowGroups.slice(0, MAX_ROWS));

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
    {#if orderText}<span class={["text-[12px]", order === "sorted" ? "text-ok" : "text-faint"]}>{orderText}</span>{/if}
  </div>
  <div class="mb-2 flex flex-wrap gap-x-4.5 gap-y-0.5 text-[12px]">
    <span><span class="text-faint">size</span> {formatBytes(bytes)} ({percent(bytes, model.fileSize)} of file)</span>
    <span><span class="text-faint">uncompressed</span> {formatBytes(uncompressed)}</span>
    <span><span class="text-faint">row groups</span> {formatNumber(rowGroups.length)}</span>
  </div>
  <div class="max-h-[420px] [scrollbar-gutter:stable] overflow-y-auto font-mono text-[11.5px]">
    <div class={[rowClass, "sticky top-0 cursor-default bg-surface font-sans text-[11px] text-faint"]}>
      <span class="compact:[grid-area:rg]">rg</span><span class="compact:[grid-area:min]">min</span><span
        class="compact:[grid-area:max]">max</span
      ><span class="compact:hidden">{position ? "range" : ""}</span>
      <span class="text-right compact:hidden">nulls</span><span class="text-right compact:[grid-area:size]">size</span>
    </div>
    {#each shown as g (g.rg)}
      {@const chunk = chunkAt(g, leaf)}
      {@const b = bounds[g.rg]}
      <button
        type="button"
        class={[
          rowClass,
          "cursor-pointer hover:bg-accent-soft",
          inspector.selectedRg === g.rg ? "bg-accent-soft" : "bg-transparent",
        ]}
        title="Open row_group[{g.rg}]"
        onclick={(event) => open(event, g.rg)}
      >
        <span class="text-faint compact:[grid-area:rg]">{g.rg}</span>
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
