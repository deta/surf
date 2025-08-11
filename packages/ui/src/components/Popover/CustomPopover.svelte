<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte'
  import { writable } from 'svelte/store'
  import { Popover, type CustomEventHandler } from 'bits-ui'
  import { flyAndScale } from '@deta/utils'

  export let initialPopoverOpened = false
  export let position: 'top' | 'bottom' | 'left' | 'right' = 'bottom'
  export let popoverOpened = writable(initialPopoverOpened)
  export let openDelay = 400
  export let sideOffset = 20
  export let forceOpen = false
  export let disabled = false
  export let portal: string | HTMLElement | null | undefined = undefined
  export let disableHover = false
  export let triggerClassName = ''
  export let disableTransition = false
  export let toggleOnClick = false

  let timerBeforePopoverClose: NodeJS.Timeout
  let timerBeforePopoverOpen: NodeJS.Timeout
  let blockOpen = false
  let openedByHover = false
  let blockToggleTimer: NodeJS.Timeout

  const dispatch = createEventDispatcher<{
    click: MouseEvent
    show: void
    close: void
  }>()

  $: if ($popoverOpened) {
    dispatch('show')
  } else {
    dispatch('close')
  }

  const handleMouseEnter = () => {
    clearTimeout(timerBeforePopoverClose)
  }

  const handleClick = (e: CustomEventHandler<MouseEvent, HTMLButtonElement>) => {
    console.warn('handleClick')
    e.preventDefault()

    dispatch('click', e.detail.originalEvent)

    if (toggleOnClick) {
      // If opened by hover cancel closing
      if (openedByHover) {
        return
      }
      popoverOpened.update((value) => !value)
      return
    }

    if (disableHover) {
      clearTimeout(timerBeforePopoverClose)
      timerBeforePopoverOpen = setTimeout(() => {
        popoverOpened.set(true)
      }, 50)
      return
    }

    popoverOpened.set(false)
    clearTimeout(timerBeforePopoverOpen)

    blockOpen = true

    setTimeout(() => {
      blockOpen = false
    }, 500)
  }

  const handleMouseOver = () => {
    if (disableHover) {
      return
    }

    if (blockOpen) {
      return
    }

    clearTimeout(timerBeforePopoverClose)
    timerBeforePopoverOpen = setTimeout(() => {
      popoverOpened.set(true)
      openedByHover = true
      // Reset the hover flag after 800ms
      clearTimeout(blockToggleTimer)
      blockToggleTimer = setTimeout(() => {
        openedByHover = false
      }, 800)
    }, openDelay)
  }

  const handleMouseOut = () => {
    if (disableHover) {
      return
    }

    clearTimeout(timerBeforePopoverOpen)
    timerBeforePopoverClose = setTimeout(() => {
      if (!forceOpen) {
        popoverOpened.set(false)
      }
    }, openDelay)
  }

  const closePopover = () => {
    if (!forceOpen) {
      popoverOpened.set(false)
    }
  }

  onDestroy(() => {
    clearTimeout(timerBeforePopoverClose)
    clearTimeout(blockToggleTimer)
  })

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (!forceOpen) {
        popoverOpened.set(false)
      }
    }
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<!-- svelte-ignore a11y-click-events-have-key-events -->

{#if disabled}
  <slot name="trigger" />
{:else}
  <Popover.Root
    open={$popoverOpened}
    closeOnEscape
    closeOnOutsideClick
    {portal}
    onOpenChange={(isOpen) => {
      if (!isOpen) {
        popoverOpened.set(false)
      }
    }}
  >
    <Popover.Trigger on:click={handleClick} class={triggerClassName}>
      <div
        role="button"
        tabindex="0"
        on:mouseenter={handleMouseOver}
        on:mouseleave={handleMouseOut}
        on:dragenter={handleMouseOver}
      >
        <slot name="trigger" />
      </div>
    </Popover.Trigger>
    <Popover.Content
      class="z-[100] max-w-[400px] max-h-[500px] "
      transition={flyAndScale}
      side={position}
      {sideOffset}
      transitionConfig={disableTransition ? { duration: 0 } : undefined}
    >
      <div
        on:mouseenter={handleMouseEnter}
        on:mouseleave={handleMouseOut}
        class="w-full h-full rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 overflow-y-auto focus:outline-none"
        role="menu"
        tabindex="0"
      >
        <slot name="content" {closePopover} />
      </div>
    </Popover.Content>
  </Popover.Root>
{/if}
