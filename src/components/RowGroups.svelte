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
    const open = list.querySelector<HTMLElement>(".open");
    if (!open) return;
    list.scrollTop = open.offsetTop - 26;
    if (inspector.revealInPage) open.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
</script>

<section>
  <h2>Row groups <small>{formatNumber(rowGroups.length)} · click one, or click it in the file strip</small></h2>
  <div class="list" bind:this={list}>
    <div class="header">
      <span></span><span>rg</span><span>rows</span><span></span><span class="r">size</span>
    </div>
    {#each rowGroups as group (group.rg)}
      <RowGroupItem {group} {maxSize} />
    {/each}
  </div>
</section>

<style>
  .list {
    position: relative;
    max-height: 640px;
    overflow: hidden auto;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    font-size: 12px;
    scrollbar-gutter: stable;
  }

  .header {
    position: sticky;
    top: 0;
    z-index: 1;
    display: grid;
    grid-template-columns: var(--rg-columns);
    gap: 10px;
    align-items: center;
    height: 26px;
    padding: 0 12px;
    border-bottom: 1px solid var(--line-soft);
    background: var(--surface);
    font-size: 11px;
    color: var(--text-4);
  }

  .list {
    --rg-columns: 14px 36px 150px minmax(0, 1fr) 64px;
  }

  .r {
    text-align: right;
  }

  @media (max-width: 700px) {
    .list {
      --rg-columns: 12px 28px minmax(0, 1fr) 58px;
      max-height: 70vh;
    }
    .header {
      gap: 8px;
      padding: 0 10px;
    }
    .header > :nth-child(4) {
      display: none;
    }
  }
</style>
