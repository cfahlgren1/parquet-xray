<script lang="ts">
  import ByteStrip from "./ByteStrip.svelte";
  import Legend from "./Legend.svelte";
  import { formatBytes, formatNumber } from "../lib/format";
  import { getInspector } from "../lib/inspector.svelte";
  import type { RowGroupPiece } from "../lib/parquet/model";

  const inspector = getInspector();
  const { model } = inspector;

  const body = model.pieces.filter((p) => p.start < model.tailStart);
  const tail = model.pieces.filter((p) => p.start >= model.tailStart);
  const rowGroups: RowGroupPiece[] = model.rowGroups.map((group) => ({
    kind: "rowGroup",
    start: group.start,
    end: group.end,
    group,
  }));
  const selected = $derived(inspector.selectedRg === null ? null : (rowGroups[inspector.selectedRg] ?? null));
</script>

<section class="rounded-xl border border-solid border-line px-4 py-3.5 compact:p-3">
  <div class="grid grid-cols-[minmax(0,1fr)_220px] gap-4 compact:grid-cols-1 compact:gap-2.5">
    <div>
      <div class="mb-1 flex justify-between text-[11px] text-faint">
        <span
          ><b class="font-medium text-secondary">File</b> · {formatNumber(model.rowGroups.length)} row groups · click one
          to open it</span
        >
        <span>{formatBytes(model.fileSize)}</span>
      </div>
      <ByteStrip
        pieces={body}
        from={0}
        to={model.tailStart}
        label="File layout"
        targets={rowGroups}
        {selected}
        highlighted={inspector.hoveredRg}
        onpick={(target) => inspector.toggleRowGroup(target.group.rg, { reveal: true })}
      />
    </div>
    <div>
      <div class="mb-1 flex justify-between text-[11px] text-faint">
        <span
          ><b class="font-medium text-secondary">{model.hasPageIndex ? "Indexes + footer" : "Footer"}</b> magnified</span
        >
        <span>{formatBytes(model.fileSize - model.tailStart)}</span>
      </div>
      <ByteStrip pieces={tail} from={model.tailStart} to={model.fileSize} label="Indexes and footer" />
    </div>
  </div>
  <Legend />
  <p class="mt-1.5 mb-0 text-[11.5px] text-faint">
    <span class="[@media(hover:none)]:hidden">Hover a page for details, click to open its row group below.</span>
    <span class="hidden [@media(hover:none)]:inline">Tap a row group to open it below.</span>
  </p>
</section>
