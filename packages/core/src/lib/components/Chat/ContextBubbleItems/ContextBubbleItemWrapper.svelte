<script lang="ts" context="module">
  export type PillProperties = {
    x: number
    y: number
    rotate: number
    width: number
    height: number
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
  import type { Pill } from '../ContextBubbles.svelte'
  import CustomPopover from '../../Atoms/CustomPopover.svelte'
  import { CONTEXT_MENU_KEY, contextMenu, type CtxMenuProps } from '../../Core/ContextMenu.svelte'

  export let pill: Pill
  export let pillProperties: PillProperties
  export let loading: boolean = false
  export let opened: Writable<boolean> = writable(false)

  const dispatch = createEventDispatcher<{
    select: string
    'remove-item': string
  }>()

  const handleSelect = (id: string) => {
    dispatch('select', id)
  }

  const handleExcludeItem = (id: string) => {
    dispatch('remove-item', id)
  }

  $: contextMenuKey = `context-item-${pill.id}`

  $: contextMenuData = {
    key: `context-item-${pill.id}`,
    items: [
      {
        type: 'action',
        icon: 'arrow.up.right',
        text: 'Open as Tab',
        action: () => handleSelect(pill.contextItemId)
      },
      {
        type: 'action',
        icon: 'close',
        text: 'Remove from context',
        kind: 'danger',
        action: () => handleExcludeItem(pill.contextItemId)
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
      aria-hidden="true"
      class="shine-border pill transform hover:translate-y-[-6px]"
      on:click={() => handleSelect(pill.contextItemId)}
      use:contextMenu={contextMenuData}
      style="transform: rotate({pillProperties.rotate}deg); transform-origin: center center;"
    >
      <div
        aria-hidden="true"
        class="pill flex items-center bg-white border-[1px] border-slate-200 z-0 shadow-md {pill.type ===
        'image'
          ? 'pl-[5px]'
          : 'pl-[11px]'} hover:bg-red-100 transform hover:translate-y-[-6px]"
        style="width: {pillProperties.width}px; height: {pillProperties.height}px; border-radius: {pillProperties.borderRadius}px; transition: width 0.3s, height 0.3s, transform 0.3s, background-color 0.3s;"
      >
        <button
          class="remove absolute top-0 left-0 shadow-sm transform"
          style="background: white; border: 1px solid rgb(220,220,220); transform: translate(-20%, -20%); z-index: 10; width: 16px; aspect-ratio: 1 / 1; border-radius: 100%;"
          on:click|stopPropagation={() => handleExcludeItem(pill.contextItemId)}
        >
          <Icon name="close" size="11px" color="black" />
        </button>

        <div
          class="flex items-center justify-center flex-shrink-0 {loading
            ? 'opacity-75 hover:opacity-100'
            : 'opacity-100'} {pill.type === 'image' ? 'w-8 h-8' : 'w-5 h-5'}"
        >
          <slot></slot>
        </div>

        <span
          class="ml-2 whitespace-nowrap overflow-hidden text-sm"
          style="opacity: {pillProperties.textOpacity}; filter: blur({pillProperties.textBlur}px); transform: translateX({pillProperties.textX}px); transition: opacity 0.3s, filter 0.3s;"
        >
          {pill.title}
        </span>
      </div>
    </div>
  </div>

  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div
    slot="content"
    class="no-drag bg-white hover:bg-neutral-100 relative max-w-96 cursor-pointer"
    on:click={() => handleSelect(pill.contextItemId)}
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
</style>
