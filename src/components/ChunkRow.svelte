<script lang="ts">
  import ColumnName from "./ColumnName.svelte";
  import { pieceColor } from "../lib/colors";
  import { formatBytes, formatNumber, formatValue } from "../lib/format";
  import { getInspector } from "../lib/inspector.svelte";
  import { leafAt, type Chunk } from "../lib/parquet/model";
  import { statsOf } from "../lib/parquet/stats";

  let { chunk, maxChunk }: { chunk: Chunk; maxChunk: number } = $props();

  const inspector = getInspector();
  const column = $derived(leafAt(inspector.model.leaves, chunk.leaf));
  const bounds = $derived(statsOf(chunk.meta.statistics));
  const pages = $derived(chunk.parts.filter((p) => p.kind === "page").length);
  const nulls = $derived(Number(chunk.meta.statistics?.null_count ?? 0));
  const info = $derived(
    [pages ? `${pages} pages` : "no index", nulls ? `${formatNumber(nulls)} nulls` : null].filter(Boolean).join(" · "),
  );
</script>

<div
  class={[
    "grid grid-cols-[110px_minmax(0,1fr)_64px] items-center gap-x-3 gap-y-0.5 border-0 border-b border-solid border-[#f3f4f6] py-1.5 [grid-template-areas:'name_pages_size'_'name_minmax_info'] last:border-0 compact:grid-cols-[minmax(0,1fr)_auto] compact:[grid-template-areas:'name_size'_'pages_pages'_'minmax_info']",
    inspector.selectedLeaf === chunk.leaf && "bg-accent-soft",
  ]}
>
  <span class="flex min-w-0 self-start truncate font-mono [grid-area:name]"><ColumnName name={column.path} /></span>
  <div
    class="flex h-2.5 gap-px [grid-area:pages] compact:h-3.5"
    style:width="{Math.max(6, ((chunk.end - chunk.start) / maxChunk) * 100)}%"
  >
    {#each chunk.parts as part (part.start)}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div
        class="h-full min-w-0.5 rounded-[1px] hover:relative hover:z-1 hover:outline-2 hover:outline-ink hover:outline-solid"
        style:flex="{part.end - part.start} 0 0"
        style:background={pieceColor(part, inspector.selectedLeaf)}
        onpointermove={(event) => event.pointerType === "mouse" && inspector.showPopover(part, event)}
        onpointerleave={() => inspector.hidePopover()}
        onclick={(event) => {
          event.stopPropagation();
          inspector.showPopover(part, event);
        }}
      ></div>
    {/each}
  </div>
  <span class="truncate text-right font-mono [grid-area:size]"
    >{formatBytes(Number(chunk.meta.total_compressed_size))}</span
  >
  <span class="truncate font-mono text-[11px] text-[#4b5563] [grid-area:minmax]">
    {bounds ? `${formatValue(bounds.min, column.element)} … ${formatValue(bounds.max, column.element)}` : "no min/max"}
  </span>
  <span class="overflow-visible text-right text-[11px] text-ellipsis whitespace-nowrap text-faint [grid-area:info]"
    >{info}</span
  >
</div>
