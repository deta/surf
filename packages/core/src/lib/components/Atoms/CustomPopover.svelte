<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount, tick } from 'svelte'
  import { writable, derived } from 'svelte/store'
  import { Popover, type CustomEventHandler } from 'bits-ui'
  import { flyAndScale } from '@horizon/utils'

  export let initialPopoverOpened = false
  export let position: 'top' | 'bottom' | 'left' | 'right' = 'bottom'
  export let popoverOpened = writable(initialPopoverOpened)

  let timerBeforePopoverClose: NodeJS.Timeout
  let timerBeforePopoverOpen: NodeJS.Timeout
  let blockOpen = false

  const CLOSE_DELAY = 200
  const OPEN_DELAY = 400

  const handleMouseEnter = () => {
    clearTimeout(timerBeforePopoverClose)
  }

  const handleClick = (e: CustomEventHandler<MouseEvent, HTMLButtonElement>) => {
    e.preventDefault()

    popoverOpened.set(false)
    clearTimeout(timerBeforePopoverOpen)

    blockOpen = true

    setTimeout(() => {
      blockOpen = false
    }, 500)
  }

  const handleMouseOver = () => {

    if (blockOpen) {
      return
    }

    clearTimeout(timerBeforePopoverClose)
    timerBeforePopoverOpen = setTimeout(() => {
      popoverOpened.set(true)
    }, OPEN_DELAY)
  }

  const handleMouseOut = () => {
    clearTimeout(timerBeforePopoverOpen)
    timerBeforePopoverClose = setTimeout(() => {
      popoverOpened.set(false)
    }, CLOSE_DELAY)
  }

  const closePopover = () => {
    popoverOpened.set(false)
  }

  onDestroy(() => {
    clearTimeout(timerBeforePopoverClose)
  })

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      popoverOpened.set(false)
    }
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<!-- svelte-ignore a11y-click-events-have-key-events -->

<Popover.Root
  open={$popoverOpened}
  closeOnEscape
  closeOnOutsideClick
  onOpenChange={(isOpen) => {
    if (!isOpen) {
      popoverOpened.set(false)
    }
  }}
>
  <Popover.Trigger on:click={handleClick}>
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
    class="z-30 max-w-[400px] max-h-[500px] "
    transition={flyAndScale}
    side={position}
    sideOffset={20}
  >
    <div
      on:mouseenter={handleMouseEnter}
      on:mouseleave={() => handleMouseOut()}
      class="w-full h-full rounded-xl shadow-xl border border-dark-10 bg-neutral-100 overflow-y-scroll focus:outline-none"
      role="menu"
      tabindex="0"
    >
      <Popover.Arrow size={6} />

      <slot name="content" {closePopover} />
    </div>
  </Popover.Content>
</Popover.Root>
