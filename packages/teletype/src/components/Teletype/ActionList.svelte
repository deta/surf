<script lang="ts">
  import { slide } from 'svelte/transition'
  import type { Action } from './index'
  import ActionItem from './Action.svelte'
  import { createEventDispatcher, onMount } from 'svelte'

  export let actions: Action[]
  export let freeze = false
  export let isOption = false
  export let animations = true

  const dispatch = createEventDispatcher<{
    execute: Action
    selected: Action
  }>()

  // Group actions by section
  $: sectionedActions = actions.reduce((pre, cur) => {
    if (!cur.section) cur.section = '_all'
    if (!(cur.section in pre)) pre[cur.section] = []

    pre[cur.section].push(cur)

    return pre
  }, {} as { [key: string]: Action[] })

  // Flatten actions and add index
  $: parsedActions = Object.values(sectionedActions)
    .reduce((a, b) => a.concat(b), [])
    .map((item, _index) => ({ _index, ...item }))

  let activeActionIndex = 0
  $: activeAction = parsedActions[activeActionIndex]

  onMount(() => dispatch('selected', activeAction))

  $: if (activeAction) {
    dispatch('selected', activeAction)
  }

  export const resetActiveIndex = () => (activeActionIndex = 0)

  const onKeyDown = e => {
    if (freeze) return

    if (e.key === 'ArrowUp' || (e.shiftKey && e.key === 'Tab')) {
      e.preventDefault()
      if (activeActionIndex === 0) {
        activeActionIndex = parsedActions.length - 1
        keepActiveActionVisible()
        return
      }

      activeActionIndex--
      keepActiveActionVisible()
    } else if (e.key === 'ArrowDown' || e.key === 'Tab') {
      e.preventDefault()
      if (activeActionIndex >= parsedActions.length - 1) {
        activeActionIndex = 0
        keepActiveActionVisible()
        return
      }

      activeActionIndex++
      keepActiveActionVisible()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeActionIndex === undefined && parsedActions.length > 1) return

      const action = parsedActions.find(
        action => action._index === activeActionIndex
      )
      dispatch('execute', action)
    }
  }

  let listboxNode: HTMLElement

  /**
   * Keeps the active action visible by changing the scroll position if it is outside
   *
   * Reference: https://www.w3.org/TR/2018/WD-wai-aria-practices-1.2-20180719/examples/listbox/listbox-scrollable.html
   */
  const keepActiveActionVisible = () => {
    const element = document.getElementById(
      parsedActions[activeActionIndex]?.id
    )
    if (!element) return

    const listboxScrollHeight = listboxNode.clientHeight + listboxNode.scrollTop
    const elemScrollBottom = element.offsetTop + element.clientHeight

    // Focus moving down
    if (listboxScrollHeight < elemScrollBottom) {
      listboxNode.scrollTop =
        listboxNode.scrollTop + (elemScrollBottom - listboxScrollHeight)

      // Focus moving up
    } else if (elemScrollBottom <= listboxNode.scrollTop) {
      listboxNode.scrollTop =
        listboxNode.scrollTop - (listboxNode.scrollTop - element.offsetTop)
    }
  }

  const handleActionClick = e => {
    const action = e.detail as Action

    dispatch('execute', action)
  }

  const getActionIndex = (id: string) => {
    const found = parsedActions.find(action => action.id === id)
    if (!found) return undefined

    return found._index
  }

  const conditionalTransition = (node, options) => {
    if (animations) {
      return options.fn(node, options)
    }
  }
</script>

<svelte:window on:keydown={onKeyDown} />
<div
  bind:this={listboxNode}
  class="menu"
  class:hide-border={parsedActions.length < 1}
  class:option={isOption}
  role="listbox"
  tabindex="0"
  aria-activedescendant={activeAction?.id}
>
  {#each Object.entries(sectionedActions) as [section, actions] (section)}
    {#if section !== '_all'}
      <div
        in:slide={{ duration: 200 }}
        out:conditionalTransition={{ fn: slide, duration: 200 }}
        class="section"
      >
        {section}
      </div>
    {/if}
    {#each actions as action (action.id)}
      <ActionItem
        {action}
        {isOption}
        on:execute={handleActionClick}
        on:selected={() => (activeActionIndex = getActionIndex(action.id))}
        active={getActionIndex(action.id) === activeActionIndex}
        {animations}
      />
    {/each}
  {/each}
</div>

<style lang="scss">
  .menu {
    overflow-y: auto;
    outline: none;

    &:not(.modal) {
      border-bottom: var(--border-width) solid var(--border-color);
    }

    &.hide-border {
      border-bottom: 0;
    }
  }

  .option {
    border-bottom: 0 !important;
  }

  :global(.modal) .menu {
    border-bottom: 0;
  }

  .section {
    font-size: 0.85rem;
    padding: 0.4rem 0.8rem;
    box-sizing: border-box;
    color: var(--text);
    margin-top: 0.25rem;
  }
</style>
