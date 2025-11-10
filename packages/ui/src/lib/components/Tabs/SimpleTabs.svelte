<script lang="ts" context="module">
  export type Tab = {
    id: string
    label: string
    icon?: string
    disabled?: boolean
  }
</script>

<script lang="ts">
  import { DynamicIcon } from '@deta/icons'

  let {
    tabs,
    activeTabId = $bindable(''),
    onSelect
  }: { tabs: Tab[]; activeTabId: string; onSelect?: (tab: Tab) => void } = $props()
</script>

<div class="tabs-container">
  {#each tabs as tab (tab.id)}
    <div
      class="tab"
      class:active={tab.id === activeTabId}
      class:disabled={tab.disabled}
      on:click={() => {
        if (!tab.disabled) {
          activeTabId = tab.id
          onSelect?.(tab)
        }
      }}
    >
      {#if tab.icon}
        <DynamicIcon name={tab.icon} size="1rem" />
      {/if}
      <span class="label">{tab.label}</span>
    </div>
  {/each}
</div>

<style lang="scss">
  .tabs-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: -0.25rem;
  }

  .tab {
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    user-select: none;
    border-radius: 10px;
    transition: all 69ms ease-out;
    opacity: 0.5;
    color: light-dark(rgba(0, 0, 0, 0.7), rgba(255, 255, 255, 0.7));

    &.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &:hover:not(.disabled):not(.active) {
      background: light-dark(rgba(0, 0, 0, 0.075), rgba(255, 255, 255, 0.1));
      cursor: pointer;
    }

    &.active {
      opacity: 1;
      color: light-dark(rgba(0, 0, 0, 0.9), rgba(255, 255, 255, 0.95));
    }

    .label {
      font-size: 1rem;
    }
  }
</style>
