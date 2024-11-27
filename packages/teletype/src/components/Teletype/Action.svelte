<script lang="ts">
  import { useLogScope } from '@horizon/utils'
  import { useTeletype } from './index'
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  import { slide, fade } from 'svelte/transition'

  import type { Action } from '../Teletype'
  import Icon from './Icon.svelte'
  import { TagStatus } from './types'

  export let action: Action
  export let active = false
  export let isOption = false
  export let animations = true

  export let horizontalItems: Action[] = action.horizontalItems || []
  let selectedItemIndex = 0
  let keydownHandler: ((e: KeyboardEvent) => void) | null = null

  const teletype = useTeletype()
  const log = useLogScope('Teletype → Action')
  const { inputValue } = teletype

  let elem
  let listElement: HTMLElement
  let hasLeftOverflow = false
  let hasRightOverflow = false

  $: parentAction = action.parent ? teletype.getActionByID(action.parent) : null
  $: breadcrumb =
    action.searchBreadcrumb ||
    action.breadcrumb ||
    (parentAction && parentAction.breadcrumb) ||
    (parentAction && parentAction.name)

  const tagColors = {
    [TagStatus.DEFAULT]: {
      color: 'var(--text-light)',
      background: 'var(--background-accent)'
    },
    [TagStatus.SUCCESS]: { color: '#107c43', background: '#a3e5c2' },
    [TagStatus.WARNING]: { color: '#87580c', background: '#fddeab' },
    [TagStatus.ACTIVE]: { color: '#730b3c', background: '#e18cb2' },
    [TagStatus.FAILED]: { color: '#850f0f', background: '#f8adad' }
  }

  $: tagStyle = tagColors[action.tagStatus || TagStatus.DEFAULT]

  export const click = () => {
    elem.click()
  }

  function checkOverflow() {
    if (!listElement) return

    hasLeftOverflow = listElement.scrollLeft > 0
    hasRightOverflow = listElement.scrollLeft < listElement.scrollWidth - listElement.clientWidth
  }

  let observer: ResizeObserver
  $: if (listElement) {
    observer = new ResizeObserver(() => {
      checkOverflow()
    })
    observer.observe(listElement)
    observer?.disconnect()
  }

  type Events = {
    execute: Action
    selected: Action
  }

  const dispatch = createEventDispatcher<Events>()

  function handleKeydown(e: KeyboardEvent) {
    // Only handle if we have horizontal items and we're active
    if (!active || !horizontalItems.length) {
      return
    }

    switch (e.key) {
      case 'ArrowLeft': {
        e.preventDefault()
        e.stopPropagation()
        if (selectedItemIndex <= 0) {
          selectedItemIndex = horizontalItems.length - 1
        } else {
          selectedItemIndex--
        }
        const selectedItem = horizontalItems[selectedItemIndex]
        if (selectedItem) {
          dispatch('selected', selectedItem)
        }
        keepSelectedItemVisible()
        break
      }

      case 'ArrowRight': {
        e.preventDefault()
        e.stopPropagation()
        if (selectedItemIndex >= horizontalItems.length - 1) {
          selectedItemIndex = 0
        } else {
          selectedItemIndex++
        }
        const selectedItem = horizontalItems[selectedItemIndex]
        if (selectedItem) {
          dispatch('selected', selectedItem)
        }
        keepSelectedItemVisible()
        break
      }

      case 'Enter':
      case 'Return': {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()

        if (!active) {
          return
        }

        // Execute the currently selected item immediately
        const selectedItem = horizontalItems[selectedItemIndex]
        if (selectedItem) {
          dispatch('execute', selectedItem)
          return false
        } else {
          log.debug('No selected item to execute')
        }
        break
      }

      default: {
        log.debug('Unhandled key:', e.key)
      }
    }
  }

  function keepSelectedItemVisible() {
    const list = elem?.querySelector('.horizontal-list')
    const selectedItem = list?.children[selectedItemIndex] as HTMLElement

    if (!list || !selectedItem) return

    const listRect = list.getBoundingClientRect()
    const itemRect = selectedItem.getBoundingClientRect()

    if (itemRect.right > listRect.right) {
      list.scrollLeft += itemRect.right - listRect.right
    } else if (itemRect.left < listRect.left) {
      list.scrollLeft -= listRect.left - itemRect.left
    }
  }

  const handleHover = (index: number) => {
    if (index !== selectedItemIndex) {
      selectedItemIndex = index
      const hoveredItem = horizontalItems[index]
      if (hoveredItem) {
        dispatch('selected', hoveredItem)
      }
    }
  }

  const handleClick = (e: MouseEvent, item?: Action) => {
    e.preventDefault()
    e.stopPropagation()

    if (item && horizontalItems.includes(item)) {
      dispatch('execute', item)
    } else if (!item) {
      if (active || !e.shiftKey) {
        dispatch('execute', action)
      } else {
        dispatch('selected', action)
      }
    }
  }

  const isItemInlineReplace = (item: Action) => {
    return item.view === 'InlineReplace' && item.component
  }

  const isItemInline = (item: Action) => {
    return item.view === 'Inline' && item.component
  }

  onMount(() => {
    // Attach keyboard handler more aggressively
    if (horizontalItems.length) {
      keydownHandler = (e: KeyboardEvent) => {
        handleKeydown(e)
      }

      // Try capturing phase
      window.addEventListener('keydown', keydownHandler, true)

      // Also attach directly to the component
      elem?.addEventListener('keydown', keydownHandler, true)
    }

    checkOverflow()
    listElement?.addEventListener('scroll', checkOverflow)
    window.addEventListener('resize', checkOverflow)
  })

  onDestroy(() => {
    if (keydownHandler) {
      window.removeEventListener('keydown', keydownHandler, true)
      elem?.removeEventListener('keydown', keydownHandler, true)
    }
    listElement?.removeEventListener('scroll', checkOverflow)
    window.removeEventListener('resize', checkOverflow)

    if (observer) {
      observer.disconnect()
    }
  })
