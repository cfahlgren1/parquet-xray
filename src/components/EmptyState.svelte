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

<div class="empty">
  <div class="strip" aria-hidden="true">
    <span style:flex="3"></span>
    <span style:flex="1.2" class="dict"></span>
    <span style:flex="2.4"></span>
    <span style:flex="1" class="dict"></span>
    <span style:flex="2.8"></span>
    <span style:flex=".5" class="footer"></span>
  </div>
  <ol>
    {#each steps as step (step.name)}
      <li><b>{step.name}</b> {step.text}</li>
    {/each}
  </ol>
</div>

<style>
  .empty {
    margin-top: 26px;
    padding: 22px;
    border: 1px dashed var(--line);
    border-radius: 12px;
    color: #4b5563;
  }

  .strip {
    display: flex;
    gap: 2px;
    height: 22px;
    margin-bottom: 16px;
  }

  .strip span {
    border-radius: 2px;
    background: #c3c8d0;
  }

  .strip .dict {
    background: #e2e5ea;
  }

  .strip .footer {
    background: #4b5563;
  }

  ol {
    display: grid;
    gap: 8px;
    margin: 0;
    padding-left: 18px;
  }

  b {
    display: inline-block;
    min-width: 86px;
    font-weight: 600;
    color: var(--text);
  }
</style>
