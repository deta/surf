<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { writable, type Writable } from 'svelte/store'

  import { Icon } from '@deta/icons'
  import CustomPopover from '../../Atoms/CustomPopover.svelte'
  import {
    CONTEXT_MENU_KEY,
    contextMenu,
    type CtxItem,
    type CtxMenuProps
  } from '../../Core/ContextMenu.svelte'
  import { conditionalArrayItem } from '@deta/utils'
  import {
    ContextItemResource,
    type ContextItem
  } from '@horizon/core/src/lib/service/ai/contextManager'
  import { ResourceTypes } from '@deta/types'
  import { useConfig } from '@horizon/core/src/lib/service/config'

  export let item: ContextItem
  export let loading: boolean = false
  export let failed: boolean = false
  export let opened: Writable<boolean> = writable(false)
  export let additionalLabel: string | undefined = undefined

  const config = useConfig()
  const userConfigSettings = config.settings

  const dispatch = createEventDispatcher<{
    select: string
    retry: string
    'remove-item': string
  }>()

  $: contextMenuKey = `context-item-${item.id}`

  $: canRetry =
    item instanceof ContextItemResource &&
    ((Object.values(ResourceTypes) as string[]).includes(item.data.type) ||
      item.data.type === 'application/pdf')

  $: contextMenuData = {
    key: `context-item-${item.id}`,
    items: [
      {
        type: 'action',
        icon: 'arrow.up.right',
        text: 'Open as Tab',
        action: () => handleSelect(item.id)
      },
      ...conditionalArrayItem<CtxItem>(canRetry, {
        type: 'action',
        icon: 'reload',
        text: failed ? 'Retry Processing' : 'Rerun Processing',
        action: () => handleRety(item.id)
      }),
      {
        type: 'action',
        icon: 'close',
        text: 'Remove from context',
        kind: 'danger',
        action: () => handleExcludeItem(item.id)
      }
    ]
  } satisfies CtxMenuProps

  const handleSelect = (id: string) => {
    dispatch('select', id)
  }

  const handleExcludeItem = (id: string) => {
    dispatch('remove-item', id)
  }

  const handleRety = (id: string) => {
    dispatch('retry', id)
  }
</script>

<CustomPopover
  position="top"
  openDelay={350}
  sideOffset={10}
  popoverOpened={opened}
  forceOpen={$CONTEXT_MENU_KEY === contextMenuKey}
>
  <div slot="trigger" class="flex items-center gap-2">
    <div
      role="none"
      class="shine-border transform group/pill"
      class:experimental={$userConfigSettings.experimental_notes_chat_input &&
        $userConfigSettings.experimental_notes_chat_sidebar}
      on:click={() => handleSelect(item.id)}
      use:contextMenu={contextMenuData}
      style="transform: transform-origin: center center;"
    >
      <div
        role="none"
        class="pill flex items-center border-[0.5px] border-l border-t border-r border-gray-200 dark:border-gray-600 {failed
          ? 'bg-red-50 hover:bg-red-100 dark:bg-red-800 dark:hover:bg-red-700'
          : 'bg-white dark:bg-gray-800'} z-0 hover:bg-gray-50 dark:hover:bg-gray-700 transform"
        style="transition: transform 0.3s, background-color 0.3s;"
      >
        <button
          class="remove absolute top-0 left-0 shadow-sm transform"
          style="background: white; border: 1px solid rgb(220,220,220); transform: translate(-20%, -20%); z-index: 10; width: 16px; aspect-ratio: 1 / 1; border-radius: 100%;"
          on:click|stopPropagation={() => handleExcludeItem(item.id)}
        >
          <Icon name="close" size="11px" color="black" />
        </button>

        <div
          class="flex items-center justify-center flex-shrink-0 group-hover/pill:opacity-100 w-[1.25rem] h-[1.25rem]"
          class:loading
          class:failed
          class:opacity-100={!loading && !failed}
        >
          <slot></slot>
        </div>

        {#if additionalLabel}
          <div class="px-2 font-medium text-gray-700 dark:text-gray-200">
            {additionalLabel}
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div
    slot="content"
    class="no-drag bg-white dark:bg-gray-800 hover:bg-gray-100 w-fit relative max-w-96 max-h-[50ch]"
    on:click={() => handleSelect(item.id)}
    use:contextMenu={contextMenuData}
  >
    <slot name="popover"></slot>
  </div>
</CustomPopover>

<style lang="scss">
  .shine-border {
    transform-box: fill-box;
    transform-origin: center center;
  }

  .pill {
    transition: transform 0.3s ease;

    padding: 0.35rem 0.85rem;
    padding: 0.5rem;
    border-radius: 0.75rem;
    font-size: 0.85rem;
  }

  .pill {
    button.remove {
      display: none;
      justify-content: center;
      align-items: center;
      transition: all 0.3 ease;
    }
    &:hover button.remove {
      display: flex;
    }
  }
  .loading {
    opacity: 0.6;
  }

  .failed {
    opacity: 0.4;
  }
</style>
