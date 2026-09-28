<script lang="ts">
  interface Props {
    value: string;
    onurl: (url: string) => void;
    onfile: (file: File) => void;
  }

  let { value = $bindable(), onurl, onfile }: Props = $props();

  const examples = [
    { label: "sensors (sorted, page index, bloom filter)", url: "sensors.parquet" },
    {
      label: "fineweb-edu shard (2 GB)",
      url: "https://huggingface.co/datasets/HuggingFaceFW/fineweb-edu/resolve/main/sample/10BT/000_00000.parquet",
    },
    { label: "gsm8k", url: "hf://datasets/openai/gsm8k/main/test-00000-of-00001.parquet" },
  ];

  function onsubmit(event: SubmitEvent) {
    event.preventDefault();
    if (value.trim()) onurl(value);
  }

  function onchange(event: Event & { currentTarget: HTMLInputElement }) {
    const file = event.currentTarget.files?.[0];
    if (file) onfile(file);
  }
</script>

<form class="flex gap-2 compact:flex-wrap" {onsubmit}>
  <input
    class="flex-1 rounded-lg border border-solid border-[#d1d5db] px-3 py-[9px] font-mono text-[13px] [outline:none] focus:border-[#818cf8] focus:shadow-[0_0_0_3px_var(--color-accent-soft)] compact:basis-full compact:text-[16px]"
    bind:value
    type="text"
    spellcheck="false"
    autocomplete="off"
    aria-label="Parquet file URL"
    placeholder="Paste a Parquet URL, a Hub file URL, or hf://datasets/owner/repo/file.parquet"
  />
  <button
    type="submit"
    class="cursor-pointer rounded-lg border-0 bg-ink px-4 py-0 font-semibold text-white compact:h-10 compact:flex-1"
    >Inspect</button
  >
  <label
    class="grid cursor-pointer place-items-center rounded-lg border border-solid border-[#d1d5db] px-3.5 py-0 text-secondary compact:h-10 compact:flex-1"
    >Open file<input type="file" accept=".parquet" hidden {onchange} /></label
  >
</form>

<div
  class="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] compact:flex-nowrap compact:overflow-x-auto compact:pb-1"
>
  <span class="text-faint">Try</span>
  {#each examples as example (example.url)}
    <button
      class="cursor-pointer rounded-[999px] border border-solid border-line bg-surface-alt px-2.5 py-[3px] text-[12px] text-secondary hover:border-accent-line hover:bg-accent-soft compact:whitespace-nowrap"
      type="button"
      onclick={() => onurl(example.url)}>{example.label}</button
    >
  {/each}
</div>
