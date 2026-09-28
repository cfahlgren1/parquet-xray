<script lang="ts">
  import ChunkRow from "./ChunkRow.svelte";
  import { leafColor } from "../lib/colors";
  import { formatBytes, formatNumber } from "../lib/format";
  import { getInspector } from "../lib/inspector.svelte";
  import type { RowGroupInfo } from "../lib/parquet/model";

  let { group, maxSize }: { group: RowGroupInfo; maxSize: number } = $props();

  const inspector = getInspector();
  const open = $derived(inspector.selectedRg === group.rg);
  const size = $derived(group.end - group.start);
  const uncompressed = $derived(group.chunks.reduce((sum, c) => sum + Number(c.meta.total_uncompressed_size), 0));
  const maxChunk = $derived(Math.max(...group.chunks.map((c) => c.end - c.start)));

  /** One gradient instead of an element per chunk: files with hundreds of columns would otherwise overflow the bar. */
  const gradient = $derived.by(() => {
    const total = group.chunks.reduce((sum, c) => sum + (c.end - c.start), 0);
    let at = 0;
    const stops = group.chunks.map((c) => {
      const from = (at / total) * 100;
      at += c.end - c.start;
      return `${leafColor(c.leaf, inspector.selectedLeaf)} ${from}% ${(at / total) * 100}%`;
    });
    return `linear-gradient(to right, ${stops.join(", ")})`;
  });

  function hover(event: PointerEvent, entering: boolean) {
    if (event.pointerType === "mouse") inspector.hoveredRg = entering ? group : null;
  }
</script>

<div class="item" class:open>
  <button
    type="button"
    class="summary"
    aria-expanded={open}
    onclick={() => inspector.toggleRowGroup(group.rg)}
    onpointerenter={(event) => hover(event, true)}
    onpointerleave={(event) => hover(event, false)}
  >
    <span class="chevron" aria-hidden="true">{open ? "▾" : "▸"}</span>
    <span class="mono">{group.rg}</span>
    <span class="mono muted">{formatNumber(group.firstRow)}–{formatNumber(group.firstRow + group.numRows - 1)}</span>
    <span class="bar"><span style:width="{(size / maxSize) * 100}%" style:background={gradient}></span></span>
    <span class="mono r">{formatBytes(size)}</span>
  </button>
  {#if open}
    <div class="body">
      <div class="meta">
        <span><span class="k">rows</span> <span class="mono">{formatNumber(group.numRows)}</span></span>
        <span><span class="k">uncompressed</span> <span class="mono">{formatBytes(uncompressed)}</span></span>
        <span>
          <span class="k">bytes</span>
          <span class="mono">{formatNumber(group.start)}–{formatNumber(group.end)}</span>
        </span>
      </div>
      {#each group.chunks as chunk (chunk.leaf)}
        <ChunkRow {chunk} {maxChunk} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .item {
    border-bottom: 1px solid var(--line-soft);
  }

  .item:last-child {
    border: 0;
  }

  .summary {
    display: grid;
    grid-template-columns: var(--rg-columns);
    gap: 10px;
    align-items: center;
    width: 100%;
    height: 30px;
    padding: 0 12px;
    border: 0;
    background: none;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .summary:hover {
    background: var(--surface-2);
  }

  .open .summary {
    background: var(--accent-soft);
  }

  .chevron {
    font-size: 10px;
    color: var(--text-4);
  }

  .r {
    text-align: right;
  }

  .bar {
    height: 8px;
    min-width: 0;
  }

  .bar > span {
    display: block;
    height: 100%;
    border-radius: 1px;
  }

  .body {
    padding: 8px 12px 12px 36px;
    background: #fcfcfd;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 18px;
    margin-bottom: 6px;
  }

  .k {
    color: var(--text-4);
  }

  @media (max-width: 700px) {
    .summary {
      gap: 8px;
      padding: 0 10px;
    }
    .bar {
      display: none;
    }
    .body {
      padding: 8px 10px 10px;
    }
  }
</style>
