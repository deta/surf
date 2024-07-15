<script>
  import { createEventDispatcher, onMount, afterUpdate } from 'svelte'
  import { fade, fly } from 'svelte/transition'

  let popoverEl
  let backdropEl

  export let opened = false
  export let arrow = true
  export let targetEl
  export let position = 'bottom-center' // Default position
  export let backdrop = true
  export let backdropUnique = false
  export let closeByBackdropClick = true
  export let closeByOutsideClick = true
  export let closeOnEscape = false
  export let animate = 'fade'
  export let content
  export let contentProps = {}
  export let style = {} // New style prop

  const dispatch = createEventDispatcher()

  const openPopover = () => {
    dispatch('popoverOpen')
    opened = true
  }

  const closePopover = () => {
    dispatch('popoverClose')
    opened = false
  }

  const handleBackdropClick = () => {
    if (closeByBackdropClick) closePopover()
  }

  const handleOutsideClick = (event) => {
    if (
      closeByOutsideClick &&
      !popoverEl.contains(event.target) &&
      !targetEl.contains(event.target) &&
      !event.target.closest('[data-keep-open]')
    ) {
      closePopover()
    }
  }

  const handleEscapeKey = (event) => {
    if (closeOnEscape && event.key === 'Escape') closePopover()
  }

  const handleForwardCreateTabFromSpace = (event) => {
    console.log('iamhere', event.detail)
    dispatch('create-tab-from-space', event.detail)
  }

  const handleForwardSaveResourceInSpace = async (event) => {
    dispatch('save-resource-in-space', event.detail)
  }

  const handleForwardCreateNewSpace = async (event) => {
    dispatch('create-new-space', event.detail)
  }

  const setPosition = () => {
    if (!popoverEl || !targetEl) return

    const targetRect = targetEl.getBoundingClientRect()
    const popoverRect = popoverEl.getBoundingClientRect()

    let top, left

    const [mainPosition, subPosition] = position.split('-')

    switch (mainPosition) {
      case 'top':
        top = targetRect.top - popoverRect.height
        if (subPosition === 'center') {
          left = targetRect.left + targetRect.width / 2 - popoverRect.width / 2
        } else if (subPosition === 'left') {
          left = targetRect.left
        } else if (subPosition === 'right') {
          left = targetRect.right - popoverRect.width
        }
        break
      case 'bottom':
        top = targetRect.bottom
        if (subPosition === 'center') {
          left = targetRect.left + targetRect.width / 2 - popoverRect.width / 2
        } else if (subPosition === 'left') {
          left = targetRect.left
        } else if (subPosition === 'right') {
          left = targetRect.right - popoverRect.width
        }
        break
      case 'left':
        left = targetRect.left - popoverRect.width
        if (subPosition === 'center') {
          top = targetRect.top + targetRect.height / 2 - popoverRect.height / 2
        } else if (subPosition === 'top') {
          top = targetRect.top
        } else if (subPosition === 'bottom') {
          top = targetRect.bottom - popoverRect.height
        }
        break
      case 'right':
        left = targetRect.right
        if (subPosition === 'center') {
          top = targetRect.top + targetRect.height / 2 - popoverRect.height / 2
        } else if (subPosition === 'top') {
          top = targetRect.top
        } else if (subPosition === 'bottom') {
          top = targetRect.bottom - popoverRect.height
        }
        break
      default:
        top = targetRect.bottom
        left = targetRect.left + targetRect.width / 2 - popoverRect.width / 2
    }

    popoverEl.style.top = `${top}px`
    popoverEl.style.left = `${left}px`

    // Set the arrow position
    setArrowPosition(mainPosition, subPosition)
  }

  const setArrowPosition = (mainPosition, subPosition) => {
    const arrowEl = popoverEl.querySelector('.popover-arrow')
    if (!arrowEl) return

    let arrowTop, arrowLeft

    switch (mainPosition) {
      case 'top':
        arrowTop = '100%'
        arrowLeft =
          subPosition === 'center' ? '50%' : subPosition === 'left' ? '2rem' : 'calc(100% - 2rem)'
        arrowEl.style.transform = 'translateX(-50%) translateY(-50%) rotate(45deg)'
        break
      case 'bottom':
        arrowTop = '-20px'
        arrowLeft =
          subPosition === 'center' ? '50%' : subPosition === 'left' ? '2rem' : 'calc(100% - 2rem)'
        arrowEl.style.transform = 'translateX(-50%) translateY(50%) rotate(45deg)'
        break
      case 'left':
        arrowLeft = '100%'
        arrowTop =
          subPosition === 'center' ? '50%' : subPosition === 'top' ? '2rem' : 'calc(100% - 2rem)'
        arrowEl.style.transform = 'translateX(-80%) translateY(-50%) rotate(45deg)'
        break
      case 'right':
        arrowLeft = '-20px'
        arrowTop =
          subPosition === 'center' ? '50%' : subPosition === 'top' ? '2rem' : 'calc(100% - 2rem)'
        arrowEl.style.transform = 'translateX(50%) translateY(-50%) rotate(45deg)'
        break
    }

    arrowEl.style.top = arrowTop
    arrowEl.style.left = arrowLeft
  }

  const applyStyles = () => {
    for (const [key, value] of Object.entries(style)) {
      popoverEl.style[key] = value
      // Apply the same style to the arrow for color-related properties
      if (key === 'backgroundColor' || key === 'borderColor') {
        popoverEl.querySelector('.popover-arrow').style[key] = value
      }
    }
  }

  onMount(() => {
    if (opened) {
      openPopover()
      setPosition()
      applyStyles()
    }

    document.addEventListener('click', handleOutsideClick)
    document.addEventListener('keydown', handleEscapeKey)

    return () => {
      document.removeEventListener('click', handleOutsideClick)
      document.removeEventListener('keydown', handleEscapeKey)
    }
  })

  afterUpdate(() => {
    if (opened) {
      setPosition()
      applyStyles()
    }
  })

  $: if (opened) {
    dispatch('popoverOpened')
  } else {
    dispatch('popoverClosed')
  }

  // Ensure methods are exposed
  export { openPopover, closePopover }
</script>

{#if backdrop}
  <div
    bind:this={backdropEl}
    class="backdrop"
    on:click={handleBackdropClick}
    in:fade={{ duration: 300 }}
    out:fade={{ duration: 300 }}
    aria-hidden="true"
  ></div>
{/if}

<div
  bind:this={popoverEl}
  class="popover {opened ? 'opened' : ''}"
  aria-hidden={!opened}
  transition={animate === 'fade' ? fade : fly}
>
  {#if arrow}
    <div class="popover-arrow"></div>
  {/if}
  {#if typeof content === 'string'}
    {@html content}
  {:else if opened && content}
    {#if opened && content}
      <svelte:component
        this={content}
        {...contentProps}
        {closePopover}
        on:create-tab-from-space={handleForwardCreateTabFromSpace}
        on:save-resource-in-space={handleForwardSaveResourceInSpace}
        on:create-new-space={handleForwardCreateNewSpace}
      />
    {/if}
  {/if}
  <slot></slot>
</div>

<style>
  .popover {
    position: absolute;
    background: white;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    border-radius: 12px;
    display: none;
    z-index: 1000;
    padding: 0.5rem;
  }

  .popover.opened {
    display: block;
  }

  .popover-arrow {
    position: absolute;
    width: 2rem;
    height: 2rem;
    background: white;
    transform: rotate(45deg);
    z-index: -1; /* Ensure it overlaps under the popover content */
  }

  .backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999;
    display: none;
  }

  .backdrop.opened {
    display: block;
  }
</style>
