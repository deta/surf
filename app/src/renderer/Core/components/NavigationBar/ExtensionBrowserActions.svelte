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
    <Button
      size="md"
      square
      style="--bg: light-dark(rgba(0, 0, 0, 0.04), rgba(255, 255, 255, 0.08));"
    >
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
      var(--accent-background, #eef4ff) 0%,
      color-mix(in srgb, var(--accent-background, #ecf3ff) 85%, var(--accent, #6d82ff) 15%) 50%,
      color-mix(in srgb, var(--accent-background, #ecf3ff) 88%, var(--accent, #6d82ff) 12%) 100%
    );

    @media (prefers-color-scheme: dark) {
      background: radial-gradient(
        143.56% 143.56% at 50% -43.39%,
        var(--accent-background-dark, #182033) 0%,
        color-mix(
            in srgb,
            var(--accent-background-dark, #182033) 70%,
            var(--accent-dark, #8192ff) 30%
          )
          50%,
        color-mix(
            in srgb,
            var(--accent-background-dark, #182033) 85%,
            var(--accent-dark, #8192ff) 15%
          )
          100%
      );
    }
    color: light-dark(var(--on-surface, #586884), var(--on-surface-dark, #cbd5f5));
    width: 200px;
    overflow: hidden;
    border-radius: 12px;
    border: 1px solid light-dark(rgba(0, 0, 0, 0.1), rgba(255, 255, 255, 0.15));
    box-shadow: 0px 4px 16px light-dark(rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.5));
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
    background: light-dark(
      color-mix(in srgb, var(--surface-elevated, rgba(255, 255, 255, 1)) 70%, transparent),
      rgba(17, 24, 39, 0.6)
    );
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
    color: light-dark(var(--on-surface-muted, #586884), var(--on-surface-muted-dark, #cbd5f5));

    &:hover {
      background: light-dark(
        rgba(255, 255, 255, 0.9),
        color-mix(in srgb, rgba(17, 24, 39, 0.8) 70%, var(--accent-dark, #8192ff) 30%)
      );
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
    color: light-dark(var(--on-surface, #374151), var(--on-surface-dark, #cbd5f5));
  }
</style>
