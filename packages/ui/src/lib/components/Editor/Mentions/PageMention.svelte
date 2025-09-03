<script lang="ts">
  import { DynamicIcon } from '@deta/icons'
  import type { Fn } from '@deta/types';
  import { clickOutside } from '@deta/utils'

  let {
    text = $bindable(),
    placeholder = '',
    icon, 
    editing = false,
    active, 
    onclick, 
    oncancel,
    onclose,
    onchange, 
    ...restProps
  }: {
    text?: string
    placeholder?: string
    icon?: string
    editing: boolean
    active?: boolean
    onclick?: Fn
    oncancel?: Fn
    onclose?: Fn
    onchange?: (value: String) => void
  } = $props()

  let editorEl: HTMLSpanElement = $state()

  const handleClose = () => {
    onchange?.(editorEl?.textContent)
    onclose?.()
  }

  $effect(() => {
    if (!editorEl) return

    editorEl.focus()
    const range = document.createRange()
    range.selectNodeContents(editorEl)
    const sel = window.getSelection()
    sel!.removeAllRanges()
    sel!.addRange(range)
  })
</script>

<span
  {...restProps}
  class="mention-page"
  class:active
  class:editing
  role="none"
  {onclick}
>
  {#if icon}<DynamicIcon name={icon} size="19px" />{/if}

  {#if !editing}
    <span class="text">{text}</span>
  {:else}
    <span
      bind:this={editorEl}
      bind:textContent={text}
      contenteditable="true"
      class="text"
      spellcheck="false"
      role="none"
      {placeholder}
      onkeydown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          oncancel?.()
        }
        else if (e.key === 'Enter') {
          e.preventDefault()
          handleClose()
        }
      }}
      {@attach clickOutside(() => handleClose())}
    ></span>
  {/if}
</span>

<style lang="scss">
  .mention-page {
    display: inline-block;
    display: flex;
    justify-content: left;
    align-items: center;
    gap: 0.4ch;
    width: max-content;
                  max-width: 100%;
                  white-space: nowrap;

    font-family: 'Inter';
    font-weight: 500;

    user-select: none;
    color: color-mix(in oklch, currentColor, transparent 40%);
    padding: 2px 6px;
    border-radius: 8px;
    -electron-corner-smoothing: system-ui;
    text-overflow: ellipsis;
    overflow:hidden;

          transition-property: background, color;
                  transition-duration: 69ms;
                  transition-timing-function: ease-out;


    &:hover,
    &.active,
    &.editing {
      background: rgba(0, 0, 0, 0.05);
    color: color-mix(in oklch, currentColor, transparent 10%);
    }

    > .text {
      text-decoration: underline;
      text-decoration-color: rgba(0, 0, 0, 0.1);
      text-decoration-color: color-mix(in oklch, currentColor, transparent 90%);
      text-underline-offset: 2px;

      &:empty:before {
        content: attr(placeholder);
        color: rgba(0,0,0,0.175);
        pointer-events: none;
        user-select: none;
      }


      &:focus, &:focus-within {
        outline: none;
      }
    }

    &.editing > .text {
      text-decoration-style: dashed;
    }
  }
  :global([data-context-menu-anchor] .mention-page) {
    background: rgba(0, 0, 0, 0.05);
  }
</style>
