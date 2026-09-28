<script lang="ts">
  import ColumnName from "./ColumnName.svelte";
  import ColumnPanel from "./ColumnPanel.svelte";
  import { leafColor } from "../lib/colors";
  import { formatBytes } from "../lib/format";
  import { getInspector } from "../lib/inspector.svelte";
  import { schemaLines } from "../lib/parquet/schema";

  const inspector = getInspector();
  const { model } = inspector;
  const lines = schemaLines(model.metadata);
  const lineClass =
    "grid grid-cols-[30px_minmax(0,1fr)_130px] items-center w-full h-6 p-0 border-0 text-left compact:grid-cols-[26px_minmax(0,1fr)_64px]";
  const totalBytes = model.leafBytes.reduce((a, b) => a + b, 0);
</script>

<section>
  <h2>Schema <small>size on disk · click a column to find it in the file</small></h2>
  <div class="rounded-lg bg-surface-alt py-1.5 font-mono text-[12.5px] outline outline-line outline-solid">
    {#each lines as line, n (n)}
      {@const leaf = line.leaf}
      {#if leaf === undefined}
        <div class={[lineClass, "bg-transparent"]}>
          <span class="pr-2.5 text-right text-[#d1d5db]">{n + 1}</span>
          <span class="flex min-w-0 overflow-hidden pr-3 whitespace-pre" style:padding-left="{line.depth * 2}ch">
            {#if line.keyword}<span class="flex-none text-[#e11d48]">{line.keyword}&nbsp;</span>{/if}
            {#if line.name}<ColumnName class="font-semibold" name={line.name} />{/if}
            {#if line.annotation}<span class="min-w-0 flex-[0_1000_auto] overflow-hidden text-ellipsis text-[#0d9488]"
                >{line.annotation}</span
              >{/if}
            <span class="flex-none"
              >{#if line.punct !== "}"}&nbsp;{/if}{line.punct}</span
            >
          </span>
        </div>
      {:else}
        {@const color = leafColor(leaf, inspector.selectedLeaf)}
        {@const bytes = model.leafBytes[leaf] ?? 0}
        <button
          type="button"
          class={[
            lineClass,
            "cursor-pointer hover:bg-accent-soft",
            inspector.selectedLeaf === leaf ? "bg-accent-soft shadow-[inset_3px_0_0_#818cf8]" : "bg-transparent",
          ]}
          aria-label="Column {model.leaves[leaf]?.path}, {formatBytes(bytes)}"
          aria-pressed={inspector.selectedLeaf === leaf}
          onclick={() => inspector.toggleLeaf(leaf)}
        >
          <span class="pr-2.5 text-right text-[#d1d5db]">{n + 1}</span>
          <span class="flex min-w-0 overflow-hidden pr-3 whitespace-pre" style:padding-left="{line.depth * 2}ch">
            <span class={["flex-none text-[#e11d48]", line.keyword === "optional" && "compact:hidden"]}
              >{line.keyword}&nbsp;</span
            >
            <span class="flex-none text-[#7c3aed]">{line.type}&nbsp;</span>
            <ColumnName class="font-semibold" name={line.name ?? ""} />
            {#if line.annotation}<span class="min-w-0 flex-[0_1000_auto] overflow-hidden text-ellipsis text-[#0d9488]"
                >{line.annotation}</span
              >{/if}
            <span class="flex-none">;</span>
          </span>
          <span class="flex items-center gap-2 pr-3 text-[11px] text-faint">
            <span class="relative h-1 flex-1 rounded-[1px] bg-[#eceef2] compact:hidden"
              ><span
                class="absolute inset-y-0 left-0 min-w-px rounded-[1px]"
                style:width="{(bytes / totalBytes) * 100}%"
                style:background={color}
              ></span></span
            >
            <span class="hidden size-2 flex-none rounded-[2px] compact:block" style:background={color}></span>
            <span class="w-15 text-right whitespace-nowrap compact:w-auto">{formatBytes(bytes)}</span>
          </span>
        </button>
        {#if inspector.selectedLeaf === leaf}
          <ColumnPanel {leaf} depth={line.depth} />
        {/if}
      {/if}
    {/each}
  </div>
</section>
