<script lang="ts">
  import { pieceColor } from "../lib/colors";
  import { getInspector } from "../lib/inspector.svelte";
  import { describePiece, rowGroupOf } from "../lib/popover";

  const GAP = 14;
  const MARGIN = 12;

  const inspector = getInspector();
  const popover = $derived(inspector.popover);
  const content = $derived(popover && describePiece(popover.piece, inspector.model));
  const hintRg = $derived(
    popover && (popover.opensRowGroup || popover.piece.kind === "rowGroup") ? rowGroupOf(popover.piece) : null,
  );

  let box = $state<HTMLDivElement>();
  let left = $state(0);
  let top = $state(0);

  // Placed after render, since the height depends on the content; flips above the pointer near the bottom edge.
  $effect(() => {
    if (!popover || !box) return;
    const { width, height } = box.getBoundingClientRect();
    left = Math.min(popover.x + GAP, innerWidth - width - MARGIN);
    top = popover.y + GAP + 4 + height > innerHeight ? popover.y - height - MARGIN : popover.y + GAP + 4;
  });
</script>

{#if popover && content}
  <div class="popover" bind:this={box} style:left="{left}px" style:top="{top}px" role="tooltip">
    <div class="title">
      <span class="swatch" style:background={pieceColor(popover.piece, inspector.selectedLeaf)}></span>
      {content.title}
    </div>
    {#if content.column}<div class="column mono">{content.column}</div>{/if}
    <div class="where mono">{content.where}</div>
    <p class="what">{content.what}</p>
    <dl>
      {#each content.rows as [label, value] (label)}
        <dt>{label}</dt>
        <dd class="mono">{value}</dd>
      {/each}
    </dl>
    {#if hintRg !== null}
      <div class="hint">Click to {inspector.selectedRg === hintRg ? "close" : "open"} row_group[{hintRg}]</div>
    {/if}
  </div>
{/if}

<style>
  .popover {
    position: fixed;
    z-index: 30;
    width: 320px;
    padding: 11px 13px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow-pop);
    pointer-events: none;
  }

  .title {
    display: flex;
    align-items: center;
    gap: 7px;
    font-weight: 600;
  }

  .column {
    margin: 3px 0 0 17px;
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .where {
    margin: 1px 0 6px 17px;
    font-size: 11.5px;
    color: var(--text-3);
  }

  .what {
    margin: 0 0 8px;
    font-size: 12px;
    color: var(--text-2);
  }

  dl {
    display: grid;
    grid-template-columns: 88px minmax(0, 1fr);
    gap: 3px 8px;
    margin: 0;
    font-size: 12px;
  }

  dt {
    color: var(--text-4);
  }

  dd {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hint {
    margin-top: 8px;
    padding-top: 7px;
    border-top: 1px solid var(--line-soft);
    font-size: 11.5px;
    color: var(--text-4);
  }

  @media (max-width: 700px) {
    .popover {
      top: auto !important;
      right: 8px;
      bottom: 8px;
      left: 8px !important;
      width: auto;
    }
  }
</style>
