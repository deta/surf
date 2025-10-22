<script lang="ts">
  import { slide } from 'svelte/transition'
  import {
    type Action,
    ActionSelectPriority,
    ActionDisplayPriority,
    type ActionPanelOption
  } from './types'
  import ActionItem from './Action.svelte'

  import { createEventDispatcher, onMount, tick, onDestroy } from 'svelte'
  import { isModKeyPressed, useLogScope } from '@deta/utils'

  let {
    actions,
    freeze = false,
    isOption = false,
    preferredActionIndex = null
  }: {
    actions: Action[]
    freeze?: boolean
    isOption?: boolean
    preferredActionIndex?: number | null
  } = $props()

  const log = useLogScope('ActionList')

  $effect(() => {
    log.debug('Received actions prop:', actions)
    log.debug('Actions length:', actions?.length || 0)
  })

  const dispatch = createEventDispatcher<{
    execute: Action
    selected: Action
  }>()

  // Group actions by section
  // Group and sort actions by section and display priority
  const sectionedActions = $derived(
    Object.entries(
      actions.reduce(
        (pre, cur) => {
          log.debug('Processing action:', cur)
          if (!cur.section) cur.section = '_all'
          if (!(cur.section in pre)) pre[cur.section] = []
          if (!cur.horizontalParentAction) cur.horizontalParentAction = undefined
          if (!cur.displayPriority) cur.displayPriority = ActionDisplayPriority.LOW

          pre[cur.section].push(cur)
          return pre
        },
        {} as { [key: string]: Action[] }
      )
    )
      .sort(([, actionsA], [, actionsB]) => {
        const priorityA = Math.max(
          ...actionsA.map((a) => a.displayPriority || ActionDisplayPriority.LOW)
        )
        const priorityB = Math.max(
          ...actionsB.map((a) => a.displayPriority || ActionDisplayPriority.LOW)
        )
        return priorityB - priorityA
      })
      .reduce(
        (acc, [section, actions]) => {
          acc[section] = actions
          return acc
        },
        {} as { [key: string]: Action[] }
      )
  )

  // Flatten actions and add index
  const parsedActions = $derived(
    Object.values(sectionedActions)
      .reduce((a, b) => a.concat(b), [])
      .filter((action) => !action.hiddenOnRoot)
      .map((item, _index) => ({ _index, ...item }) as Action)
  )

  $effect(() => {
    log.debug('sectionedActions:', sectionedActions)
    log.debug('parsedActions:', parsedActions)
    log.debug('parsedActions length:', parsedActions.length)
  })

  let activeActionIndex = $state(0)
  let userHasNavigated = $state(false)
  const activeAction = $derived(parsedActions[activeActionIndex])

  $effect(() => {
    actions
    userHasNavigated = false
    log.debug('Actions changed, resetting userHasNavigated flag')
  })

  $effect(() => {
    // Select preferred action index if available, otherwise select first item
    // Only apply preferred index if user hasn't manually navigated
    if (parsedActions.length > 0 && !userHasNavigated) {
      const preferredIndex = preferredActionIndex
      if (preferredIndex !== null && preferredIndex >= 0 && preferredIndex < parsedActions.length) {
        log.debug(`Using preferred action index: ${preferredIndex}`)
        activeActionIndex = preferredIndex
      } else {
        log.debug('Using default action index: 0')
        activeActionIndex = 0
      }
    }
  })

  let listboxNode: HTMLElement

  const handleScroll = (e: WheelEvent) => {
    // Find if the target is within a horizontal-list
    const horizontalList = (e.target as HTMLElement).closest('.horizontal-list')

    if (horizontalList) {
      // For horizontal scrolling (shift + scroll or trackpad horizontal gesture)
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        horizontalList.scrollLeft += e.deltaX
        e.preventDefault()
      } else {
        // For vertical scrolling, adjust the parent container
        listboxNode.scrollTop += e.deltaY
      }
    }
  }

  onMount(() => {
    dispatch('selected', activeAction)

    // Add scroll handler to the parent container
    window.addEventListener('wheel', handleScroll, {
      passive: false
    })
  })

  onDestroy(() => {
    window.removeEventListener('wheel', handleScroll)
  })

  $effect(() => {
    if (activeAction) {
      dispatch('selected', activeAction)
    }
  })

  export const resetActiveIndex = () => {
    activeActionIndex = 0
    userHasNavigated = false
    log.debug('Resetting active index and userHasNavigated flag')
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

  const onKeyDown = (e: KeyboardEvent) => {
    if (freeze) return

    if ((e.key === 'ArrowUp' && !e.shiftKey) || (e.shiftKey && e.key === 'Tab')) {
      e.preventDefault()
      userHasNavigated = true
      log.debug('User navigated up, setting userHasNavigated = true')

      if (activeActionIndex === 0) {
        activeActionIndex = parsedActions.length - 1
        keepActiveActionVisible()
        return
      }

      activeActionIndex--
      keepActiveActionVisible()
    } else if ((e.key === 'ArrowDown' && !e.shiftKey) || e.key === 'Tab') {
      e.preventDefault()
      userHasNavigated = true
      log.debug('User navigated down, setting userHasNavigated = true')

      if (activeActionIndex >= parsedActions.length - 1) {
        activeActionIndex = 0
        keepActiveActionVisible()
        return
      }

      activeActionIndex++
      keepActiveActionVisible()
    }
    // } else if (e.key === 'Enter' && !e.shiftKey && isModKeyPressed(e)) {
    //   e.preventDefault()
    //   if (activeActionIndex === undefined && parsedActions.length > 1) return

    //   const action = parsedActions.find((action) => action._index === activeActionIndex)
    //   if (!action) return
    //   executeAction(action, e)
    // }
  }

  const keepActiveActionVisible = async () => {
    await tick()

    const element = document.getElementById(parsedActions[activeActionIndex]?.id)
    if (!element || !listboxNode) return

    const containerRect = listboxNode.getBoundingClientRect()
    const elementRect = element.getBoundingClientRect()

    // Check if element is below the visible area
    if (elementRect.bottom > containerRect.bottom) {
      const scrollNeeded = elementRect.bottom - containerRect.bottom
      listboxNode.scrollTop += scrollNeeded + 8 // Add small padding
    }

    // Check if element is above the visible area
    if (elementRect.top < containerRect.top) {
      const scrollNeeded = containerRect.top - elementRect.top
      listboxNode.scrollTop -= scrollNeeded + 8 // Add small padding
    }
  }

  const getActionIndex = (id: string) => {
    const found = parsedActions.find((action) => action.id === id)
    if (!found) return undefined
    return found._index
  }

  const isActionInlineReplace = (action: Action) => {
    return action.view === 'InlineReplace' && action.component
  }

  const isActionInline = (action: Action) => {
    return action.view === 'Inline' && action.component
  }
</script>

<svelte:window on:keydown={onKeyDown} />
{#if parsedActions.length > 0}
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
        <div class="section">
          <div class="leading">{section}</div>
          {#if actions[0]?.horizontalParentAction}
            <button
              class="trailing"
              on:click={() => {
                // Execute the horizontal parent action directly
                if (actions[0].horizontalParentAction?.handler) {
                  actions[0].horizontalParentAction.handler(
                    actions[0].horizontalParentAction,
                    null,
                    actions[0].payload
                  )
                }
              }}
            >
              {actions[0].horizontalParentAction?.name || 'Action'}
            </button>
          {/if}
        </div>
      {/if}
      {#each actions.filter((action) => !action.hiddenOnRoot) as action (action.id)}
        {#if isActionInline(action)}
          <!-- Always show component for Inline view -->
          <div
            class="inline-component permanent"
            class:active={getActionIndex(action.id) === activeActionIndex}
            in:slide={{ duration: 200 }}
          >
            <svelte:component this={action.component} {action} {...action.componentProps || {}} />
          </div>
        {:else if isActionInlineReplace(action) && getActionIndex(action.id) === activeActionIndex}
          <!-- Show component only when active for InlineReplace view -->
          <div class="inline-component replace" in:slide={{ duration: 200 }}>
            <svelte:component this={action.component} {action} {...action.componentProps || {}} />
          </div>
        {:else}
          <ActionItem
            {action}
            {isOption}
            on:execute
            on:selected={() => {
              activeActionIndex = getActionIndex(action.id)
              userHasNavigated = true
              log.debug('User clicked action, setting userHasNavigated = true')
            }}
            active={getActionIndex(action.id) === activeActionIndex}
          />
        {/if}
      {/each}
    {/each}
  </div>
{/if}

<style lang="scss">
  .menu {
    overflow-y: auto;
    outline: none;
    :global(.horizontal-list) {
      /* Make sure horizontal lists don't handle scroll events directly */
      pointer-events: auto;
      touch-action: none; /* Prevent touch scrolling from being handled by the list */
    }

    &:not(.modal) {
      padding-bottom: 0.335rem;
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
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8rem;
    padding: 0.4rem 1.25rem;
    box-sizing: border-box;
    color: var(--text);
    letter-spacing: 0.015rem;
    margin-top: 0.75rem;
    font-smooth: always;

    .trailing {
      padding: 0.5rem 0.5rem;
      line-height: 1;
    }
    .trailing:hover {
      background: paint(squircle);
      --squircle-radius: 4px;
      --squircle-smooth: 0.2;
      --squircle-fill: color-mix(in hsl, var(--border-color), transparent 10%);
    }
  }

  .inline-component {
    padding: 0.6rem;
    background: var(--background-accent);

    &.permanent {
      /* Styles for always-visible inline components */
      border-left: 2px solid transparent;

      &.active {
        border-left: 2px solid var(--text);
        background: var(--background-accent);
      }
    }

    &.replace {
      /* Styles for replacement inline components */
      border-left: 2px solid var(--text);
    }
  }
</style>
