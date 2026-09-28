<script lang="ts">
  import { getInspector } from "../lib/inspector.svelte";
  import { readEfficiency, summarizeNames } from "../lib/parquet/efficiency";

  const { model } = getInspector();
  const checks = readEfficiency(model);

  // Phones have no hover, so tapping a badge shows its explanation under the badges instead of a tooltip.
  let note = $state("");
</script>

<section>
  <span class="label">Read efficiency</span>
  {#each checks as check (check.label)}
    <button
      type="button"
      class="chip"
      class:passed={check.passed}
      data-tip={check.detail}
      onclick={() => (note = note === check.detail ? "" : check.detail)}
    >
      <span aria-hidden="true">{check.passed ? "✓" : "–"}</span>
      <b>{check.label}</b>
      {#if check.columns.length}
        <span class="columns mono">{summarizeNames(check.columns)}</span>
      {/if}
    </button>
  {/each}
  {#if note}
    <p class="note">{note}</p>
  {/if}
</section>

<style>
  section {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .label {
    margin-right: 4px;
    font-size: 12px;
    color: var(--text-3);
  }

  .chip {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px 3px 8px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--surface);
    font-size: 12px;
    color: var(--text-3);
    cursor: help;
  }

  .chip b {
    font-weight: 500;
  }

  .columns {
    max-width: 260px;
    overflow: hidden;
    font-size: 11.5px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chip.passed {
    border-color: var(--ok-line);
    background: var(--ok-soft);
    color: #065f46;
  }

  .chip.passed .columns {
    color: var(--ok);
  }

  .chip:hover::after,
  .chip:focus-visible::after {
    content: attr(data-tip);
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 20;
    width: max-content;
    max-width: 280px;
    padding: 7px 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: 0 8px 24px -8px rgb(17 24 39 / 20%);
    font-size: 12px;
    font-weight: 400;
    line-height: 1.4;
    color: var(--text-2);
    text-align: left;
    white-space: normal;
  }

  .note {
    display: none;
    flex-basis: 100%;
    margin: 0;
    padding: 2px 2px 0;
    font-size: 12px;
    color: var(--text-2);
  }

  @media (max-width: 700px) {
    .label {
      flex-basis: 100%;
    }
    .chip::after {
      display: none;
    }
    .note {
      display: block;
    }
  }
</style>
