<script lang="ts">
  import { onMount } from 'svelte'
  import { writable, derived } from 'svelte/store'

  import { Icon } from '@deta/icons'
  import { Button } from '@deta/ui'
  import { useTabs } from '@deta/services/tabs'

  import OverlayPopover from '../Overlays/OverlayPopover.svelte'

  const tabs = useTabs()

  let isMenuOpen = $state(false)

  const extensions = writable<any[]>([])
  const hasNoExtensionsEnabled = derived(extensions, ($extensions) => $extensions.length === 0)

  async function updateExtensionState() {
    try {
      // @ts-ignore - window.api is injected
      const extensionList = await window.api.listExtensions()
      if (extensionList) {
        extensions.set(extensionList)
      }
    } catch (error) {
      extensions.set([])
    }
  }

  onMount(() => {
    // @ts-ignore - window.api is injected
    const cleanup = window.api.onExtensionChange?.(updateExtensionState)
    return () => cleanup?.()
  })

  const handleOpenExtenionStore = () => {
    const url = 'https://chromewebstore.google.com/category/extensions'
    tabs.openOrCreate(url, { active: true })
  }

  const handleOpenSettings = () => {
    // @ts-ignore - window.api is injected
    // NOTE: DO NOT PASS IN A tab ARGUMENT, IT DOES NOT WORK IN A BUILD AS OF YET
    window.api.openSettings()
  }

  const handleShowPopover = () => {
    updateExtensionState()
  }

  $effect(() => {
    if (isMenuOpen) {
      handleShowPopover()
    }
  })
</script>

<OverlayPopover bind:open={isMenuOpen} position="bottom" height={170}>
  {#snippet trigger()}
    <Button size="md" square>
      <Icon name="puzzle" size="1.085em" />
    </Button>
  {/snippet}

  <div class="popover-content">
    {#if $hasNoExtensionsEnabled}
      <div class="empty-state">
        <div class="description">
          <p class="info">Surf comes with experimental extension support.</p>
          <button class="action-button" onclick={handleOpenExtenionStore}> Open Web Store </button>
        </div>
      </div>
    {:else}
      <div class="installed-extensions">
        <div class="extensions-container">
          <browser-action-list partition="persist:horizon" alignment="bottom right"
          ></browser-action-list>
        </div>
        <div class="button-group">
          <button class="action-button" onclick={handleOpenExtenionStore}>
            <Icon name="add" size="17px" /> Install Extension
          </button>
          <button class="action-button" onclick={handleOpenSettings}>
            <Icon name="settings" size="17px" />
          </button>
        </div>
      </div>
    {/if}
  </div>
</OverlayPopover>

<style lang="scss">
  .popover-content {
    background: radial-gradient(
      143.56% 143.56% at 50% -43.39%,
      #eef4ff 0%,
      #ecf3ff 50%,
      #d2e2ff 100%
    );
    color: #586884;
    width: 200px;
    overflow: hidden;
    border-radius: 12px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: 0px 4px 16px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;

    &:has(.empty-state) {
      width: 280px;
    }
  }

  .installed-extensions {
    display: flex;
    flex-direction: column;
    padding: 0.75rem;
    gap: 0.5rem;
  }

  .extensions-container {
    min-height: 2rem;
    width: 100%;
    overflow: hidden;

    :global(browser-action-list) {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: flex-start;
      justify-content: center;
      overflow: hidden;
      max-height: none;
      width: 100%;

      scrollbar-width: none;
      -ms-overflow-style: none;

      &::-webkit-scrollbar {
        display: none;
      }
    }

    :global(browser-action-list > *) {
      flex-shrink: 0;
      margin: 0;
    }
  }

  .button-group {
    display: flex;
    gap: 0.25rem;
    align-items: center;
    justify-content: center;
    margin-top: 0.25rem;
    width: 100%;
  }

  .action-button {
    background: rgba(255, 255, 255, 0.4);
    border-radius: 0.5rem;
    padding: 0.4rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    cursor: pointer;
    transition: background-color 0.2s ease;
    gap: 0.25rem;
    flex: 0 0 auto;
    min-width: 40px;
    font-size: 0.8rem;

    &:hover {
      background: rgba(255, 255, 255, 0.8);
    }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem 1.5rem 1rem 1.5rem;

    .description {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 0.5rem;
    }
  }

  .info {
    font-size: 0.9rem;
  }
</style>
