<script lang="ts">
  import ColumnName from "./ColumnName.svelte";
  import { leafColor } from "../lib/colors";
  import { formatNumber } from "../lib/format";
  import { getInspector } from "../lib/inspector.svelte";

  const MAX_COLUMNS = 12;

  const inspector = getInspector();
  const shown = inspector.model.leaves.slice(0, MAX_COLUMNS);
  const hidden = inspector.model.leaves.length - shown.length;
</script>

<div class="mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11.5px] text-[#4b5563]">
  {#each shown as leaf, i (leaf.path)}
    <span
      class={[
        "inline-flex max-w-full min-w-0 items-center gap-[5px]",
        inspector.selectedLeaf !== null && inspector.selectedLeaf !== i && "opacity-40",
      ]}
    >
      <span class="inline-block size-2.5 flex-none rounded-[2px]" style:background={leafColor(i, null)}></span>
      <span class="flex min-w-0 font-mono"><ColumnName name={leaf.path} /></span>
    </span>
  {/each}
  {#if hidden > 0}
    <span class="text-faint">+{formatNumber(hidden)} more</span>
  {/if}
  <span class="ml-auto inline-flex gap-[13px] text-faint compact:ml-0">
    <span class="inline-flex max-w-full min-w-0 items-center gap-[5px]"
      ><span class="inline-block size-2.5 flex-none rounded-[2px] bg-line"></span>dictionary page</span
    >
    <span class="inline-flex max-w-full min-w-0 items-center gap-[5px]"
      ><span class="inline-block size-2.5 flex-none rounded-[2px] bg-[#b8bec8]"></span>data page</span
    >
    <span class="inline-flex max-w-full min-w-0 items-center gap-[5px]"
      ><span
        class="inline-block size-2.5 flex-none rounded-[2px] bg-[linear-gradient(90deg,#b8bec8_45%,#fff_45%_55%,#b8bec8_55%)]"
      ></span>page boundary</span
    >
  </span>
</div>
