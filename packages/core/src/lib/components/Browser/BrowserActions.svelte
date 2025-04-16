<script lang="ts">
  import { Icon } from '@horizon/icons'
  import { flyAndScale } from '@horizon/utils'
  import { Tooltip } from 'bits-ui'
  import { createEventDispatcher } from 'svelte'
  import { type Writable } from 'svelte/store'
  import ExtensionBrowserActions from './ExtensionBrowserActions.svelte'
  import AppBarButton from './AppBarButton.svelte'

  export let horizontalTabs: boolean
  export let showCustomWindowActions: boolean

  export let canGoBack: boolean
  export let canGoForward: boolean
  export let canReload: boolean
  export let showExtensionsBrowserActions: Writable<boolean>

  const dispatch = createEventDispatcher<{
    'go-back': void
    'go-forward': void
    reload: void
    'toggle-sidebar': void
    'show-menu-options': void
  }>()
</script>

<div
  class="flex flex-row items-center flex-shrink-0 {showCustomWindowActions
    ? ''
    : 'pl-[5rem]'} {horizontalTabs ? '' : 'w-full justify-between'} "
>
  <div>
    {#if showCustomWindowActions}
      <Tooltip.Root openDelay={400} closeDelay={10}>
        <Tooltip.Trigger>
          <AppBarButton class="group" on:click={window.api.showAppMenuPopup}>
            <span class="inline-block ease-in-out duration-200">
              <Icon name="menu" />
            </span>
          </AppBarButton>
        </Tooltip.Trigger>
        <Tooltip.Content
          transition={flyAndScale}
          transitionConfig={{ y: 8, duration: 150 }}
          sideOffset={8}
        >
          <div class="bg-gray-100 dark:bg-gray-800">
            <Tooltip.Arrow
              class="rounded-[2px] border-l border-t border-gray-200 dark:border-gray-700"
            />
          </div>
          <div
            class="flex items-center justify-center rounded-input border text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 rounded-xl p-3 text-sm font-medium shadow-md outline-none"
          >
            Show Menu Options
          </div>
        </Tooltip.Content>
      </Tooltip.Root>
    {/if}
    {#if horizontalTabs && $showExtensionsBrowserActions}
      <ExtensionBrowserActions on:open-extension-store />
    {/if}

    {#if !horizontalTabs}
      <Tooltip.Root openDelay={400} closeDelay={10}>
        <Tooltip.Trigger>
          <AppBarButton
            class="group {horizontalTabs ? 'rotate-90' : ''}"
            on:click={() => dispatch('toggle-sidebar')}
          >
            <span class="inline-block ease-in-out duration-200">
              <Icon name="sidebar.left" />
            </span>
          </AppBarButton>
        </Tooltip.Trigger>
        <Tooltip.Content
          transition={flyAndScale}
          transitionConfig={{ y: 8, duration: 150 }}
          sideOffset={8}
        >
          <div class="bg-gray-100 dark:bg-gray-800">
            <Tooltip.Arrow
              class="rounded-[2px] border-l border-t border-gray-200 dark:border-gray-700"
            />
          </div>
          <div
            class="custom-button-color flex items-center justify-center rounded-input border text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 rounded-xl p-3 text-sm font-medium shadow-md outline-none"
          >
            Toggle {horizontalTabs ? 'Topbar' : 'Sidebar'} (⌘ + Shift + B)
          </div>
        </Tooltip.Content>
      </Tooltip.Root>
    {/if}
    {#if !horizontalTabs && $showExtensionsBrowserActions}
      <ExtensionBrowserActions on:open-extension-store />
    {/if}
  </div>

  <div class="flex flex-row items-center">
    <Tooltip.Root openDelay={400} closeDelay={10}>
      <Tooltip.Trigger>
        <AppBarButton
          disabled={!canGoBack}
          class="group  {!canGoBack ? 'opacity-30 cursor-not-allowed' : ''}"
          on:click={() => dispatch('go-back')}
        >
          <span
            class="inline-block translate-x-0 {canGoBack &&
              'group-hover:!-translate-x-1'} transition-transform ease-in-out duration-200"
          >
            <Icon name="arrow.left" />
          </span>
        </AppBarButton>
      </Tooltip.Trigger>
      <Tooltip.Content
        transition={flyAndScale}
        transitionConfig={{ y: 8, duration: 150 }}
        sideOffset={8}
      >
        <div class="bg-gray-100 dark:bg-gray-800">
          <Tooltip.Arrow
            class="rounded-[2px] border-l border-t border-gray-200 dark:border-gray-700"
          />
        </div>
        <div
          class="flex items-center justify-center rounded-input border text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 rounded-xl p-3 text-sm font-medium shadow-md outline-none"
        >
          Go back (⌘ + ←)
        </div>
      </Tooltip.Content>
    </Tooltip.Root>

    <Tooltip.Root openDelay={400} closeDelay={10}>
      <Tooltip.Trigger>
        <AppBarButton
          disabled={!canGoForward}
          class="group  {!canGoForward ? 'opacity-30 cursor-not-allowed' : ''}"
          on:click={() => dispatch('go-forward')}
        >
          <span
            class="inline-block translate-x-0 {canGoForward &&
              'group-hover:!translate-x-1'} transition-transform ease-in-out duration-200"
          >
            <Icon name="arrow.right" />
          </span>
        </AppBarButton>
      </Tooltip.Trigger>
      <Tooltip.Content
        transition={flyAndScale}
        transitionConfig={{ y: 8, duration: 150 }}
        sideOffset={8}
      >
        <div class="bg-gray-100 dark:bg-gray-800">
          <Tooltip.Arrow
            class="rounded-[2px] border-l border-t border-gray-200 dark:border-gray-700"
          />
        </div>
        <div
          class="flex items-center justify-center rounded-input border text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 rounded-xl p-3 text-sm font-medium shadow-md outline-none"
        >
          Go forward (⌘ + →)
        </div>
      </Tooltip.Content>
    </Tooltip.Root>

    <Tooltip.Root openDelay={400} closeDelay={10}>
      <Tooltip.Trigger>
        <AppBarButton
          class="group  {!canReload ? 'opacity-30 cursor-not-allowed' : ''}"
          disabled={!canReload}
          on:click={() => dispatch('reload')}
        >
          <span class="group-hover:!rotate-180 ease-in-out duration-200">
            <Icon name="reload" />
          </span>
        </AppBarButton>
      </Tooltip.Trigger>
      <Tooltip.Content
        transition={flyAndScale}
        transitionConfig={{ y: 8, duration: 150 }}
        sideOffset={8}
      >
        <div class="bg-gray-100 dark:bg-gray-800">
          <Tooltip.Arrow
            class="rounded-[2px] border-l border-t border-gray-200 dark:border-gray-700"
          />
        </div>
        <div
          class="custom-button-color flex items-center justify-center rounded-input border text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 rounded-xl p-3 text-sm font-medium shadow-md outline-none"
        >
          Reload Page (⌘ + R)
        </div>
      </Tooltip.Content>
    </Tooltip.Root>
  </div>
</div>

<style lang="scss">
  .custom-button-color {
    :global(.custom) & {
      color: var(--contrast-color) !important;
      // This is a hack since i have no idea where the active class is set.
      &.bg-sky-200 {
        background-color: var(--base-color) !important;
      }
      &:hover {
        background-color: var(--base-color) !important;
      }
    }
  }
</style>
