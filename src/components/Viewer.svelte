<script lang="ts">
  import FileSummary from "./FileSummary.svelte";
  import FileMap from "./FileMap.svelte";
  import Popover from "./Popover.svelte";
  import RowGroups from "./RowGroups.svelte";
  import Schema from "./Schema.svelte";
  import { setInspector, type Inspector } from "../lib/inspector.svelte";
  import { publishQuery, toQuery } from "../lib/share";

  let { inspector }: { inspector: Inspector } = $props();
  // The parent re-creates this component per file, so the inspector never changes underneath it.
  // svelte-ignore state_referenced_locally
  setInspector(inspector);

  $effect(() => {
    const { source, selectedRg, selectedLeaf, model } = inspector;
    if (source === null) return;
    const col = selectedLeaf === null ? null : (model.leaves[selectedLeaf]?.path ?? null);
    publishQuery(toQuery({ url: source, rg: selectedRg, col }));
  });
</script>

<svelte:document onclick={() => inspector.hidePopover()} />

<main class="mt-4.5 grid grid-cols-1 gap-4.5">
  <FileSummary />
  <FileMap />
  {#if inspector.model.geo}
    <!-- Loaded only for files with geometry, along with MapLibre and proj4. -->
    {#await import("./GeoMap.svelte") then { default: GeoMap }}<GeoMap />{/await}
  {/if}
  <div class="grid grid-cols-2 items-start gap-4.5 stacked:grid-cols-1">
    <Schema />
    <RowGroups />
  </div>
</main>

<Popover />
