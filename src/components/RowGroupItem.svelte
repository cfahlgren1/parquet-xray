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

<div class="border-0 border-b border-solid border-line-soft last:border-0">
  <button
    type="button"
    class={[
      "grid h-7.5 w-full cursor-pointer grid-cols-(--rg-columns) items-center gap-2.5 border-0 px-3 py-0 text-left compact:gap-2 compact:px-2.5",
      open ? "bg-accent-soft" : "bg-transparent hover:bg-surface-alt",
    ]}
    aria-expanded={open}
    onclick={() => inspector.toggleRowGroup(group.rg)}
    onpointerenter={(event) => hover(event, true)}
    onpointerleave={(event) => hover(event, false)}
  >
    <span class="text-[10px] text-faint" aria-hidden="true">{open ? "▾" : "▸"}</span>
    <span class="font-mono">{group.rg}</span>
    <span class="font-mono text-faint"
      >{formatNumber(group.firstRow)}–{formatNumber(group.firstRow + group.numRows - 1)}</span
    >
    <span class="h-2 min-w-0 compact:hidden"
      ><span class="block h-full rounded-[1px]" style:width="{(size / maxSize) * 100}%" style:background={gradient}
      ></span></span
    >
    <span class="text-right font-mono">{formatBytes(size)}</span>
  </button>
  {#if open}
    <div class="bg-[#fcfcfd] pt-2 pr-3 pb-3 pl-9 compact:px-2.5 compact:pb-2.5">
      <div class="mb-1.5 flex flex-wrap gap-x-4.5 gap-y-1">
        <span><span class="text-faint">rows</span> <span class="font-mono">{formatNumber(group.numRows)}</span></span>
        <span
          ><span class="text-faint">uncompressed</span> <span class="font-mono">{formatBytes(uncompressed)}</span></span
        >
        <span>
          <span class="text-faint">bytes</span>
          <span class="font-mono">{formatNumber(group.start)}–{formatNumber(group.end)}</span>
        </span>
      </div>
      {#each group.chunks as chunk (chunk.leaf)}
        <ChunkRow {chunk} {maxChunk} />
      {/each}
    </div>
  {/if}
</div>