</script>

<!-- svelte-ignore a11y-mouse-events-have-key-events -->
<div
  bind:this={elem}
  id={action.id}
  role="option"
  aria-selected={active}
  in:slide={{ duration: 200 }}
  class="action"
  class:active
  class:option={isOption}
  class:horizontal={horizontalItems.length > 0}
  on:click|stopPropagation={(e) => {
    if (e.target === e.currentTarget) {
      handleClick(e)
    }
  }}
  aria-hidden="true"
>
  {#if horizontalItems.length > 0}
    <div
      class="list-container"
      class:has-left-overflow={hasLeftOverflow}
      class:has-right-overflow={hasRightOverflow}
    >
      <div bind:this={listElement} class="horizontal-list">
        {#each horizontalItems as item, index}
          {#if isItemInline(item)}
            <div
              aria-hidden="true"
              class="horizontal-item component permanent"
              class:selected={active && index === selectedItemIndex}
              on:mouseenter={() => handleHover(index)}
              on:click|stopPropagation={(e) => {
                e.preventDefault()
                handleClick(e, item)
              }}
              in:slide={{ duration: 200 }}
            >
              <svelte:component
                this={item.component}
                action={item}
                {...item.componentProps || {}}
              />
            </div>
          {:else if isItemInlineReplace(item) && active && index === selectedItemIndex}
            <div
              aria-hidden="true"
              class="horizontal-item component replace"
              on:mouseenter={() => handleHover(index)}
              on:click|stopPropagation={(e) => {
                e.preventDefault()
                handleClick(e, item)
              }}
              in:slide={{ duration: 200 }}
            >
              <svelte:component
                this={item.component}
                action={item}
                {...item.componentProps || {}}
              />
            </div>
          {:else}
            <div
              class="horizontal-item"
              class:selected={active && index === selectedItemIndex}
              on:mouseenter={() => handleHover(index)}
              on:click|stopPropagation={(e) => {
                e.preventDefault()
                handleClick(e, item)
              }}
              aria-hidden="true"
            >
              {#if item.icon}
                <div class="item-icon">
                  <Icon icon={item.icon} />
                </div>
              {/if}
              <div class="item-name">{item.name}</div>
              {#if item.description}
                <div class="item-description">{item.description}</div>
              {/if}
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {:else}
    {#if action.icon}
      <div class="icon" in:fade={{ duration: 200 }}>
        <Icon icon={action.icon} />
      </div>
    {/if}
    <div class="name" in:fade={{ duration: 200 }}>
      {action.name}
    </div>
    {#if action.description}
      <div class="parent" in:fade={{ duration: 200 }}>
        {action.description}
      </div>
    {/if}
    {#if action?.tag}
      <div
        class="shortcut"
        style="--tag-color: {tagStyle.color}; --tag-background: {tagStyle.background}"
        in:fade={{ duration: 200 }}
      >
        {action.tag}
      </div>
    {/if}
    {#if action?.shortcut}
      <div
        class="shortcut"
        style="--tag-color: var(--background-accent)"
        title="Press {navigator.platform && navigator.platform.toUpperCase().indexOf('MAC') >= 0
          ? '⌘'
          : 'Ctrl'} + key"
        in:fade={{ duration: 200 }}
      >
        {navigator.platform && navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘' : 'Ctrl'}
        {action.shortcut.toUpperCase()}
      </div>
    {/if}
  {/if}
</div>

<style lang="scss">
  .action {
    padding: 0.75rem 1.25rem;
    margin: 0.25rem 0.5rem;
    box-sizing: border-box;
    font-size: 1.125rem;
    letter-spacing: 0.001em;
    border-radius: 11px;
    display: flex;
    align-items: center;
    cursor: pointer;
    user-select: none;
    overflow: hidden;

    &.horizontal {
      padding: 0.25rem 0.25rem 0.5rem 0.25rem !important;
    }

    &:not(.horizontal) {
      &.active {
        border-left-color: var(--text);
        background: var(--background-accent);
        background: var(--background-accent-p3);
      }

      &:hover {
        background: var(--background-accent);
        background: var(--background-accent-p3);
        filter: brightness(0.99);
      }
    }
  }

  .option {
    padding: 0.5rem;
    border: 0;

    &.active {
      border: 0;
    }
  }

  .list-container {
    width: 100%;

    &.has-left-overflow .horizontal-list {
      -webkit-mask-image: linear-gradient(
        to right,
        transparent 0%,
        #000 2%,
        #000 98%,
        transparent 100%
      );
    }

    &.has-right-overflow:not(.has-left-overflow) .horizontal-list {
      -webkit-mask-image: linear-gradient(to right, #000 95%, transparent 100%);
    }

    &.has-left-overflow:not(.has-right-overflow) .horizontal-list {
      -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 5%);
    }
  }

  .horizontal-list {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    scrollbar-width: none;
    width: 100%;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .horizontal-item {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 1.5rem 0.75rem;
    border-radius: 12px;

    &.component {
      width: 16rem;
      height: 12rem;
      max-width: 16rem;
      max-height: 12rem;
      padding: 0;
      overflow: hidden;
      object-fit: contain;
      border: 3px solid transparent;
      background: rgba(255, 255, 255, 0.4);

      &.permanent {
        &.selected {
          border-color: var(--text);
          background: var(--background-accent-p3);
          border: 3px solid var(--text);
        }
      }

      &.replace {
        background: var(--background-accent-p3);
      }
    }

    :global(.action:not(.active)) & {
      &:hover {
        background: var(--background-accent);
        background: var(--background-accent-p3);
        filter: brightness(0.99);
      }
    }

    &.selected {
      background: var(--background-accent);
      background: var(--background-accent-p3);
    }
  }

  .item-icon {
    width: 24px;
    height: 24px;
  }

  .item-name {
    font-size: 0.9rem;
    text-align: center;
    white-space: nowrap;
  }

  .item-description {
    font-size: 0.8rem;
    color: var(--text-light);
    text-align: center;
  }

  .name {
    pointer-events: none;
    white-space: nowrap;
  }

  .parent {
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    margin-left: 0.75rem;
    opacity: 0.4;
    color: var(--text-light);
  }

  .icon {
    margin-right: 0.75rem;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .shortcut {
    margin-left: auto;
    padding: 2px 7px;
    border-radius: var(--border-radius);
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--tag);
    background: var(--tag-background);
    opacity: 0.8;
    flex-shrink: 0;
  }
</style>
