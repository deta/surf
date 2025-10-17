<script lang="ts">
  import { SEARCH_ENGINES } from '@deta/utils/browser'
  import { createEventDispatcher } from 'svelte'

  export let value: string = 'google'
  const dispatch = createEventDispatcher<{ update: string }>()

  // they wouldnt let me keep gmail in here :')
  const AVAILABLE_ENGINES = ['google', 'duckduckgo', 'ecosia', 'brave', 'perplexity', 'kagi'].map(
    (key) => SEARCH_ENGINES.filter((e) => e.key === key).at(0)
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
    color: light-dark(var(--color-text), var(--on-surface-dark, #cbd5f5));
  }

  select {
    font-size: 1.1rem;
    line-height: 1;
    padding: 0.5rem;
    border-radius: 8px;
    border: 1px solid light-dark(var(--color-border), rgba(71, 85, 105, 0.4));
    background: light-dark(var(--color-background), var(--surface-elevated-dark, #1b2435));
    color: light-dark(var(--color-text), var(--on-surface-dark, #cbd5f5));
    min-width: 20ch;
  }
</style>
