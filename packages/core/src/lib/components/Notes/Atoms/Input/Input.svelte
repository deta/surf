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
          light-dark(rgba(50, 50, 93, 0.05), rgba(205, 205, 162, 0.02)) 0px 2px 5px -1px,
          light-dark(rgba(0, 0, 0, 0.1), rgba(255, 255, 255, 0.05)) 0px 1px 2px -1px;
      }
    }
  }
  :global(.text-resource-wrapper:has(.note-chat-input.floaty.firstLine) .editor p.active-line) {
    position: relative;
    z-index: 1;
  }

  :global(
      .text-resource-wrapper:has(.note-chat-input.floaty.firstLine) .editor p.active-line::after
    ) {
    transition-property: background, border-color, opacity;
    transition-duration: 200ms;
    transition-timing-function: ease-out;

    content: '';
    position: absolute;
    z-index: -1;
    pointer-events: none;
    inset: -3px;

    margin-inline: -5px;

    border-radius: 12px;
    border: 1px solid currentColor;
    border-color: light-dark(rgba(0, 0, 0, 0.015), rgba(255, 255, 255, 0.025));
    background: light-dark(rgba(0, 0, 0, 0.02), rgba(255, 255, 255, 0.04));

    :global(body.dark) & {
      border-color: rgba(255, 255, 255, 0.025);
      background: rgba(255, 255, 255, 0.04);
    }
  }

  :global(
      .text-resource-wrapper:has(.note-chat-input.floaty.firstLine)
        .editor:focus-within
        p.active-line::after
    ) {
    border-color: light-dark(rgba(0, 0, 0, 0.085), rgba(255, 255, 255, 0.095));
    background: light-dark(rgba(0, 0, 0, 0.015), rgba(255, 255, 255, 0.025));
    box-shadow:
      rgba(50, 50, 93, 0.05) 0px 2px 5px -1px,
      rgba(0, 0, 0, 0.1) 0px 1px 2px -1px;

    // welp.. thanks webdev.. light-dark for some reason doesnt work here..
    // always picks the light style even though app is in dark mode
    :global(body.dark) & {
      border-color: rgba(255, 255, 255, 0.095);
      background: rgba(255, 255, 255, 0.025);
      box-shadow:
        rgba(205, 205, 162, 0.02) 0px 2px 5px -1px,
        rgba(255, 255, 255, 0.05) 0px 1px 2px -1px;
    }
  }
</style>
