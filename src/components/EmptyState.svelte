<script lang="ts">
  const steps = [
    {
      name: "File",
      text: "Every row group laid out by its position in the file, with the page indexes and footer magnified.",
    },
    { name: "Row group", text: "Click one to see each column chunk split into its dictionary and data pages." },
    { name: "Page", text: "Hover or tap a page for its byte range, rows and min/max from the page index." },
  ];
</script>

<div class="mt-6.5 rounded-[12px] border border-dashed border-line p-5.5 text-[#4b5563]">
  <div class="mb-4 flex h-5.5 gap-0.5" aria-hidden="true">
    <span class="flex-[3] rounded-[2px] bg-[#c3c8d0]"></span>
    <span class="flex-[1.2] rounded-[2px] bg-[#e2e5ea]"></span>
    <span class="flex-[2.4] rounded-[2px] bg-[#c3c8d0]"></span>
    <span class="flex-1 rounded-[2px] bg-[#e2e5ea]"></span>
    <span class="flex-[2.8] rounded-[2px] bg-[#c3c8d0]"></span>
    <span class="flex-[0.5] rounded-[2px] bg-[#4b5563]"></span>
  </div>
  <ol class="m-0 grid gap-2 pl-4.5">
    {#each steps as step (step.name)}
      <li><b class="inline-block min-w-[86px] font-semibold text-ink">{step.name}</b> {step.text}</li>
    {/each}
  </ol>
</div>
