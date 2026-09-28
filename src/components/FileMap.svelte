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

<section class="card">
  <div class="strips">
    <div>
      <div class="caption">
        <span><b>File</b> · {formatNumber(model.rowGroups.length)} row groups · click one to open it</span>
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
      <div class="caption">
        <span><b>{model.hasPageIndex ? "Indexes + footer" : "Footer"}</b> magnified</span>
        <span>{formatBytes(model.fileSize - model.tailStart)}</span>
      </div>
      <ByteStrip pieces={tail} from={model.tailStart} to={model.fileSize} label="Indexes and footer" />
    </div>
  </div>
  <Legend />
  <p class="hint">
    <span class="on-hover">Hover a page for details, click to open its row group below.</span>
    <span class="on-touch">Tap a row group to open it below.</span>
  </p>
</section>

<style>
  .card {
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
  }

  .strips {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 220px;
    gap: 16px;
  }

  .caption {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
    font-size: 11px;
    color: var(--text-4);
  }

  .caption b {
    font-weight: 500;
    color: var(--text-2);
  }

  .hint {
    margin: 6px 0 0;
    font-size: 11.5px;
    color: var(--text-4);
  }

  @media (max-width: 700px) {
    .card {
      padding: 12px;
    }
    .strips {
      grid-template-columns: minmax(0, 1fr);
      gap: 10px;
    }
  }
</style>
