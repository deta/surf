<script lang="ts">
  import { Editor } from '@horizon/editor'
  import type { MentionItemsFetcher } from '@horizon/editor/src/lib/extensions/Mention/suggestion'
  import { createEventDispatcher } from 'svelte'
  import { writable, type Readable, type Writable } from 'svelte/store'

  const dispatch = createEventDispatcher<{
    blur: void
  }>()

  export let value: Writable<string> = writable('')
  export let placeholder: Readable<string> = writable('')

  export let active: boolean = false
  export let disabled: boolean = false
  export let hide: boolean = false
  export let autofocus: boolean = false
  export let submitOnEnter: boolean = true
  export let isEmpty: Writable<boolean> = writable(false)
  export let parseMentions: boolean = false
  export let mentionItemsFetcher: MentionItemsFetcher | undefined = undefined
  export let editor: Editor

  export const focusInput = () => __focusInput()

  let __focusInput: () => void

  let editorEl: HTMLElement
</script>

<div
  class="input-container"
  class:active
  class:hide
  class:disabled
  on:keydown={(e) => {
    if (e.key === 'Escape') {
      editor?.clear()
      dispatch('blur')
    }
  }}
  role="none"
>
  <div class="flex-grow overflow-y-auto max-h-52">
    {#if !hide}
      <Editor
        bind:this={editor}
        bind:content={$value}
        bind:editorElement={editorEl}
        bind:focus={__focusInput}
        {autofocus}
        {submitOnEnter}
        {parseMentions}
        {mentionItemsFetcher}
        placeholder={$placeholder}
        on:submit
      />
    {/if}
  </div>
  <slot />
</div>

<style lang="scss">
  .input-container {
    transition-property: background, border-color, opacity;
    transition-duration: 200ms;
    transition-timing-function: ease-out;

    width: 100%;
    padding: 2px 8px;

    display: flex;
    align-items: start;
    gap: 0.75rem;

    border-radius: 12px;
    border: 1px solid currentColor;
    border-color: light-dark(rgba(0, 0, 0, 0.015), rgba(255, 255, 255, 0.025));
    background: light-dark(rgba(0, 0, 0, 0.02), rgba(255, 255, 255, 0.04));

    &.hide {
      background: transparent;
      border-color: transparent;
    }
    &:not(&.hide) {
      &:hover {
        border-color: light-dark(rgba(0, 0, 0, 0.03), rgba(255, 255, 255, 0.008));
        background: light-dark(rgba(0, 0, 0, 0.04), rgba(255, 255, 255, 0.06));
      }

      &:focus-within,
      &.active {
        border-color: light-dark(rgba(0, 0, 0, 0.085), rgba(255, 255, 255, 0.095));
        background: light-dark(rgba(0, 0, 0, 0.015), rgba(255, 255, 255, 0.025));
        box-shadow:
          rgba(50, 50, 93, 0.05) 0px 2px 5px -1px,
          rgba(0, 0, 0, 0.1) 0px 1px 2px -1px;
      }
    }
  }
</style>
