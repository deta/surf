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

<h2>Default Search Engine</h2>
<select bind:value on:change={(e) => dispatch('update', e.target.value)}>
  {#each AVAILABLE_ENGINES as engine}
    <option value={engine.key}>{engine.key.charAt(0).toUpperCase() + engine.key.slice(1)}</option>
  {/each}
</select>

<style lang="scss">
  select {
    font-size: 1.1rem;
    padding: 0.5rem;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    background: var(--color-background);
    color: var(--color-text);
    margin-top: 0.5rem;
    min-width: 20ch;
  }
</style>
