<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import ActionList from './ActionList.svelte'
  import type { Action, ActionPanelOption } from './types'

  let {
    action,
    options,
    hideDefault = false
  }: {
    action: Action
    options: ActionPanelOption[] | (() => Promise<ActionPanelOption[]>)
    hideDefault?: boolean
  } = $props()

  let computedOptions = $state([])

  const parsedOptions = $derived([
    ...(!hideDefault
      ? [
          {
            id: 'default-option',
            icon: action.actionIcon || 'arrow.right',
            name: action.actionText || 'Open',
            shortcutType: 'primary',
            handler: () => dispatch('default')
          }
        ]
      : []),
    ...(typeof options !== 'function' ? options : []),
    ...computedOptions
  ] as Action[])

  $effect(() => {
    if (typeof options === 'function') {
      options().then((value) => {
        computedOptions = value
      })
    }
  })

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
    top: -0.45rem;
    right: 0;
    border-radius: var(--border-radius);
    outline: 1px solid rgba(126, 168, 240, 0.05);
    padding: 0.25rem;
    min-width: 340px;
    background: rgba(255, 255, 255, 0.95);
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    flex-direction: column;
    box-shadow:
      inset 0px 1px 1px -1px white,
      inset 0px -1px 1px -1px white,
      inset 0px 30px 20px -20px rgba(255, 255, 255, 0.15),
      0px 0px 10px 0px rgba(0, 0, 0, 0.08),
      0px 2px 8px 0px rgba(0, 0, 0, 0.08),
      0px 1px 1px 0px rgba(126, 168, 240, 0.2),
      0px 2px 2px 0px rgba(126, 168, 240, 0.1);
    box-shadow:
      inset 0px 1px 4px -1px white,
      inset 0px -1px 1p2 0 white,
      inset 0px 30px 20px -20px color(display-p3 1 1 1 / 0.15),
      0px 0px 40px 0px color(display-p3 0 0 0 / 0.08),
      0px 2px 8px 0px color(display-p3 0 0 0 / 0.08),
      0px 1px 1px 0px color(display-p3 0.5294 0.6549 0.9176 / 0.2),
      0px 2px 2px 0px color(display-p3 0.5294 0.6549 0.9176 / 0.1);
  }

  .title {
    font-size: 0.95rem;
    padding: 0.75rem 1rem 0.5rem 1rem;
    color: var(--text);
  }
</style>
