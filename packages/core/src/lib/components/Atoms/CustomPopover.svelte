<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount, tick } from 'svelte'
  import { writable, derived } from 'svelte/store'
  import { Popover } from 'bits-ui'
  import { flyAndScale } from '@horizon/utils'

  export let initialPopoverOpened = false
  export let position: 'top' | 'bottom' | 'left' | 'right' = 'bottom'

  const popoverOpened = writable(initialPopoverOpened)
  let timerBeforePopoverClose: NodeJS.Timeout
  let timerBeforePopoverOpen: NodeJS.Timeout
  const CLOSE_DELAY = 200
  const OPEN_DELAY = 400

  const handleMouseEnter = () => {
    clearTimeout(timerBeforePopoverClose)
  }

  const handleClick = () => {
    popoverOpened.set(false)
    clearTimeout(timerBeforePopoverOpen)
  }

  const handleMouseOver = () => {
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
<div
  role="button"
  tabindex="0"
  on:mouseenter={handleMouseOver}
  on:mouseleave={handleMouseOut}
  on:focus={handleMouseOver}
  on:dragenter={handleMouseOver}
  on:click={handleClick}
>
  <slot name="trigger" />
</div>

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
  <Popover.Trigger
    style="position: absolute; opacity: 0; {!$popoverOpened ? 'display: none;' : ''}"
  />
  <Popover.Content
    class="z-30 max-w-[400px] max-h-[500px] "
    transition={flyAndScale}
    sideOffset={20}
    side={position}
  >
    <div
      on:mouseenter={handleMouseEnter}
      on:mouseleave={() => handleMouseOut()}
      class="w-full h-full rounded-xl shadow-xl border border-dark-10 bg-neutral-100 overflow-y-scroll focus:outline-none"
      role="menu"
      tabindex="0"
    >
      <Popover.Arrow size={4} />

      <slot name="content" />
    </div>
  </Popover.Content>
</Popover.Root>
