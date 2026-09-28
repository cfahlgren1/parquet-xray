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
      const ms = Math.round(performance.now() - started);
      const requests = `${counter.requests} request${counter.requests === 1 ? "" : "s"}`;
      const summary = `read ${formatBytes(counter.bytes)} of ${formatBytes(model.fileSize)} · ${requests} · ${ms} ms`;
      inspector = new Inspector(model, source, initial, summary);
      status = null;
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

<div class="mx-auto max-w-[1280px] px-7 pt-7 pb-15 compact:px-3.5 compact:pt-4.5 compact:pb-10">
  <header class="mb-4">
    <div class="flex items-center justify-between gap-3">
      <h1 class="m-0 flex items-center gap-2 text-[20px] compact:text-[18px]">
        <span class="text-[#6366f1]" aria-hidden="true">▦</span> Parquet X-ray
      </h1>
      <GitHubLink />
    </div>
    <p class="mt-1 mb-0 text-subtle compact:text-[12.5px]">
      See how a Parquet file is laid out, byte by byte. Only the footer and indexes are downloaded.
    </p>
  </header>

  <SourceInput bind:value={input} onurl={(url) => openUrl(url)} onfile={openFile} />

  <p
    class={["mt-4.5 mb-0 min-h-4.5 text-[12px] empty:m-0 empty:min-h-0", status?.error ? "text-error" : "text-subtle"]}
    role="status"
  >
    {status?.text ?? ""}
  </p>

  {#if inspector}
    {#key inspector}
      <Viewer {inspector} />
    {/key}
  {:else if !status?.text}
    <EmptyState />
  {/if}
</div>

{#if dragging}
  <div
    class="pointer-events-none fixed inset-3 z-20 grid place-items-center rounded-[16px] border-2 border-dashed border-[#818cf8] bg-[rgb(238_242_255/85%)] text-[18px] text-[#4338ca]"
  >
    Drop a .parquet file anywhere
  </div>
{/if}
