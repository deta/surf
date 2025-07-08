<script lang="ts">
  import { onMount } from 'svelte'
  import { Icon } from '@horizon/icons'
  import { createEventDispatcher } from 'svelte'
  import CustomPopover from '../Atoms/CustomPopover.svelte'
  import { writable, derived } from 'svelte/store'
  import AppBarButton from './AppBarButton.svelte'
  import { useTabsViewManager } from '@horizon/core/src/lib/service/tabs'

  export let horizontalTabs: boolean = false

  const tabsViewManager = useTabsViewManager()

  const popoverOpened = writable(false)
  const extensions = writable<any[]>([])
  const hasNoExtensionsEnabled = derived(extensions, ($extensions) => $extensions.length === 0)

  let windowBlurred = false

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

  const dispatch = createEventDispatcher<{
    'open-extension-store': void
  }>()

  const handleOpenExtenionStore = () => {
    dispatch('open-extension-store')
  }

  const handleOpenSettings = () => {
    // @ts-ignore - window.api is injected
    // NOTE: DO NOT PASS IN A tab ARGUMENT, IT DOES NOT WORK IN A BUILD AS OF YET
    window.api.openSettings()
  }

  const handleBlur = () => {
    windowBlurred = true
  }

  const handleFocus = () => {
    windowBlurred = false

    // When the window is focused we know that the extension popover is closed and we can notify the view manager
    tabsViewManager.changeOverlayState({ extensionPopupOpen: false })

    window.removeEventListener('blur', handleBlur)
    window.removeEventListener('focus', handleFocus)
  }

  const handleShowPopover = () => {
    updateExtensionState()

    // Since the extension popover overlays the tabs in horizontal mode, we need to notify the view manager
    if (horizontalTabs) {
      tabsViewManager.changeOverlayState({ extensionPopupOpen: true })

      window.addEventListener('blur', handleBlur)
      window.addEventListener('focus', handleFocus)
    }
  }

  const handleClosePopover = () => {
    // If the window is blurred, we do not notify the view manager as that means an extension popup is open
    if (!windowBlurred) {
      tabsViewManager.changeOverlayState({ extensionPopupOpen: false })
    }
  }
</script>

<CustomPopover
  {popoverOpened}
  disableHover={false}
  toggleOnClick={true}
  position="bottom"
  sideOffset={3}
  on:show={handleShowPopover}
  on:close={handleClosePopover}
>
  <div slot="trigger">
    <AppBarButton class="group">
      <Icon name="puzzle" size="1.2rem" />
    </AppBarButton>
  </div>
  <div slot="content" class="popover-content">
    {#if $hasNoExtensionsEnabled}
      <div class="empty-state">
        <div class="description">
          <p>
            Surf comes with experimental extension support, currently limited to most popular <b
              >password managers</b
            >.
          </p>

          <p>
            Find your favorite password manager in the Chrome Web Store and install it to use it
            with Surf.
          </p>

          <button class="action-button" on:click={handleOpenExtenionStore}> Open Web Store </button>
        </div>
      </div>
    {:else}
      <div class="installed-extensions">
        <div class="extensions-container">
          <browser-action-list partition="persist:horizon" alignment="bottom right"
          ></browser-action-list>
        </div>
        <div class="button-group">
          <button class="action-button" on:click={handleOpenExtenionStore}>
            <Icon name="add" /> Add Extension
          </button>
          <button class="action-button" on:click={handleOpenSettings}>
            <Icon name="settings" />
          </button>
        </div>
      </div>
    {/if}
  </div>
</CustomPopover>

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

    &:has(.empty-state) {
      width: 280px;
    }
  }

  .installed-extensions {
    display: flex;
    flex-direction: column;
    padding: 0.75rem;
    gap: 0.75rem;
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
    padding: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    cursor: pointer;
    transition: background-color 0.2s ease;
    gap: 0.25rem;
    flex: 0 0 auto;
    min-width: 40px;

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
</style>
