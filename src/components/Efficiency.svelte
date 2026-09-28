<script lang="ts">
  import { getInspector } from "../lib/inspector.svelte";
  import { readEfficiency, summarizeNames } from "../lib/parquet/efficiency";

  const { model } = getInspector();
  const checks = readEfficiency(model);

  // Phones have no hover, so tapping a badge shows its explanation under the badges instead of a tooltip.
  let note = $state("");
</script>

<div
  class="flex flex-wrap items-center gap-2 border-0 border-t border-solid border-line-soft px-4 pt-2.5 pb-3 compact:px-3"
  role="group"
  aria-label="Read efficiency"
>
  {#each checks as check (check.label)}
    <button
      type="button"
      class={[
        "relative inline-flex cursor-help items-center gap-1.5 rounded-[999px] border border-solid py-[3px] pr-2.5 pl-2 text-[12px]",
        "after:absolute after:top-[calc(100%+6px)] after:left-0 after:z-20 after:hidden after:w-max after:max-w-70 after:rounded-lg after:border after:border-solid after:border-line after:bg-surface after:px-2.5 after:py-[7px] after:text-left after:text-[12px] after:leading-[1.4] after:font-normal after:whitespace-normal after:text-secondary after:shadow-[0_8px_24px_-8px_rgb(17_24_39/20%)] after:content-[attr(data-tip)] hover:after:block focus-visible:after:block compact:after:hidden!",
        check.passed ? "border-ok-line bg-ok-soft text-[#065f46]" : "border-line bg-surface text-subtle",
      ]}
      data-tip={check.detail}
      onclick={() => (note = note === check.detail ? "" : check.detail)}
    >
      <span aria-hidden="true">{check.passed ? "✓" : "–"}</span>
      <b class="font-medium">{check.label}</b>
      {#if check.columns.length}
        <span class={["max-w-65 truncate font-mono text-[11.5px]", check.passed && "text-ok"]}
          >{summarizeNames(check.columns)}</span
        >
      {/if}
    </button>
  {/each}
  {#if note}
    <p class="m-0 hidden basis-full px-0.5 pt-0.5 pb-0 text-[12px] text-secondary compact:block">{note}</p>
  {/if}
</div>
