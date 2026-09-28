<script lang="ts">
  import { getInspector } from "../lib/inspector.svelte";
  import { formatBytes, formatNumber } from "../lib/format";
  import { shareUrl, toQuery } from "../lib/share";

  const inspector = getInspector();
  const { model } = inspector;
  const { metadata } = model;

  const facts: { label: string; value: string; mono?: boolean }[] = [
    { label: "File", value: model.name, mono: true },
    { label: "Size", value: formatBytes(model.fileSize) },
    { label: "Rows", value: formatNumber(metadata.num_rows) },
    { label: "Row groups", value: formatNumber(metadata.row_groups.length) },
    { label: "Columns", value: formatNumber(model.leaves.length) },
    { label: "Footer", value: formatBytes(model.footerLength) },
    { label: "Created by", value: metadata.created_by ?? "unknown", mono: true },
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

<section>
  {#each facts as fact (fact.label)}
    <span><span class="label">{fact.label}</span><b class:mono={fact.mono}>{fact.value}</b></span>
  {/each}
  {#if inspector.source !== null}
    <button type="button" onclick={copyLink}>{copied ? "Copied" : "Copy link"}</button>
  {/if}
</section>

<style>
  section {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 22px;
    font-size: 12.5px;
  }

  b {
    font-weight: 500;
  }

  .label {
    margin-right: 5px;
    color: var(--text-3);
  }

  button {
    margin-left: auto;
    padding: 2px 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
    font-size: 12px;
    color: var(--text-2);
    cursor: pointer;
  }

  button:hover {
    border-color: #d1d5db;
    background: var(--surface-2);
  }

  @media (max-width: 700px) {
    section {
      gap: 4px 14px;
      font-size: 12px;
    }
  }
</style>
