<script lang="ts">
  import ColumnName from "./ColumnName.svelte";
  import { leafColor } from "../lib/colors";
  import { formatNumber } from "../lib/format";
  import { getInspector } from "../lib/inspector.svelte";

  const MAX_COLUMNS = 12;

  const inspector = getInspector();
  const shown = inspector.model.leaves.slice(0, MAX_COLUMNS);
  const hidden = inspector.model.leaves.length - shown.length;
</script>

<div class="legend">
  {#each shown as leaf, i (leaf.path)}
    <span class="item" class:dim={inspector.selectedLeaf !== null && inspector.selectedLeaf !== i}>
      <span class="swatch" style:background={leafColor(i, null)}></span>
      <span class="mono path"><ColumnName name={leaf.path} /></span>
    </span>
  {/each}
  {#if hidden > 0}
    <span class="muted">+{formatNumber(hidden)} more</span>
  {/if}
  <span class="key">
    <span class="item"><span class="swatch dict"></span>dictionary page</span>
    <span class="item"><span class="swatch data"></span>data page</span>
    <span class="item"><span class="swatch seam"></span>page boundary</span>
  </span>
</div>

<style>
  .legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 14px;
    margin-top: 10px;
    font-size: 11.5px;
    color: #4b5563;
  }

  .item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    max-width: 100%;
    min-width: 0;
  }

  .path {
    display: flex;
    min-width: 0;
  }

  .dim {
    opacity: 0.4;
  }

  .key {
    display: inline-flex;
    gap: 13px;
    margin-left: auto;
    color: var(--text-4);
  }

  .dict {
    background: var(--line);
  }

  .data {
    background: #b8bec8;
  }

  .seam {
    background: linear-gradient(90deg, #b8bec8 45%, #fff 45% 55%, #b8bec8 55%);
  }

  @media (max-width: 700px) {
    .key {
      margin-left: 0;
    }
  }
</style>
