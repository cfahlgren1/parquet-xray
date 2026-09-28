<script lang="ts">
  import { pieceColor } from "../lib/colors";
  import { getInspector } from "../lib/inspector.svelte";
  import { paintDominant, spanAt } from "../lib/paint";
  import type { Piece, RowGroupPiece } from "../lib/parquet/model";

  interface Span {
    start: number;
    end: number;
  }

  interface Props {
    /** Pieces inside `from`..`to`, sorted by start. */
    pieces: Piece[];
    from: number;
    to: number;
    label: string;
    /** Coarser click targets drawn as seams, e.g. row groups. Without them, clicks show the piece's details. */
    targets?: RowGroupPiece[];
    selected?: Span | null;
    /** Outlined from outside, e.g. while hovering a row group in the list. */
    highlighted?: Span | null;
    onpick?: (target: RowGroupPiece) => void;
  }

  let { pieces, from, to, label, targets, selected = null, highlighted = null, onpick }: Props = $props();

  const inspector = getInspector();
  let canvas: HTMLCanvasElement;
  let width = $state(0);
  let height = $state(0);
  let hovered = $state.raw<Piece | null>(null);

  /** Pieces are painted once per size and column selection; hovering only redraws outlines over this layer. */
  const base = $derived.by(() => {
    if (!width || !height) return null;
    const dpr = devicePixelRatio || 1;
    const layer = new OffscreenCanvas(Math.round(width * dpr), Math.round(height * dpr));
    const ctx = layer.getContext("2d");
    if (!ctx) return null;
    const selectedLeaf = inspector.selectedLeaf;
    const x = (offset: number) => ((offset - from) / (to - from)) * width;
    ctx.fillStyle = "#f3f4f6";
    ctx.fillRect(0, 0, layer.width, layer.height);
    paintDominant(ctx, pieces, from, to, layer.width, layer.height, (p) => pieceColor(p, selectedLeaf));
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "rgb(255 255 255 / 85%)";
    for (const p of pieces) if (x(p.end) - x(p.start) > 4) ctx.fillRect(x(p.start), 0, 1, height);
    ctx.fillStyle = "#fff";
    for (const t of targets ?? []) if (x(t.end) - x(t.start) > 3) ctx.fillRect(x(t.start), 0, 1.5, height);
    return layer;
  });

  $effect(() => {
    const ctx = canvas.getContext("2d");
    if (!ctx || !base) return;
    const dpr = devicePixelRatio || 1;
    canvas.width = base.width;
    canvas.height = base.height;
    ctx.drawImage(base, 0, 0);
    ctx.scale(dpr, dpr);
    const x = (offset: number) => ((offset - from) / (to - from)) * width;
    const outlines: [Span | null, string][] = [
      [selected, "#4f46e5"],
      [hovered ?? highlighted, "#111827"],
    ];
    ctx.lineWidth = 2;
    for (const [span, color] of outlines) {
      if (!span) continue;
      ctx.strokeStyle = color;
      ctx.strokeRect(x(span.start) + 1, 1, Math.max(x(span.end) - x(span.start) - 2, 2), height - 2);
    }
  });

  function pick<T extends Span>(spans: T[], event: MouseEvent): T | null {
    const rect = canvas.getBoundingClientRect();
    const offset = from + ((event.clientX - rect.left) / rect.width) * (to - from);
    return spanAt(spans, offset, ((to - from) / rect.width) * 2);
  }

  function onpointermove(event: PointerEvent) {
    if (event.pointerType !== "mouse") return;
    hovered = pick(pieces, event);
    inspector.showPopover(hovered, event, !!onpick);
  }

  function onpointerleave(event: PointerEvent) {
    if (event.pointerType !== "mouse") return;
    hovered = null;
    inspector.hidePopover();
  }

  function onclick(event: MouseEvent) {
    event.stopPropagation();
    if (onpick && targets) {
      const target = pick(targets, event);
      if (!target) return;
      inspector.hidePopover();
      onpick(target);
      return;
    }
    hovered = pick(pieces, event);
    inspector.showPopover(hovered, event);
  }
</script>

<div class="h-10 compact:h-9" bind:clientWidth={width} bind:clientHeight={height}>
  <canvas
    bind:this={canvas}
    class={["block size-full rounded-[3px]", onpick ? "cursor-pointer" : "cursor-crosshair"]}
    aria-label={label}
    {onpointermove}
    {onpointerleave}
    {onclick}
  ></canvas>
</div>
