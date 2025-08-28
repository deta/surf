<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import type { Action, ActionPanelOption } from './types'

  let {
    items,
    active = false,
    selectedIndex = $bindable(0)
  }: {
    items: Action[]
    active?: boolean
    selectedIndex?: number
  } = $props()

  let listElement: HTMLElement
  let hasLeftOverflow = false
  let hasRightOverflow = false

  const dispatch = createEventDispatcher<{
    select: { item: Action; index: number }
    execute: Action
  }>()

  function checkOverflow() {
    if (!listElement) return

    hasLeftOverflow = listElement.scrollLeft > 0
    hasRightOverflow = listElement.scrollLeft < listElement.scrollWidth - listElement.clientWidth
  }

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

  onMount(() => {
    checkOverflow()
    listElement?.addEventListener('scroll', checkOverflow)
    window.addEventListener('resize', checkOverflow)

    return () => {
      listElement?.removeEventListener('scroll', checkOverflow)
      window.removeEventListener('resize', checkOverflow)
    }
  })

  $effect(() => {
    if (listElement) {
      const observer = new ResizeObserver(() => {
        checkOverflow()
      })
      observer.observe(listElement)
      return () => observer.disconnect()
    }
  })

  function handleKeydown(e: KeyboardEvent) {
    if (!active) return

    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (selectedIndex > 0) {
        selectedIndex--
        dispatch('select', { item: items[selectedIndex], index: selectedIndex })
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      if (selectedIndex < items.length - 1) {
        selectedIndex++
        dispatch('select', { item: items[selectedIndex], index: selectedIndex })
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      executeAction(items[selectedIndex], e)
    }
  }

  $effect(() => {
    if (active) {
      window.addEventListener('keydown', handleKeydown)
      return () => window.removeEventListener('keydown', handleKeydown)
    }
  })
</script>

<div
  class="container"
  class:has-left-overflow={hasLeftOverflow}
  class:has-right-overflow={hasRightOverflow}
>
  <div bind:this={listElement} class="horizontal-list" class:active>
    {#each items as item, index}
      <div
        class="item"
        class:selected={index === selectedIndex}
        in:fade={{ duration: 200 }}
        on:click={(e) => executeAction(item, e)}
        role="none"
      >
        {#if item.icon}
          <div class="icon">
            <svelte:component this={item.icon} />
          </div>
        {/if}
        <div class="name">{item.name}</div>
        {#if item.description}
          <div class="description">{item.description}</div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style lang="scss">
  .container {
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
      -webkit-mask-image: linear-gradient(to right, #000 98%, transparent 100%);
    }

    &.has-left-overflow:not(.has-right-overflow) .horizontal-list {
      -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 2%);
    }
  }

  .horizontal-list {
    display: flex;
    gap: 0.5rem;
    padding: 0;
    overflow-x: auto;
    -ms-overflow-style: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .item {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem;
    border-radius: var(--border-radius-xs);
    background: var(--background-light);
    border: 2px solid var(--border);

    min-width: 80px;
    transition: all 0.2s ease;

    &:hover {
      background: var(--background-accent);
    }

    &.selected {
      background: var(--background-accent);
    }
  }

  .icon {
    width: 24px;
    height: 24px;
  }

  .name {
    font-size: 0.8rem;
    text-align: center;
    white-space: nowrap;
  }

  .description {
    font-size: 0.7rem;
    color: var(--text-light);
    text-align: center;
  }
</style>
