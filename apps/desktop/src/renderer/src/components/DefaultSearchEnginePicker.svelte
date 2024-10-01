<script lang="ts">
  import { SEARCH_ENGINES } from '@horizon/core/src/lib/constants/searchEngines'
  import { createEventDispatcher } from 'svelte'

  export let value: string = 'google'
  const dispatch = createEventDispatcher<{ update: string }>()

  // they wouldnt let me keep gmail in here :')
  const AVAILABLE_ENGINES = ['google', 'duckduckgo', 'ecosia', 'brave', 'perplexity'].map((key) =>
    SEARCH_ENGINES.filter((e) => e.key === key).at(0)
  )
</script>

<div class="wrapper">
  <h3>Default Search Engine</h3>
  <select bind:value on:change={(e) => dispatch('update', e.target.value)}>
    {#each AVAILABLE_ENGINES as engine}
      <option value={engine.key}>{engine.key.charAt(0).toUpperCase() + engine.key.slice(1)}</option>
    {/each}
  </select>
</div>

<style lang="scss">
  .wrapper {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  h3 {
    line-height: 1;
    font-size: 1.2rem;
    font-weight: 500;
    color: var(--color-text);
  }

  select {
    font-size: 1.1rem;
    line-height: 1;
    padding: 0.5rem;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    background: var(--color-background);
    color: var(--color-text);
    min-width: 20ch;
  }
</style>
