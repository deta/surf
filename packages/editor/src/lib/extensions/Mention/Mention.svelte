<script lang="ts">
  import { isModKeyPressed } from '@deta/utils'
  import { type MentionItem, MentionItemType } from '../../types'
  import type { MentionAction } from './mention'
  import { DynamicIcon } from '@deta/icons'
  import { Favicon } from '@deta/ui'

  export let id: string
  export let label: string
  export let type: MentionItemType
  export let icon: string | undefined
  export let char: string | undefined
  export let onClick: ((item: MentionItem, action: MentionAction) => void) | undefined
  export let faviconURL: string | undefined = undefined

  const dispatchClick = (action: MentionAction) => {
    if (onClick) {
      onClick({ id, label, type, icon }, action)
    }
  }

  const handleClick = (e: MouseEvent) => {
    e.preventDefault()
    e.stopImmediatePropagation()

    if (e.type === 'auxclick') {
      if (e.button === 1) {
        dispatchClick('new-background-tab')
      }

      return
    }

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
<span {...$$restProps} on:click={handleClick} on:auxclick={handleClick}>
  {#if faviconURL}
    <Favicon url={faviconURL} title={label} />
    <div class="label-wrapper">
      {label}
    </div>
  {:else if icon}
    <DynamicIcon name={icon} size="14px" />
    <div class="label-wrapper">
      {label}
    </div>
  {:else if char}
    {char + label}
  {:else}
    {label}
  {/if}
</span>

<style lang="scss">
  .label-wrapper {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 20ch;
    display: inline-block;
    line-height: 1.2;
    vertical-align: baseline;
  }
</style>
