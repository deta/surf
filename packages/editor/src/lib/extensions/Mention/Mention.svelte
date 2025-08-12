<script lang="ts">
  import { isModKeyPressed } from '@deta/utils'
  import { type MentionItem, MentionItemType } from '../../types'
  import type { MentionAction } from './mention'
  import { DynamicIcon } from '@deta/icons'

  export let id: string
  export let label: string
  export let type: MentionItemType
  export let icon: string | undefined
  export let char: string | undefined
  export let onClick: ((item: MentionItem, action: MentionAction) => void) | undefined

  const dispatchClick = (action: MentionAction) => {
    if (onClick) {
      onClick({ id, label, type, icon }, action)
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
  {#if icon}
    <DynamicIcon name={icon} size="14px" />
    {label}
  {:else if char}
    {char + label}
  {:else}
    {label}
  {/if}
</span>
