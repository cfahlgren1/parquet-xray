<script lang="ts">
  /** Names longer than this keep their end visible, so siblings that share a long prefix stay distinguishable. */
  const MAX_WHOLE = 32;
  const TAIL = 26;

  let { name, class: className = "" }: { name: string; class?: string } = $props();
  const split = $derived(name.length > MAX_WHOLE);
</script>

{#if split}
  <span class={["flex min-w-0 flex-[0_1_auto]", className]} title={name}>
    <span class="min-w-0 flex-[0_1000_auto] overflow-hidden text-ellipsis">{name.slice(0, -TAIL)}</span>
    <span class="flex min-w-0 flex-[0_1_auto] justify-end overflow-hidden"><span>{name.slice(-TAIL)}</span></span>
  </span>
{:else}
  <span class={["min-w-0 flex-[0_1_auto] overflow-hidden text-ellipsis", className]}>{name}</span>
{/if}
