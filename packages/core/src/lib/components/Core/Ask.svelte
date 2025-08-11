<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { Icon } from '@horizon/icons'
  import { conditionalArrayItem, isMac, tooltip } from '@deta/utils'
  import { floatyButtons } from '../../components/Atoms/floatyButtons'
  import FloatyButton from '../Atoms/FloatyButton.svelte'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import type { Readable } from 'svelte/store'

  const tabsManager = useTabsManager()

  const dispatch = createEventDispatcher<{
    click: void
    actionClick: { action: string }
    'open-space-and-chat': { spaceId: string }
    'open-chat-with-tab': string
    openScreenshot: void
  }>()

  // Props
  export let horizontalTabs: boolean = false
  export let showRightSidebar: boolean = false
  export let rightSidebarTab: string = ''
  export let customClasses: string = ''
  export let scope: Readable<string | null>

  // Floaty button configurations
  $: buttonConfigs = {
    buttons: [
      ...conditionalArrayItem($scope !== null, {
        component: FloatyButton,
        offsetX: -150,
        offsetY: -100,
        props: {
          text: 'Ask this Context',
          onClick: async () => {
            await new Promise((resolve) => setTimeout(resolve, 400))
            dispatch('open-space-and-chat', { spaceId: $scope as string })
          }
        }
      }),
      {
        component: FloatyButton,
        offsetX: 120,
        offsetY: -40,
        props: {
          text: 'Ask this Tab',
          onClick: async () => {
            await new Promise((resolve) => setTimeout(resolve, 400))
            const activeTabId = tabsManager.activeTabIdValue
            dispatch('open-chat-with-tab', activeTabId)
          }
        }
      },
      {
        component: FloatyButton,
        offsetX: 35,
        offsetY: -95,
        props: {
          text: 'Use Vision',
          icon: document.body.classList.contains('dark') ? 'vision.light' : 'vision',
          onClick: (e) => {
            dispatch('openScreenshot')
            return false
          }
        }
      }
    ],
    springConfig: {
      stiffness: 0.15,
      damping: 0.6
    }
  }
</script>

{#key $scope}
  <div use:floatyButtons={buttonConfigs} class="relative">
    <button
      use:tooltip={{
        text: `Chat (${isMac() ? '⌘' : 'Ctrl'} + E)`,
        position: horizontalTabs ? 'left' : 'top'
      }}
      class="ask-button transform no-drag active:scale-95 appearance-none disabled:opacity-40 disabled:cursor-not-allowed border-0 margin-0 group flex items-center justify-center p-2 hover:bg-sky-200/40 dark:hover:bg-gray-800/40 dark:text-sky-100 transition-colors duration-200 rounded-xl text-sky-800 {customClasses}"
      class:scale-90={horizontalTabs}
      on:click={() => dispatch('click')}
      style="gap: .25rem;"
      class:hovered={showRightSidebar && rightSidebarTab === 'chat'}
      class:dark:bg-gray-800={showRightSidebar && rightSidebarTab === 'chat'}
    >
      <Icon name="face.light" />
      {#if showRightSidebar && rightSidebarTab === 'chat'}
        <span class="text-lg font-medium text-white whitespace-nowrap">Close Chat</span>
      {:else}
        <span class="text-xl font-medium text-white whitespace-nowrap">Ask</span>
      {/if}
    </button>
  </div>
{/key}

<style lang="scss">
  .ask-button {
    z-index: 10000;
    &.hovered {
      @apply bg-sky-800/40 dark:bg-gray-700/50;
    }
  }

  :global(.floaty-chat-action) {
    @apply bg-white dark:bg-gray-800
           text-sky-800 dark:text-sky-100
           shadow-lg dark:shadow-gray-900/30
           border border-sky-200 dark:border-gray-700
           hover:bg-sky-50 dark:hover:bg-gray-700
           transition-colors duration-200;
  }

  :global(.new-chat-action) {
    @apply border-sky-300 dark:border-sky-800;
  }

  :global(.continue-chat-action) {
    @apply border-emerald-300 dark:border-emerald-800;
  }

  :global(.search-chat-action) {
    @apply border-violet-300 dark:border-violet-800;
  }
</style>
