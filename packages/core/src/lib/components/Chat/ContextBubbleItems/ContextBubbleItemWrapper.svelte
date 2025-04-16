<script lang="ts" context="module">
  export type PillProperties = {
    x: number
    y: number
    rotate: number
    borderRadius: number
    textOpacity: number
    textBlur: number
    textX: number
  }
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { writable, type Writable } from 'svelte/store'

  import { Icon } from '@horizon/icons'
  import CustomPopover from '../../Atoms/CustomPopover.svelte'
  import {
    CONTEXT_MENU_KEY,
    contextMenu,
    type CtxItem,
    type CtxMenuProps
  } from '../../Core/ContextMenu.svelte'
  import { conditionalArrayItem } from '@horizon/utils'
  import {
    ContextItemResource,
    type ContextItem
  } from '@horizon/core/src/lib/service/ai/contextManager'
  import { ResourceTypes } from '@horizon/types'

  export let item: ContextItem
  export let pillProperties: PillProperties
  export let loading: boolean = false
  export let failed: boolean = false
  export let opened: Writable<boolean> = writable(false)
  export let additionalLabel: string | undefined = undefined

  const dispatch = createEventDispatcher<{
    select: string
    retry: string
    'remove-item': string
  }>()

  const handleSelect = (id: string) => {
    dispatch('select', id)
  }

  const handleExcludeItem = (id: string) => {
    dispatch('remove-item', id)
  }

  const handleRety = (id: string) => {
    dispatch('retry', id)
  }

  $: label = item.label
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
      class="shine-border pill transform group/pill"
      on:click={() => handleSelect(item.id)}
      use:contextMenu={contextMenuData}
      style="transform: transform-origin: center center;"
    >
      <div
        role="none"
        class="pill flex items-center border-[0.5px] border-l border-t border-r border-gray-200 dark:border-gray-600 {failed
          ? 'bg-red-50 hover:bg-red-100 dark:bg-red-800 dark:hover:bg-red-700'
          : 'bg-white dark:bg-gray-800'} z-0 {item.type === 'screenshot'
          ? 'px-[5px]'
          : 'px-[11px]'} hover:bg-gray-50 dark:hover:bg-gray-700 transform"
        style="min-width: 40px; height: 36px; transition: transform 0.3s, background-color 0.3s;"
      >
        <button
          class="remove absolute top-0 left-0 shadow-sm transform"
          style="background: white; border: 1px solid rgb(220,220,220); transform: translate(-20%, -20%); z-index: 10; width: 16px; aspect-ratio: 1 / 1; border-radius: 100%;"
          on:click|stopPropagation={() => handleExcludeItem(item.id)}
        >
          <Icon name="close" size="11px" color="black" />
        </button>

        <div
          class="flex items-center justify-center flex-shrink-0 group-hover/pill:opacity-100 {item.type ===
          'screenshot'
            ? 'w-8 h-8'
            : 'w-5 h-5'}"
          class:loading
          class:failed
          class:opacity-100={!loading && !failed}
        >
          <slot></slot>
        </div>

        {#if additionalLabel}
          <div class="px-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            {additionalLabel}
          </div>
        {/if}

        <!-- <span
          class="ml-2 whitespace-nowrap overflow-hidden text-sm"
          style="opacity: {pillProperties.textOpacity}; filter: blur({pillProperties.textBlur}px); transform: translateX({pillProperties.textX}px); transition: opacity 0.3s, filter 0.3s;"
        >
          {$label}
        </span> -->
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
    cursor: default;
    transition: transform 0.3s ease;
    border-radius: 11px 11px 11px 11px;
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
