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
    // clientWidth excludes the scrollbar gutter, which innerWidth counts.
    const { clientWidth, clientHeight } = document.documentElement;
    left = Math.min(popover.x + GAP, clientWidth - width - MARGIN);
    top = popover.y + GAP + 4 + height > clientHeight ? popover.y - height - MARGIN : popover.y + GAP + 4;
  });
</script>

{#if popover && content}
  <div
    class="pointer-events-none fixed z-30 w-80 rounded-xl border border-solid border-line bg-surface px-[13px] pt-[11px] pb-3 shadow-pop compact:top-auto! compact:right-2 compact:bottom-2 compact:left-2! compact:w-auto"
    bind:this={box}
    style:left="{left}px"
    style:top="{top}px"
    role="tooltip"
  >
    <div class="flex items-center gap-[7px] font-semibold">
      <span
        class="inline-block size-2.5 flex-none rounded-[2px]"
        style:background={pieceColor(popover.piece, inspector.selectedLeaf)}
      ></span>
      {content.title}
    </div>
    {#if content.column}<div class="mt-[3px] ml-[17px] font-mono text-[12px] [overflow-wrap:anywhere]">
        {content.column}
      </div>{/if}
    <div class="mt-px mb-1.5 ml-[17px] font-mono text-[11.5px] text-subtle">{content.where}</div>
    <p class="mt-0 mb-2 text-[12px] text-secondary">{content.what}</p>
    <dl class="m-0 grid grid-cols-[88px_minmax(0,1fr)] gap-x-2 gap-y-[3px] text-[12px]">
      {#each content.rows as [label, value] (label)}
        <dt class="text-faint">{label}</dt>
        <dd class="m-0 truncate font-mono">{value}</dd>
      {/each}
    </dl>
    {#if hintRg !== null}
      <div class="mt-2 border-0 border-t border-solid border-line-soft pt-[7px] text-[11.5px] text-faint">
        Click to {inspector.selectedRg === hintRg ? "close" : "open"} row_group[{hintRg}]
      </div>
    {/if}
  </div>
{/if}
