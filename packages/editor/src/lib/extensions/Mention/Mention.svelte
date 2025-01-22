<script lang="ts">
  import { isModKeyPressed } from '@horizon/utils'
  import type { MentionItem } from '../../types'
  import type { MentionAction } from './mention'

  export let id: string
  export let label: string
  export let onClick: ((item: MentionItem, action: MentionAction) => void) | undefined

  const dispatchClick = (action: MentionAction) => {
    if (onClick) {
      onClick({ id, label }, action)
    }
  }

  const handleClick = (e: MouseEvent) => {
    e.preventDefault()
    e.stopImmediatePropagation()

    if (isModKeyPressed(e)) {
      if (e.shiftKey) {
        dispatchClick('new-tab')
      } else {
        dispatchClick('new-background-tab')
      }
    } else if (e.shiftKey) {
      dispatchClick('overlay')
    } else {
      dispatchClick('open')
    }
  }

  // TODO: add context menu
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<span {...$$restProps} on:click={handleClick}>
  {label}
</span>
