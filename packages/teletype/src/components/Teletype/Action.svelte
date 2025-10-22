<script lang="ts">
  import { isModKeyPressed, useLogScope } from '@deta/utils/io'
  import { useTeletype } from './index'
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  import { slide, fade } from 'svelte/transition'

  import type { Action, ActionPanelOption } from '../Teletype'
  import Icon from './Icon.svelte'
  import { TagStatus } from './types'

  let {
    action,
    active = false,
    isOption = false,
    horizontalItems = action.horizontalItems || []
  }: {
    action: Action
    active?: boolean
    isOption?: boolean
    horizontalItems?: Action[]
  } = $props()
  let selectedItemIndex = 0
  let keydownHandler: ((e: KeyboardEvent) => void) | null = null

  const teletype = useTeletype()
  const log = useLogScope('Teletype → Action')
  const { inputValue, showActionPanel } = teletype

  const modKeyShortcut =
    navigator.platform && navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘' : 'Ctrl'

  let elem: HTMLElement
  let listElement: HTMLElement
  let hasLeftOverflow = false
  let hasRightOverflow = false

  const parentAction = $derived(action.parent ? teletype.getActionByID(action.parent) : null)
  const breadcrumb = $derived(
    action.searchBreadcrumb ||
      action.breadcrumb ||
      (parentAction && parentAction.breadcrumb) ||
      (parentAction && parentAction.name)
  )

  const selectedHorizontalItem = $derived(
    horizontalItems.length > 0 ? (horizontalItems[selectedItemIndex] ?? null) : null
  )

  $effect(() => {
    if (active && selectedHorizontalItem) {
      teletype.selectedAction.set(selectedHorizontalItem)
    }
  })

  const tagColors = {
    [TagStatus.DEFAULT]: {
      color: 'var(--text-light)',
      background: 'var(--background-accent)'
    },
    [TagStatus.SUCCESS]: {
      color: '#107c43',
      background: '#a3e5c2'
    },
    [TagStatus.WARNING]: {
      color: '#87580c',
      background: '#fddeab'
    },
    [TagStatus.ACTIVE]: { color: '#730b3c', background: '#e18cb2' },
    [TagStatus.FAILED]: { color: '#850f0f', background: '#f8adad' }
  }

  const tagStyle = $derived(tagColors[action.tagStatus || TagStatus.DEFAULT])

  export const click = () => {
    elem.click()
  }

  function checkOverflow() {
    if (!listElement) return

    hasLeftOverflow = listElement.scrollLeft > 0
    hasRightOverflow = listElement.scrollLeft < listElement.scrollWidth - listElement.clientWidth
  }

  let observer: ResizeObserver

  // PERF: This probably creates many "unnecessary" observers / at least create them many times?
  // Can we simplify this, by just .observer / .disconnect if the list item changed?
  $effect(() => {
    if (listElement) {
      observer = new ResizeObserver(() => {
        checkOverflow()
      })
      observer.observe(listElement)
      return () => observer?.disconnect()
    }
  })

  type Events = {
    execute: Action
    selected: Action
  }

  const dispatch = createEventDispatcher<Events>()

  const executeAction = async (action: Action, e: MouseEvent | KeyboardEvent) => {
    let options: ActionPanelOption[] = []

    if (action.actionPanel) {
      if (typeof action.actionPanel === 'function') {
        options = await action.actionPanel()
      } else {
        options = action.actionPanel
      }
    }

    const secondaryAction = options.find((a) => a.shortcutType === 'secondary')
    if (e.shiftKey && secondaryAction) {
      dispatch('execute', secondaryAction as Action)
      return
    }

    const tertiaryAction = options.find((a) => a.shortcutType === 'tertiary')
    if ((e.ctrlKey || e.metaKey) && tertiaryAction) {
      dispatch('execute', tertiaryAction as Action)
      return
    }

    dispatch('execute', action)
  }

  function handleKeydown(e: KeyboardEvent) {
    // Only handle if we have horizontal items and we're active
    if (!active || !horizontalItems.length || $showActionPanel) {
      return
    }

    if (e.shiftKey || isModKeyPressed(e)) {
      // Don't interfere with shift key combos
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
          executeAction(selectedItem, e)
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

  const handleClick = async (e: MouseEvent, item?: Action) => {
    e.preventDefault()
    e.stopPropagation()

    if (item && horizontalItems.includes(item)) {
      executeAction(item, e)
    } else if (!item) {
      executeAction(action, e)
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
  role="none"
  in:slide={{ duration: 200 }}
  class="action"
  class:active
  class:option={isOption}
  class:horizontal={horizontalItems.length > 0}
  on:click|stopPropagation={handleClick}
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
              role="none"
              class="horizontal-item component permanent"
              class:selected={active && index === selectedItemIndex}
              on:mouseenter={() => handleHover(index)}
              on:click|stopPropagation={(e) => {
                e.preventDefault()
                handleClick(e, item)
              }}
              in:slide={{
                duration: 200
              }}
            >
              <svelte:component
                this={item.component}
                action={item}
                {...item.componentProps || {}}
              />
            </div>
          {:else if isItemInlineReplace(item) && active && index === selectedItemIndex}
            <div
              role="none"
              class="horizontal-item component replace"
              on:mouseenter={() => handleHover(index)}
              on:click|stopPropagation={(e) => {
                e.preventDefault()
                handleClick(e, item)
              }}
              in:slide={{
                duration: 200
              }}
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
              role="none"
            >
              {#if item.icon}
                <div class="item-icon">
                  <Icon icon={item.icon} />
                </div>
              {/if}
              <div class="item-name">
                {item.name}
              </div>
              {#if item.description}
                <div class="item-description">
                  {item.description}
                </div>
              {/if}
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {:else}
    <div class="panel-action">
      <div class="leading">
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
      </div>
      <div class="trailing">
        {#if action?.shortcut}
          <div
            class="shortcut"
            style="--tag-color: var(--background-accent)"
            title="Press {modKeyShortcut} + {action.shortcut.toUpperCase()}"
            in:fade={{ duration: 200 }}
          >
            {modKeyShortcut}
            {action.shortcut.toUpperCase()}
          </div>
        {:else if action.shortcutType === 'primary'}
          <div
            class="shortcut"
            style="--tag-color: var(--background-accent)"
            title="Press Enter"
            in:fade={{ duration: 200 }}
          >
            ⏎
          </div>
        {:else if action.shortcutType === 'secondary'}
          <div
            class="shortcut"
            style="--tag-color: var(--background-accent)"
            title="Press Shift + Enter"
            in:fade={{ duration: 200 }}
          >
            Shift + ⏎
          </div>
        {:else if action.shortcutType === 'tertiary'}
          <div
            class="shortcut"
            style="--tag-color: var(--background-accent)"
            title="Press {modKeyShortcut} + Enter"
            in:fade={{ duration: 200 }}
          >
            {modKeyShortcut}
            + ⏎
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style lang="scss">
  .action {
    padding: 0.65rem 0.75rem;
    margin: 0.25rem 0.5rem;
    box-sizing: border-box;
    font-size: 0.9rem;
    letter-spacing: 0.02em;
    border-radius: 11px;
    display: flex;
    align-items: center;

    user-select: none;
    overflow: hidden;

    &.horizontal {
      padding: 0.25rem 0.25rem 0.5rem 0.25rem !important;
    }

    &:not(.horizontal) {
      &.active {
        border-left-color: var(--text);
        background: light-dark(var(--background-accent), var(--background-dark));
        background: light-dark(var(--background-accent-p3), var(--background-accent-p3-dark));
      }

      &.option.active {
        background: rgba(0, 0, 0, 0.06);
      }

      &:hover {
        background: light-dark(var(--background-accent), var(--background-dark));
        background: light-dark(var(--background-accent-p3), var(--background-accent-p3-dark));
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
      mask-image: linear-gradient(to right, transparent 0%, #000 2%, #000 98%, transparent 100%);
    }

    &.has-right-overflow:not(.has-left-overflow) .horizontal-list {
      mask-image: linear-gradient(to right, #000 95%, transparent 100%);
    }

    &.has-left-overflow:not(.has-right-overflow) .horizontal-list {
      mask-image: linear-gradient(to right, transparent 0%, #000 5%);
    }
  }

  .horizontal-list {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
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

  .panel-action {
    width: 100%;
    display: flex;
    justify-content: space-between;
  }

  .leading {
    display: flex;
    align-items: center;
    gap: 0;
    flex: 1;
  }

  .trailing {
    display: flex;
    align-items: center;
    gap: 0;
  }

  .icon {
    margin-right: 0.75rem;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .shortcut {
    font-family: 'Inter';
    font-weight: 500;
    -webkit-font-smoothing: antialiased;
    font-smoothing: antialiased;
    font-size: 0.95rem;
    line-height: 0.925rem;
    height: 24px;
    margin-left: 4px;
    width: auto;
    text-align: center;
    padding: 6px 6px 7px 6px;
    border-radius: 5px;
    color: rgba(88, 104, 132, 1);
    background: rgba(88, 104, 132, 0.2);
    align-items: center;
    justify-content: center;
  }
</style>
