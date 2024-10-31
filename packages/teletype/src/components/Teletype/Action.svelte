<script lang="ts">
  import { useTeletype } from './index'
  import { createEventDispatcher } from 'svelte'
  import { slide, fade } from 'svelte/transition'

  import type { Action } from '../Teletype'
  import Icon from './Icon.svelte'
  import { TagStatus } from './types'

  export let action: Action
  export let active = false
  export let isOption = false
  export let animations = true

  const teletype = useTeletype()
  const { inputValue } = teletype

  let hovering = false

  $: parentAction = action.parent ? teletype.getActionByID(action.parent) : null
  $: breadcrumb =
    action.searchBreadcrumb ||
    action.breadcrumb ||
    (parentAction && parentAction.breadcrumb) ||
    (parentAction && parentAction.name)

  const tagColors = {
    [TagStatus.DEFAULT]: {
      color: 'var(--text-light)',
      background: 'var(--background-accent)',
    },
    [TagStatus.SUCCESS]: { color: '#107c43', background: '#a3e5c2' },
    [TagStatus.WARNING]: { color: '#87580c', background: '#fddeab' },
    [TagStatus.ACTIVE]: { color: '#730b3c', background: '#e18cb2' },
    [TagStatus.FAILED]: { color: '#850f0f', background: '#f8adad' },
  }

  $: tagStyle = tagColors[action.tagStatus || TagStatus.DEFAULT]

  let elem
  export const click = () => {
    elem.click()
  }

  type Events = {
    execute: Action
    selected: Action
  }

  const dispatch = createEventDispatcher<Events>()

  // On click select the action or if it already is selected, execute it
  const handleClick = (e: MouseEvent) => {
    if (active || !e.shiftKey) {
      dispatch('execute', action)
    } else {
      dispatch('selected')
    }
  }

  const conditionalTransition = (node, options) => {
    if (animations) {
      return options.fn(node, options)
    }
  }
</script>

<!-- svelte-ignore a11y-mouse-events-have-key-events -->
<!-- svelte-ignore a11y-interactive-supports-focus -->
<!-- svelte-ignore a11y-click-events-have-key-events -->
<div
  bind:this={elem}
  id={action.id}
  role="option"
  aria-selected={active}
  in:slide={{ duration: 200 }}
  class="action"
  class:active
  class:option={isOption}
  on:click|stopPropagation={handleClick}
  on:mouseenter={() => (hovering = true)}
  on:mouseleave={() => (hovering = false)}
>
  {#if action.icon}
    <div
      class="icon"
      in:fade={{ duration: 200 }}
    >
      <Icon icon={action.icon} />
    </div>
  {/if}
  <div
    class="name"
    in:fade={{ duration: 200 }}
  >
    {action.name}
  </div>
  {#if action.description && (action.hideDescriptionUntilSelected ? active || hovering : true)}
    <div
      class="parent"
    >
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
      title="Press {navigator.platform &&
      navigator.platform.toUpperCase().indexOf('MAC') >= 0
        ? '⌘'
        : 'Ctrl'} + key"
      in:fade={{ duration: 200 }}
    >
      {navigator.platform &&
      navigator.platform.toUpperCase().indexOf('MAC') >= 0
        ? '⌘'
        : 'Ctrl'}
      {action.shortcut.toUpperCase()}
    </div>
  {/if}
</div>

<style lang="scss">
  .action {
    padding: 0.6rem;
    box-sizing: border-box;
    border-left: 2px solid transparent;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    cursor: pointer;
    user-select: none;

    &.active {
      border-left-color: var(--text);
      background: var(--background-accent);
    }

    &:hover {
      background: var(--background-accent);
      filter: brightness(1.01);
    }
  }

  .option {
    padding: 0.5rem;
    border: 0;

    &.active {
      border: 0;
    }
  }

  .name {
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
  }

  .shortcut {
    margin-left: auto;
    padding: 4px 7px;
    border-radius: var(--border-radius);
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--tag-color);
    background: var(--tag-background);
    opacity: 0.8;
    flex-shrink: 0;
  }
</style>
