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
            handler: () => dispatch('default'),
          },
        ]
      : []),
    ...(typeof options !== 'function' ? options : []),
    ...computedOptions,
  ] as Action[]

  $: if (typeof options === 'function') {
    Promise.resolve(options()).then(value => {
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
    background: var(--background-dark);
    border: var(--border-width) solid var(--border-color);
    outline: 4px solid var(--outline-color);
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    padding: 0.25rem 0rem;
    min-width: 200px;
  }

  .title {
    font-size: 0.8rem;
    padding: 0.25rem 0.5rem;
    color: var(--text-light);
  }
</style>
