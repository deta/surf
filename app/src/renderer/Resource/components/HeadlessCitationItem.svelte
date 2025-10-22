<script lang="ts">
  import { getHostname, truncate } from '@deta/utils'

  export let url: string
  export let title: string
  export let maxTitleLength: number = 40

  const hostname = getHostname(url)
  const displayTitle = truncate(title, maxTitleLength)
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<citation class="headless-citation">
  <div class="citation-content">
    {#if hostname}
      <img
        src="https://www.google.com/s2/favicons?domain={url}&sz=40"
        alt="source icon"
        class="citation-icon"
      />
    {/if}
    <div class="citation-text">
      {displayTitle}
    </div>
  </div>
</citation>

<style lang="scss">
  .headless-citation {
    display: inline-flex;
    align-items: center;
    justify-content: start;
    border-radius: var(--t-3);
    font-family: var(--default);
    font-size: var(--t-13);
    font-weight: var(--medium);
    height: auto;
    text-align: center;
    user-select: none;
    overflow: hidden;
    line-height: 0.8;
    padding: var(--t-1) var(--t-2);
    max-width: 100%;
    background: light-dark(rgba(0, 0, 0, 0.06), rgba(255, 255, 255, 0.1));
    margin-right: var(--t-1);
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: light-dark(rgba(109, 130, 255, 0.2), rgba(109, 130, 255, 0.3));
    }
  }
  .citation-content {
    display: flex;
    align-items: center;
    gap: var(--t-1);
    overflow: hidden;
    max-width: 100%;
  }

  .citation-icon {
    width: 1em;
    height: 1em;
    flex-shrink: 0;
    border-radius: var(--t-1);
    margin: 0;
    user-select: none;
    pointer-events: none;
  }

  .citation-text {
    font-size: var(--t-12-6);
    line-height: 1.25em;
    font-weight: var(--medium);
    color: var(--on-surface);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
    flex: 1;
  }

  :global(.dark) .headless-citation {
    background: rgba(255, 255, 255, 0.1);
  }

  :global(.dark) .headless-citation:hover {
    background: rgba(109, 130, 255, 0.3);
  }
</style>
