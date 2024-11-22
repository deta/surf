<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import ActionList from './ActionList.svelte'
  import type { Action, ActionPanelOption } from './types'

  export let action: Action
  export let options: ActionPanelOption[] | (() => Promise<ActionPanelOption[]>)
  export let hideDefault = false

  let computedOptions = []

  $: parsedOptions = [
    ...(!hideDefault
      ? [
          {
            id: 'default-option',
            icon: 'arrow_right',
            name: action.actionText || 'Open',
            handler: () => dispatch('default')
          }
        ]
      : []),
    ...(typeof options !== 'function' ? options : []),
    ...computedOptions
  ] as Action[]

  $: if (typeof options === 'function') {
    options().then((value) => {
      computedOptions = value
    })
  }

  const dispatch = createEventDispatcher<{
    execute: ActionPanelOption
    default: void
  }>()

  const handleOptionClick = (e: CustomEvent<Action>) => {
    dispatch('execute', e.detail as ActionPanelOption)
  }
</script>

<div class="action-panel">
  {#if action.icon}{/if}
  <div class="title">Actions for {action.name}</div>
  <ActionList actions={parsedOptions} on:execute={handleOptionClick} isOption />
</div>

<style lang="scss">
  .action-panel {
    position: absolute;
    transform: translateY(-100%);
    top: -0.5rem;
    right: 0.5rem;
    border-radius: var(--border-radius);
    border: var(--border-width) solid var(--border-color);
    outline: 1px solid rgba(126, 168, 240, 0.05);
    padding: 0.25rem;
    min-width: 200px;
    background: var(--background-dark);
    background: var(--background-dark-p3);
    flex-direction: column;
    box-shadow:
      inset 0px 1px 1px -1px white,
      inset 0px -1px 1px -1px white,
      inset 0px 30px 20px -20px rgba(255, 255, 255, 0.15),
      0px 0px 89px 0px rgba(0, 0, 0, 0.18),
      0px 4px 18px 0px rgba(0, 0, 0, 0.18),
      0px 1px 1px 0px rgba(126, 168, 240, 0.3),
      0px 4px 4px 0px rgba(126, 168, 240, 0.15);
    box-shadow:
      inset 0px 1px 4px -1px white,
      inset 0px -1px 1p2 0 white,
      inset 0px 30px 20px -20px color(display-p3 1 1 1 / 0.15),
      0px 0px 89px 0px color(display-p3 0 0 0 / 0.18),
      0px 4px 18px 0px color(display-p3 0 0 0 / 0.18),
      0px 1px 1px 0px color(display-p3 0.5294 0.6549 0.9176 / 0.3),
      0px 4px 4px 0px color(display-p3 0.5294 0.6549 0.9176 / 0.15);
  }

  .title {
    font-size: 1rem;
    padding: 0.75rem 1rem 0.5rem 1rem;
    color: var(--text);
  }
</style>
