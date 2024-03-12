<script lang="ts" context="module">
  import type { Icons } from '@horizon/icons'

  export type Tab = {
    key: string
    label: string
    icon?: Icons
  }
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { Icon } from '@horizon/icons'

  export let selected: string | null = null
  export let tabs: Tab[] = []

  const dispatch = createEventDispatcher<{ select: string }>()

  const select = (key: string) => {
    dispatch('select', key)
    selected = key
  }
</script>

<div class="drawer-tabs">
  {#each tabs as tab}
    <button
      on:click={() => select(tab.key)}
      class="drawer-tab"
      class:selected={tab.key === selected}
    >
      <!-- {#if tab.icon}
        <Icon name={tab.icon} size="20px" color={tab.key === selected ? '#FFFFFF' : '#959599'} />
      {/if} -->
      <span class="tab-label">{tab.label}</span>
    </button>
  {/each}
</div>

<style lang="scss">
  .drawer-tabs {
    display: flex;
    align-items: center;
    padding: 1rem;
    gap: 0.5rem;
  }

  .drawer-tab {
    appearance: none;
    background-color: transparent;
    border: none;
    outline: none;
    color: var(--color-text-muted);

    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    cursor: default;
    transition-property: background-color, color;
    transition-duration: 0.2s;
    transition-timing-function: ease;

    &:hover {
      color: var(--color-text);
      background-color: #e2dee4;
    }

    &.selected {
      color: white;
      background: var(--color-brand);
    }

    &.selected:hover {
      color: white;
      background: var(--color-brand);
    }

    .tab-label {
      font-size: 1.125rem;
      letter-spacing: 0.01rem;
      font-weight: 500;
      text-wrap: nowrap;
      user-select: none;
    }
  }
</style>
