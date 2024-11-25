<script lang="ts">
  import { Icon } from '@horizon/icons'
  import { flyAndScale } from '@horizon/utils'
  import { Tooltip } from 'bits-ui'
  import { createEventDispatcher } from 'svelte'
  import { provideConfig } from '../../service/config'
  import { useHomescreen } from '../Oasis/homescreen/homescreen'

  export let horizontalTabs: boolean
  export let showCustomWindowActions: boolean
  export let canGoBack: boolean
  export let canGoForward: boolean
  export let canReload: boolean
  export let showHomescreenToggle = false

  const homescreen = useHomescreen()
  const homescreenVisible = homescreen.visible

  const dispatch = createEventDispatcher<{
    'go-back': void
    'go-forward': void
    reload: void
    'toggle-sidebar': void
    'show-menu-options': void
    'toggle-homescreen': void
  }>()

  const config = provideConfig()
</script>

<div
  class="flex flex-row items-center flex-shrink-0 {horizontalTabs
    ? 'pl-3'
    : showCustomWindowActions
      ? ''
      : 'w-full justify-between pl-[4.4rem]'}"
>
  {#if showCustomWindowActions}
    <Tooltip.Root openDelay={400} closeDelay={10}>
      <Tooltip.Trigger>
        <button
          class="no-drag transform active:scale-95 appearance-none border-0 group margin-0 flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 dark:hover:bg-sky-900/50 dark:text-sky-100 cursor-pointer"
          on:click={window.api.showAppMenuPopup}
        >
          <span class="inline-block translate-x-0 transition-transform ease-in-out duration-200">
            <Icon name="menu" />
          </span>
        </button>
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
  <div>
    <Tooltip.Root openDelay={400} closeDelay={10}>
      <Tooltip.Trigger>
        <button
          class="no-drag transform active:scale-95 appearance-none border-0 group margin-0 flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 dark:hover:bg-sky-900/50 dark:text-sky-100 cursor-pointer"
          class:rotate-90={horizontalTabs}
          on:click={() => dispatch('toggle-sidebar')}
        >
          <span class="inline-block translate-x-0 transition-transform ease-in-out duration-200">
            <Icon name="sidebar.left" />
          </span>
        </button>
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
          Toggle {horizontalTabs ? 'Topbar' : 'Sidebar'} (⌘ + Shift + B)
        </div>
      </Tooltip.Content>
    </Tooltip.Root>
    {#if showHomescreenToggle}
      <Tooltip.Root openDelay={400} closeDelay={10}>
        <Tooltip.Trigger>
          <button
            class="no-drag transform active:scale-95 appearance-none border-0 group margin-0 flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 dark:hover:bg-sky-900/50 dark:text-sky-100 cursor-pointer {$homescreenVisible
              ? 'bg-sky-200 dark:bg-sky-900/50'
              : ''}"
            on:click={() => dispatch('toggle-homescreen')}
          >
            <span class="inline-block translate-x-0 transition-transform ease-in-out duration-200">
              <Icon name="home" />
            </span>
          </button>
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
            Toggle Homescreen (⌘ + 1)
          </div>
        </Tooltip.Content>
      </Tooltip.Root>
    {/if}
  </div>

  <div class="flex flex-row items-center">
    <Tooltip.Root openDelay={400} closeDelay={10}>
      <Tooltip.Trigger>
        <button
          class="no-drag transform active:scale-95 appearance-none border-0 group margin-0 flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 dark:hover:bg-sky-900/50 dark:text-sky-100 {!canGoBack
            ? 'opacity-30 cursor-not-allowed'
            : 'cursor-pointer'}"
          disabled={!canGoBack}
          on:click={() => dispatch('go-back')}
        >
          <span
            class="inline-block translate-x-0 {canGoBack &&
              'group-hover:-translate-x-1'} transition-transform ease-in-out duration-200"
          >
            <Icon name="arrow.left" />
          </span>
        </button>
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
        <button
          class="no-drag transform active:scale-95 appearance-none border-0 group margin-0 flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 dark:hover:bg-sky-900/50 dark:text-sky-100 {!canGoForward
            ? 'opacity-30 cursor-not-allowed'
            : 'cursor-pointer'}"
          disabled={!canGoForward}
          on:click={() => dispatch('go-forward')}
        >
          <span
            class="inline-block translate-x-0 {canGoForward &&
              'group-hover:translate-x-1'} transition-transform ease-in-out duration-200"
          >
            <Icon name="arrow.right" />
          </span>
        </button>
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
        <button
          class="no-drag transform active:scale-95 appearance-none border-0 margin-0 group flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 dark:hover:bg-sky-900/50 dark:text-sky-100 {!canReload
            ? 'opacity-30 cursor-not-allowed'
            : 'cursor-pointer'}"
          on:click={() => dispatch('reload')}
          disabled={!canReload}
        >
          <span class="group-hover:rotate-180 transition-transform ease-in-out duration-200">
            <Icon name="reload" />
          </span>
        </button>
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
          Reload Page (⌘ + R)
        </div>
      </Tooltip.Content>
    </Tooltip.Root>
  </div>
</div>
