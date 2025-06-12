<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { type Writable } from 'svelte/store'
  import { Icon } from '@horizon/icons'

  import { useTabsManager } from '../../service/tabs'
  import { tooltip, isMac } from '@horizon/utils'

  export let showActionsPanel: Writable<boolean>

  const dispatch = createEventDispatcher<{
    'open-space-and-chat': { spaceId: string }
    'open-chat-with-tab': string
    openScreenshot: void
    'create-note': void
    create: void
    ask: void
  }>()
  const tabsManager = useTabsManager()

  const scope = tabsManager.activeScopeId
</script>

<div class="tty-header-wrapper">
  <div class="header-actions">
    <div class="leading">
      <button
        class="header-btn"
        on:click|stopPropagation={() => dispatch('create-note')}
        use:tooltip={{
          text: `${isMac() ? '⌘' : 'Ctrl'} + N`,
          position: 'top'
        }}
      >
        <div class="create-note">
          <span>Surf Note</span>
          <Icon name="plus.boxed" />
        </div>
      </button>
      {#if !$showActionsPanel}
        <button class="chevron-wrpper" on:click={() => dispatch('create')}>
          <Icon name="chevron.down" />
        </button>
      {/if}
    </div>
    {#key $scope}
      <button class="header-btn" on:click|stopPropagation={() => dispatch('ask')}>
        <Icon name="face" size="28px" />
        <span>Ask</span>
      </button>
    {/key}
  </div>
</div>

<style lang="scss">
  .leading {
    display: flex;
    align-items: center;

    .chevron-wrpper {
      border-radius: 4px;
      padding: 0.25rem;
      z-index: 20;
      margin-left: -6px;
      &:hover {
        color: var(--text-accent);
        filter: brightness(0.95);
        background: rgba(126, 168, 240, 0.15);
        background: color(display-p3 0.5294 0.6549 0.9176 / 0.15);
      }
    }
  }
  .header-actions {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0.5rem 0.25rem 0.5rem;
    position: relative;
    border-bottom: 0.5px solid var(--border-color);
    &:after {
      content: '';
      position: absolute;
      display: block;
      width: 100%;
      height: 1px;
      bottom: -1.5px;
      left: 0;
      border-bottom: 1px solid white;
    }

    .header-btn {
      display: flex;
      padding: 0.5rem 0.75rem;
      justify-content: space-between;
      align-items: center;
      font-size: 1.125rem;
      gap: 0.25rem;
      border-radius: 11px;
      line-height: 1;
      color: var(--text);

      .create-note {
        display: flex;
        gap: 4px;
        align-items: center;
      }

      &:hover {
        color: var(--text-accent);
        filter: brightness(0.95);
        background: rgba(126, 168, 240, 0.15);
        background: color(display-p3 0.5294 0.6549 0.9176 / 0.15);
      }
    }
  }
</style>
