<script lang="ts">
  /** Names longer than this keep their end visible, so siblings that share a long prefix stay distinguishable. */
  const MAX_WHOLE = 32;
  const TAIL = 26;

  let { name }: { name: string } = $props();
  const split = $derived(name.length > MAX_WHOLE);
</script>

{#if split}
  <span class="name split" title={name}>
    <span class="head">{name.slice(0, -TAIL)}</span>
    <span class="tail"><span>{name.slice(-TAIL)}</span></span>
  </span>
{:else}
  <span class="name whole">{name}</span>
{/if}

<style>
  .whole {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .split {
    display: flex;
    flex: 0 1 auto;
    min-width: 0;
  }

  .head {
    flex: 0 1000 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Clips from the left on narrow screens, keeping the end of the name. */
  .tail {
    display: flex;
    flex: 0 1 auto;
    justify-content: flex-end;
    min-width: 0;
    overflow: hidden;
  }
</style>
