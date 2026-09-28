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

<div class="row" class:selected={inspector.selectedLeaf === chunk.leaf}>
  <span class="name mono"><ColumnName name={column.path} /></span>
  <div class="pages" style:width="{Math.max(6, ((chunk.end - chunk.start) / maxChunk) * 100)}%">
    {#each chunk.parts as part (part.start)}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div
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
  <span class="size mono">{formatBytes(Number(chunk.meta.total_compressed_size))}</span>
  <span class="minmax mono">
    {bounds ? `${formatValue(bounds.min, column.element)} … ${formatValue(bounds.max, column.element)}` : "no min/max"}
  </span>
  <span class="info">{info}</span>
</div>

<style>
  .row {
    display: grid;
    grid-template-columns: 110px minmax(0, 1fr) 64px;
    grid-template-areas: "name pages size" "name minmax info";
    gap: 2px 12px;
    align-items: center;
    padding: 6px 0;
    border-bottom: 1px solid #f3f4f6;
  }

  .row:last-child {
    border: 0;
  }

  .selected {
    background: var(--accent-soft);
  }

  .row > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .name {
    display: flex;
    grid-area: name;
    align-self: start;
    min-width: 0;
  }

  .pages {
    grid-area: pages;
    display: flex;
    gap: 1px;
    height: 10px;
  }

  .pages > div {
    min-width: 2px;
    height: 100%;
    border-radius: 1px;
  }

  .pages > div:hover {
    position: relative;
    z-index: 1;
    outline: 2px solid var(--text);
  }

  .size {
    grid-area: size;
    text-align: right;
  }

  .minmax {
    grid-area: minmax;
    font-size: 11px;
    color: #4b5563;
  }

  .row > .info {
    grid-area: info;
    overflow: visible;
    font-size: 11px;
    color: var(--text-4);
    text-align: right;
  }

  @media (max-width: 700px) {
    .row {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas: "name size" "pages pages" "minmax info";
    }
    .pages {
      height: 14px;
    }
  }
</style>
