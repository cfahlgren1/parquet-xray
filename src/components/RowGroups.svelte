<script lang="ts">
  import RowGroupItem from "./RowGroupItem.svelte";
  import { formatNumber } from "../lib/format";
  import { getInspector } from "../lib/inspector.svelte";

  const inspector = getInspector();
  const { rowGroups } = inspector.model;
  const maxSize = Math.max(...rowGroups.map((g) => g.end - g.start));
  let list: HTMLDivElement;

  // Selections made outside the list (file map, column panel, a shared link) scroll it to the open row group.
  $effect(() => {
    if (!inspector.revealTick) return;
    const open = list.querySelector<HTMLElement>("[aria-expanded=true]")?.parentElement;
    if (!open) return;
    list.scrollTop = open.offsetTop - 26;
    if (inspector.revealInPage) open.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
</script>

<section>
  <h2>Row groups <small>{formatNumber(rowGroups.length)} · click one, or click it in the file strip</small></h2>
  <div
    class="relative max-h-[640px] [scrollbar-gutter:stable] overflow-x-hidden overflow-y-auto rounded-xl border border-solid border-line text-[12px] [--rg-columns:14px_36px_150px_minmax(0,1fr)_64px] compact:max-h-[70vh] compact:[--rg-columns:12px_28px_minmax(0,1fr)_58px]"
    bind:this={list}
  >
    <div
      class="sticky top-0 z-1 grid h-6.5 grid-cols-(--rg-columns) items-center gap-2.5 border-0 border-b border-solid border-line-soft bg-surface px-3 py-0 text-[11px] text-faint compact:gap-2 compact:px-2.5"
    >
      <span></span><span>rg</span><span>rows</span><span class="compact:hidden"></span><span class="text-right"
        >size</span
      >
    </div>
    {#each rowGroups as group (group.rg)}
      <RowGroupItem {group} {maxSize} />
    {/each}
  </div>
</section>
