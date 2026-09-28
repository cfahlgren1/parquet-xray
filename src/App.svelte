<script lang="ts">
  import EmptyState from "./components/EmptyState.svelte";
  import GitHubLink from "./components/GitHubLink.svelte";
  import SourceInput from "./components/SourceInput.svelte";
  import Viewer from "./components/Viewer.svelte";
  import { Inspector } from "./lib/inspector.svelte";
  import { formatBytes } from "./lib/format";
  import { describeError, loadParquet } from "./lib/parquet/load";
  import { fileSource, resolveUrl, urlSource, type Source } from "./lib/parquet/source";
  import { fromQuery } from "./lib/share";

  let input = $state("");
  let status = $state<{ text: string; error?: boolean } | null>(null);
  let inspector = $state.raw<Inspector | null>(null);
  let dragging = $state(false);
  /** Ignores results from a load that a newer one replaced. */
  let loadId = 0;

  async function load(
    name: string,
    open: () => Promise<Source>,
    source: string | null,
    initial: { rg: number | null; col: string | null } = { rg: null, col: null },
  ) {
    const id = ++loadId;
    status = { text: `Reading ${name}…` };
    inspector = null;
    const started = performance.now();
    try {
      const { model, counter } = await loadParquet(name, open);
      if (id !== loadId) return;
      inspector = new Inspector(model, source, initial);
      const ms = Math.round(performance.now() - started);
      const requests = `${counter.requests} range request${counter.requests === 1 ? "" : "s"}`;
      status = {
        text: `Read ${formatBytes(counter.bytes)} of ${formatBytes(model.fileSize)} in ${requests} · ${ms} ms`,
      };
    } catch (error) {
      if (id !== loadId) return;
      console.error(error);
      status = { text: `Couldn't read ${name}: ${describeError(error)}`, error: true };
    }
  }

  function openUrl(raw: string, initial?: { rg: number | null; col: string | null }) {
    input = raw;
    const name = raw.split("/").pop() ?? raw;
    void load(name, () => urlSource(resolveUrl(raw)), raw, initial);
  }

  function openFile(file: File) {
    input = file.name;
    void load(file.name, () => fileSource(file), null);
  }

  function ondrop(event: DragEvent) {
    event.preventDefault();
    dragging = false;
    const file = event.dataTransfer?.files[0];
    if (file) openFile(file);
  }

  const initial = fromQuery(location.search);
  if (initial) openUrl(initial.url, initial);
</script>

<svelte:window
  ondragover={(event) => {
    event.preventDefault();
    dragging = true;
  }}
  ondragleave={(event) => {
    if (!event.relatedTarget) dragging = false;
  }}
  {ondrop}
/>

<div class="page">
  <header>
    <div class="title">
      <h1><span class="logo" aria-hidden="true">▦</span> Parquet X-ray</h1>
      <GitHubLink />
    </div>
    <p>See how a Parquet file is laid out, byte by byte. Only the footer and indexes are downloaded.</p>
  </header>

  <SourceInput bind:value={input} onurl={(url) => openUrl(url)} onfile={openFile} />

  <p class="status" class:error={status?.error} role="status">{status?.text ?? ""}</p>

  {#if inspector}
    {#key inspector}
      <Viewer {inspector} />
    {/key}
  {:else if !status}
    <EmptyState />
  {/if}
</div>

{#if dragging}
  <div class="drop">Drop a .parquet file anywhere</div>
{/if}

<style>
  .page {
    max-width: 1280px;
    margin: 0 auto;
    padding: 28px 28px 60px;
  }

  header {
    margin-bottom: 16px;
  }

  .title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  h1 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 20px;
  }

  .logo {
    color: #6366f1;
  }

  header p {
    margin: 4px 0 0;
    color: var(--text-3);
  }

  .status {
    min-height: 18px;
    margin: 18px 0 0;
    font-size: 12px;
    color: var(--text-3);
  }

  .status.error {
    color: var(--error);
  }

  .drop {
    position: fixed;
    inset: 12px;
    z-index: 20;
    display: grid;
    place-items: center;
    border: 2px dashed #818cf8;
    border-radius: 16px;
    background: rgb(238 242 255 / 85%);
    font-size: 18px;
    color: #4338ca;
    pointer-events: none;
  }

  @media (max-width: 700px) {
    .page {
      padding: 18px 14px 40px;
    }
    h1 {
      font-size: 18px;
    }
    header p {
      font-size: 12.5px;
    }
  }
</style>
