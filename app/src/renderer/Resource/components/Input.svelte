<script lang="ts">
  import { Editor } from '@deta/editor'
  import type { MentionItemsFetcher } from '@deta/editor/src/lib/extensions/Mention/suggestion'
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
  data-tooltip-target="chat-input"
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
        on:update
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
    align-items: center;
    gap: 0.75rem;

    border-radius: 12px;
    border: 1px solid currentColor;
    border-color: light-dark(rgba(0, 0, 0, 0.015), rgba(255, 255, 255, 0.025));
    background: light-dark(rgba(0, 0, 0, 0.02), rgba(255, 255, 255, 0.04));

    outline: 3px solid rgb(from var(--accent) r g b / 0.15);
    outline-offset: -1px;
    background: light-dark(
      radial-gradient(
        290.88% 100% at 50% 0%,
        var(--tab-active-gradient-top, rgba(219, 237, 255, 0.96)) 0%,
        var(--tab-active-gradient-bottom, rgba(246, 251, 255, 0.93)) 100%
      ),
      radial-gradient(
        290.88% 100% at 50% 0%,
        var(--tab-active-gradient-top-dark, rgba(40, 53, 73, 0.92)) 0%,
        var(--tab-active-gradient-bottom-dark, rgba(27, 36, 56, 0.88)) 100%
      )
    );
    background: light-dark(
      radial-gradient(
        290.88% 100% at 50% 0%,
        var(--tab-active-gradient-top-p3, color(display-p3 0.9365 0.9644 0.9997 / 0.96)) 0%,
        var(--tab-active-gradient-bottom-p3, color(display-p3 0.9686 0.9843 1 / 0.93)) 100%
      ),
      radial-gradient(
        290.88% 100% at 50% 0%,
        color(display-p3 0.1569 0.2078 0.2863 / 0.92) 0%,
        color(display-p3 0.1255 0.1765 0.2706 / 0.88) 100%
      )
    );
    box-shadow:
      0 -0.5px 1px 0 rgba(119, 189, 255, 0.15) inset,
      0 1px 1px 0 light-dark(#fff, rgba(255, 255, 255, 0.05)) inset,
      0 12px 5px 0 #3e4750,
      0 7px 4px 0 rgba(62, 71, 80, 0.01),
      0 3px 3px 0 rgba(62, 71, 80, 0.02),
      0 1px 2px 0 rgba(62, 71, 80, 0.02),
      0 1px 1px 0 #000,
      0 1px 1px 0 rgba(0, 0, 0, 0.01),
      0 1px 1px 0 rgba(0, 0, 0, 0.05),
      0 0 1px 0 rgba(0, 0, 0, 0.09);
    box-shadow:
      0 -0.5px 1px 0 color(display-p3 0.5294 0.7333 0.9961 / 0.15) inset,
      0 1px 1px 0 light-dark(color(display-p3 1 1 1), color(display-p3 1 1 1 / 0.05)) inset,
      0 12px 5px 0 color(display-p3 0.251 0.2784 0.3098 / 0),
      0 7px 4px 0 color(display-p3 0.251 0.2784 0.3098 / 0.01),
      0 3px 3px 0 color(display-p3 0.251 0.2784 0.3098 / 0.02),
      0 1px 2px 0 color(display-p3 0.251 0.2784 0.3098 / 0.02),
      0 1px 1px 0 color(display-p3 0 0 0 / 0),
      0 1px 1px 0 color(display-p3 0 0 0 / 0.01),
      0 1px 1px 0 color(display-p3 0 0 0 / 0.05),
      0 0 1px 0 color(display-p3 0 0 0 / 0.09);
    .tab-title {
      color: var(--on-surface-accent);
    }
    color: var(--on-surface-accent);

    transition: all 0.4s cubic-bezier(0, 1.47, 0.52, 1);

    &.hide {
      background: transparent;
      border-color: transparent;
    }
    &:not(&.hide) {
      &:hover {
        outline: 3px solid rgb(from var(--accent) r g b / 0.4);
        background: light-dark(
          radial-gradient(
            290.88% 100% at 50% 0%,
            var(--tab-active-gradient-top, rgba(219, 237, 255, 0.96)) 0%,
            var(--tab-active-gradient-bottom, rgba(246, 251, 255, 0.93)) 100%
          ),
          radial-gradient(
            290.88% 100% at 50% 0%,
            var(--tab-active-gradient-top-dark, rgba(40, 53, 73, 0.92)) 0%,
            var(--tab-active-gradient-bottom-dark, rgba(27, 36, 56, 0.88)) 100%
          )
        );
        background: light-dark(
          radial-gradient(
            290.88% 100% at 50% 0%,
            var(--tab-active-gradient-top-p3, color(display-p3 0.9365 0.9644 0.9997 / 0.96)) 0%,
            var(--tab-active-gradient-bottom-p3, color(display-p3 0.9686 0.9843 1 / 0.93)) 100%
          ),
          radial-gradient(
            290.88% 100% at 50% 0%,
            color(display-p3 0.1569 0.2078 0.2863 / 0.92) 0%,
            color(display-p3 0.1255 0.1765 0.2706 / 0.88) 100%
          )
        );
        box-shadow:
          0 -0.5px 1px 0 rgba(119, 189, 255, 0.15) inset,
          0 1px 1px 0 light-dark(#fff, rgba(255, 255, 255, 0.05)) inset,
          0 12px 5px 0 #3e4750,
          0 7px 4px 0 rgba(62, 71, 80, 0.01),
          0 3px 3px 0 rgba(62, 71, 80, 0.02),
          0 1px 2px 0 rgba(62, 71, 80, 0.02),
          0 1px 1px 0 #000,
          0 1px 1px 0 rgba(0, 0, 0, 0.01),
          0 1px 1px 0 rgba(0, 0, 0, 0.05),
          0 0 1px 0 rgba(0, 0, 0, 0.09);
        box-shadow:
          0 -0.5px 1px 0 color(display-p3 0.5294 0.7333 0.9961 / 0.15) inset,
          0 1px 1px 0 light-dark(color(display-p3 1 1 1), color(display-p3 1 1 1 / 0.05)) inset,
          0 12px 5px 0 color(display-p3 0.251 0.2784 0.3098 / 0),
          0 7px 4px 0 color(display-p3 0.251 0.2784 0.3098 / 0.01),
          0 3px 3px 0 color(display-p3 0.251 0.2784 0.3098 / 0.02),
          0 1px 2px 0 color(display-p3 0.251 0.2784 0.3098 / 0.02),
          0 1px 1px 0 color(display-p3 0 0 0 / 0),
          0 1px 1px 0 color(display-p3 0 0 0 / 0.01),
          0 1px 1px 0 color(display-p3 0 0 0 / 0.05),
          0 0 1px 0 color(display-p3 0 0 0 / 0.09);
      }

      &:focus-within,
      &.active {
        outline: 5px solid rgb(from var(--accent) r g b / 0.4);
        outline-offset: -1px;
        background: light-dark(
          radial-gradient(
            290.88% 100% at 50% 0%,
            var(--tab-active-gradient-top, rgba(219, 237, 255, 0.96)) 0%,
            var(--tab-active-gradient-bottom, rgba(246, 251, 255, 0.93)) 100%
          ),
          radial-gradient(
            290.88% 100% at 50% 0%,
            var(--tab-active-gradient-top-dark, rgba(40, 53, 73, 0.92)) 0%,
            var(--tab-active-gradient-bottom-dark, rgba(27, 36, 56, 0.88)) 100%
          )
        );
        background: light-dark(
          radial-gradient(
            290.88% 100% at 50% 0%,
            var(--tab-active-gradient-top-p3, color(display-p3 0.9365 0.9644 0.9997 / 0.96)) 0%,
            var(--tab-active-gradient-bottom-p3, color(display-p3 0.9686 0.9843 1 / 0.93)) 100%
          ),
          radial-gradient(
            290.88% 100% at 50% 0%,
            color(display-p3 0.1569 0.2078 0.2863 / 0.92) 0%,
            color(display-p3 0.1255 0.1765 0.2706 / 0.88) 100%
          )
        );
        box-shadow:
          0 -0.5px 1px 0 rgba(119, 189, 255, 0.15) inset,
          0 1px 1px 0 light-dark(#fff, rgba(255, 255, 255, 0.05)) inset,
          0 12px 5px 0 #3e4750,
          0 7px 4px 0 rgba(62, 71, 80, 0.01),
          0 3px 3px 0 rgba(62, 71, 80, 0.02),
          0 1px 2px 0 rgba(62, 71, 80, 0.02),
          0 1px 1px 0 #000,
          0 1px 1px 0 rgba(0, 0, 0, 0.01),
          0 1px 1px 0 rgba(0, 0, 0, 0.05),
          0 0 1px 0 rgba(0, 0, 0, 0.09);
        box-shadow:
          0 -0.5px 1px 0 color(display-p3 0.5294 0.7333 0.9961 / 0.15) inset,
          0 1px 1px 0 light-dark(color(display-p3 1 1 1), color(display-p3 1 1 1 / 0.05)) inset,
          0 12px 5px 0 color(display-p3 0.251 0.2784 0.3098 / 0),
          0 7px 4px 0 color(display-p3 0.251 0.2784 0.3098 / 0.01),
          0 3px 3px 0 color(display-p3 0.251 0.2784 0.3098 / 0.02),
          0 1px 2px 0 color(display-p3 0.251 0.2784 0.3098 / 0.02),
          0 1px 1px 0 color(display-p3 0 0 0 / 0),
          0 1px 1px 0 color(display-p3 0 0 0 / 0.01),
          0 1px 1px 0 color(display-p3 0 0 0 / 0.05),
          0 0 1px 0 color(display-p3 0 0 0 / 0.09);
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
