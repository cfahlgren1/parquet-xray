<script lang="ts">
  import Efficiency from "./Efficiency.svelte";
  import { getInspector } from "../lib/inspector.svelte";
  import { formatBytes, formatNumber } from "../lib/format";
  import { shareUrl, toQuery } from "../lib/share";

  const inspector = getInspector();
  const { model } = inspector;
  const { metadata } = model;

  const stats = [
    { label: "Size", value: formatBytes(model.fileSize) },
    { label: "Rows", value: formatNumber(metadata.num_rows) },
    { label: "Row groups", value: formatNumber(metadata.row_groups.length) },
    { label: "Columns", value: formatNumber(model.leaves.length) },
    { label: "Footer", value: formatBytes(model.footerLength) },
  ];

  let copied = $state(false);

  async function copyLink() {
    const { source, selectedRg, selectedLeaf } = inspector;
    if (source === null) return;
    const col = selectedLeaf === null ? null : (model.leaves[selectedLeaf]?.path ?? null);
    await navigator.clipboard.writeText(shareUrl(toQuery({ url: source, rg: selectedRg, col }), location));
    copied = true;
    setTimeout(() => (copied = false), 1500);
  }
</script>

<section class="rounded-[12px] border border-solid border-line" aria-label="File summary">
  <header
    class="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-t-[12px] border-0 border-b border-solid border-line bg-surface-alt py-2.5 pr-3 pl-4 compact:px-3"
  >
    <h2 class="m-0 min-w-0 truncate font-mono text-[14px] font-semibold">{model.name}</h2>
    <span class="text-[12px] text-subtle compact:order-3 compact:basis-full">{inspector.loadSummary}</span>
    {#if inspector.source !== null}
      <button
        class="ml-auto cursor-pointer rounded-md border border-solid border-line bg-surface px-2.5 py-[3px] text-[12px] text-secondary hover:border-[#d1d5db]"
        type="button"
        onclick={copyLink}>{copied ? "Copied" : "Copy link"}</button
      >
    {/if}
  </header>
  <dl
    class="m-0 grid grid-cols-[repeat(5,minmax(0,1fr))_minmax(0,1.6fr)] gap-3 px-4 py-3 compact:grid-cols-3 compact:px-3"
  >
    {#each stats as stat (stat.label)}
      <div>
        <dt class="text-[11.5px] text-subtle">{stat.label}</dt>
        <dd class="mx-0 mt-0.5 mb-0 truncate text-[15px] font-semibold">{stat.value}</dd>
      </div>
    {/each}
    <div class="compact:col-span-full">
      <dt class="text-[11.5px] text-subtle">Created by</dt>
      <dd class="mx-0 mt-1 mb-0 truncate font-mono text-[12.5px] font-medium">{metadata.created_by ?? "unknown"}</dd>
    </div>
  </dl>
  <Efficiency />
</section>
