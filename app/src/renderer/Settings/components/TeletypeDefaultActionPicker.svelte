<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  export let value: 'auto' | 'always_ask' | 'always_search' = 'auto'
  const dispatch = createEventDispatcher<{ update: string }>()

  const AVAILABLE_OPTIONS = [
    { key: 'auto', label: 'Auto (Smart)', description: 'Automatically select based on query type' },
    {
      key: 'always_ask',
      label: 'Always Ask Surf',
      description: 'Always default to Ask Surf action'
    },
    {
      key: 'always_search',
      label: 'Always Web Search',
      description: 'Always default to Search Web action'
    }
  ]
</script>

<div class="wrapper">
  <div class="header">
    <h3>Teletype Default Action</h3>
    <p class="description">Choose how the command bar selects actions by default</p>
  </div>
  <select bind:value on:change={(e) => dispatch('update', e.target.value)}>
    {#each AVAILABLE_OPTIONS as option}
      <option value={option.key}>{option.label}</option>
    {/each}
  </select>
</div>

<style lang="scss">
  .wrapper {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 1rem;
  }

  .header {
    flex: 1;
  }

  h3 {
    line-height: 1;
    font-size: 1.2rem;
    font-weight: 500;
    color: light-dark(var(--color-text), var(--on-surface-dark, #cbd5f5));
    margin: 0 0 0.25rem 0;
  }

  .description {
    font-size: 0.9rem;
    color: light-dark(var(--color-text-muted), var(--text-subtle-dark, #94a3b8));
    margin: 0;
    line-height: 1.3;
  }

  select {
    font-size: 1.1rem;
    line-height: 1;
    padding: 0.5rem;
    border-radius: 8px;
    border: 1px solid light-dark(var(--color-border), rgba(71, 85, 105, 0.4));
    background: light-dark(var(--color-background), var(--surface-elevated-dark, #1b2435));
    color: light-dark(var(--color-text), var(--on-surface-dark, #cbd5f5));
    min-width: 24ch;
    flex-shrink: 0;
  }
</style>
