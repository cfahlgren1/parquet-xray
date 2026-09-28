<script lang="ts">
  import ColumnName from "./ColumnName.svelte";
  import ColumnPanel from "./ColumnPanel.svelte";
  import { leafColor } from "../lib/colors";
  import { formatBytes } from "../lib/format";
  import { getInspector } from "../lib/inspector.svelte";
  import { schemaLines } from "../lib/parquet/schema";

  const inspector = getInspector();
  const { model } = inspector;
  const lines = schemaLines(model.metadata);
  const totalBytes = model.leafBytes.reduce((a, b) => a + b, 0);
</script>

<section>
  <h2>Schema <small>size on disk · click a column to find it in the file</small></h2>
  <div class="schema mono">
    {#each lines as line, n (n)}
      {@const leaf = line.leaf}
      {#if leaf === undefined}
        <div class="line">
          <span class="n">{n + 1}</span>
          <span class="code" style:padding-left="{line.depth * 2}ch">
            {#if line.keyword}<span class="kw">{line.keyword}&nbsp;</span>{/if}
            {#if line.name}<ColumnName name={line.name} />{/if}
            {#if line.annotation}<span class="an">{line.annotation}</span>{/if}
            <span
              >{#if line.punct !== "}"}&nbsp;{/if}{line.punct}</span
            >
          </span>
        </div>
      {:else}
        {@const color = leafColor(leaf, inspector.selectedLeaf)}
        {@const bytes = model.leafBytes[leaf] ?? 0}
        <button
          type="button"
          class="line leaf"
          aria-label="Column {model.leaves[leaf]?.path}, {formatBytes(bytes)}"
          aria-pressed={inspector.selectedLeaf === leaf}
          class:selected={inspector.selectedLeaf === leaf}
          onclick={() => inspector.toggleLeaf(leaf)}
        >
          <span class="n">{n + 1}</span>
          <span class="code" style:padding-left="{line.depth * 2}ch">
            <span class="kw" class:optional={line.keyword === "optional"}>{line.keyword}&nbsp;</span>
            <span class="ty">{line.type}&nbsp;</span>
            <ColumnName name={line.name ?? ""} />
            {#if line.annotation}<span class="an">{line.annotation}</span>{/if}
            <span>;</span>
          </span>
          <span class="size">
            <span class="bar"><span style:width="{(bytes / totalBytes) * 100}%" style:background={color}></span></span>
            <span class="swatch" style:background={color}></span>
            <span class="value">{formatBytes(bytes)}</span>
          </span>
        </button>
        {#if inspector.selectedLeaf === leaf}
          <ColumnPanel {leaf} depth={line.depth} />
        {/if}
      {/if}
    {/each}
  </div>
</section>

<style>
  .schema {
    padding: 6px 0;
    border-radius: var(--radius);
    outline: 1px solid var(--line);
    background: var(--surface-2);
    font-size: 12.5px;
  }

  .line {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr) 130px;
    align-items: center;
    width: 100%;
    height: 24px;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    text-align: left;
  }

  .leaf {
    cursor: pointer;
  }

  .leaf:hover,
  .selected {
    background: var(--accent-soft);
  }

  .selected {
    box-shadow: inset 3px 0 0 #818cf8;
  }

  .n {
    padding-right: 10px;
    color: #d1d5db;
    text-align: right;
  }

  .code {
    display: flex;
    min-width: 0;
    padding-right: 12px;
    overflow: hidden;
    white-space: pre;
  }

  .code > :global(*) {
    flex: none;
  }

  .code > :global(.name) {
    flex: 0 1 auto;
  }

  .code :global(.name) {
    font-weight: 600;
  }

  .kw {
    color: #e11d48;
  }

  .ty {
    color: #7c3aed;
  }

  .an {
    color: #0d9488;
  }

  .size {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-right: 12px;
    font-size: 11px;
    color: var(--text-4);
  }

  .bar {
    position: relative;
    flex: 1;
    height: 4px;
    border-radius: 1px;
    background: #eceef2;
  }

  .bar > span {
    position: absolute;
    inset: 0 auto 0 0;
    min-width: 1px;
    border-radius: 1px;
  }

  .size .swatch {
    display: none;
    width: 8px;
    height: 8px;
  }

  .value {
    width: 60px;
    text-align: right;
    white-space: nowrap;
  }

  @media (max-width: 700px) {
    /* Nearly every column is optional; on phones the room is better spent on the name. */
    .kw.optional {
      display: none;
    }
    .line {
      grid-template-columns: 26px minmax(0, 1fr) 64px;
    }
    .bar {
      display: none;
    }
    .size .swatch {
      display: block;
    }
    .value {
      width: auto;
    }
  }
</style>
