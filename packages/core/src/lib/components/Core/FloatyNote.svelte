<script lang="ts">
  import AppBarButton from '@horizon/core/src/lib/components/Browser/AppBarButton.svelte'
  import { createEventDispatcher, tick } from 'svelte'
  import { Icon } from '@horizon/icons'
  import { get, writable } from 'svelte/store'
  import { SmartNote, useSmartNotes } from '@horizon/core/src/lib/service/ai/note'
  import NoteTitle from '@horizon/core/src/lib/components/Chat/Notes/NoteTitle.svelte'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import { activeTimeline } from '../Onboarding/timeline'
  import { CompletionEventID } from '../Onboarding/onboardingScripts'
  import { OnboardingAction } from '../Onboarding/onboardingScripts'
  import Chat from '../Chat/Chat.svelte'
  import { type MentionItem } from '@horizon/editor'
  import { PageChatMessageSentEventTrigger } from '@horizon/types'
  import { type ChatSubmitOptions } from '@horizon/core/src/lib/components/Resources/Previews/Text/TextResource.svelte'
  import { wait } from '@horizon/utils'

  let chatComponent: Chat

  export let isChatExpanded: boolean = true
  export let chatLocation: 'left' | 'right' | 'center' = 'right'

  const tabsManager = useTabsManager()
  const smartnotes = useSmartNotes()
  const note = writable<SmartNote | null>(null)

  const dispatch = createEventDispatcher<{
    close: Blob | null // Task implementor of this component to close it (blob: screenshot, false: cancelled / issue)
    'open-note-in-sidebar': { note: SmartNote; force: boolean }
  }>()

  function handleClose() {
    // TODO: @maxi abort chat completion, if running (not possible rn?)
    dispatch('close', null)
  }

  function handleOpenAsTab() {
    if (!$note) return

    tabsManager.openResourcFromContextAsPageTab($note.id)
    dispatch('close', null)
  }

  async function handleExpandChat() {
    if (!$note) return

    dispatch('close', null)

    const hasActiveTimeline = get(activeTimeline) !== null

    if (hasActiveTimeline) {
      // is onboarding
      $note?.updateTitle('Surf Onboarding Note')
      dispatch('open-note-in-sidebar', {
        note: $note,
        force: true
      })
      return
    }

    dispatch('open-note-in-sidebar', {
      note: $note,
      force: false
    })

    document.dispatchEvent(
      new CustomEvent(CompletionEventID.OpenVisionNoteInSidebar, { bubbles: true })
    )
  }

  export const createChatCompletion = async (
    query: string,
    mentions?: MentionItem[],
    trigger?: PageChatMessageSentEventTrigger,
    opts?: Partial<ChatSubmitOptions>
  ) => {
    if (!$note) {
      note.set(await smartnotes.createNote(''))
      await wait(500) // TODO: i'm going to cry
    }
    if (!chatComponent) {
      throw new Error('Chat component not initialized')
    }
    if (opts?.screenshot) {
      await $note?.contextManager.addScreenshot(opts.screenshot)
    }
    if (opts?.addActiveTab) {
      await $note?.contextManager.addActiveTab()
      // TODO: hacky this is to wait for the tab to be added
      // there is no callback for when the tab is ready
      await wait(800)
    }
    await chatComponent.createChatCompletion(query, mentions, trigger, opts)
  }
</script>

<div class="chatWrapper location-{chatLocation}" class:expanded={isChatExpanded}>
  <div
    class="messageBox"
    class:expanded={isChatExpanded}
    data-tooltip-reference="message-box"
    style="view-transition-name: screen-picker-chat;"
  >
    <header>
      <div class="messageBoxHeaderLeft">
        <AppBarButton on:click={handleClose} data-tooltip-disable>
          <Icon name="close" size="1rem" />
        </AppBarButton>

        {#if $note}
          <NoteTitle note={$note} fallback="New Note" small />
        {/if}
      </div>

      <div class="messageBoxHeaderRight">
        <AppBarButton on:click={handleOpenAsTab} data-tooltip-disable>
          <Icon name="arrow.diagonal" size="1rem" />
        </AppBarButton>

        <AppBarButton
          on:click={handleExpandChat}
          data-tooltip-target="open-in-sidebar-button"
          data-tooltip-action={OnboardingAction.OpenNoteInSidebar}
        >
          <Icon name="sidebar.right" size="1rem" />
        </AppBarButton>
      </div>
    </header>

    {#if $note}
      <Chat
        bind:this={chatComponent}
        note={$note}
        inputOnly={!isChatExpanded}
        on:clear-chat={() => {}}
        on:clear-errors={() => {}}
        on:close-chat
        on:open-context-item
        on:process-context-item
        on:highlightWebviewText
        on:seekToTimestamp
      />
    {/if}
  </div>
</div>

<style lang="scss">
  $transition-timing: 82ms;
  $transition-easing: cubic-bezier(0.19, 1, 0.22, 1);

  :global(body) {
    &:has(#screen-picker.isMouseInside:not(.isLocked)) #screen-picker {
      cursor: grab !important;
    }
    &:has(#screen-picker.isMovingRect) #screen-picker {
      cursor: grabbing !important;
    }
  }
  :global(body:has(#screen-picker) webview) {
    pointer-events: none !important;
  }
  :global(body:has(#screen-picker) #screen-picker .chatWrapper webview) {
    pointer-events: all !important;
  }

  #screen-picker-backdrop {
    position: fixed;
    inset: 0;
    isolation: isolate;

    z-index: 99;

    &.blurred {
      //background: rgb(0 0 0 / 0.25);
      backdrop-filter: blur(1.25px);
      background: rgba(0, 0, 0, 0.075);
    }
    //background: linear-gradient(to top, rgba(255, 255, 255, 2) 10%, rgba(255, 255, 255, 0) 100%);
    //background: radial-gradient(
    //  circle at 50% 109%,
    //  rgb(190 205 212 / 67%) 20%,
    //  rgba(255, 255, 255, 0) 70%
    //);
    &:not(.disabled) {
      cursor: crosshair;
    }

    clip-path: polygon(
      0% 0%,
      100% 0%,
      100% 100%,
      0% 100%,
      0% var(--rect-y),
      var(--rect-x) var(--rect-y),
      var(--rect-x) calc(var(--rect-y) + var(--rect-h)),
      calc(var(--rect-x) + var(--rect-w)) calc(var(--rect-y) + var(--rect-h)),
      calc(var(--rect-x) + var(--rect-w)) var(--rect-y),
      var(--rect-x) var(--rect-y),
      0% var(--rect-y)
    );
    margin-top: -3px;
    margin-left: -3px;

    .instructions {
      transition-property: opacity, transform;
      transition-duration: 145ms;
      transition-delay: 123ms;
      transition-timing-function: ease-out;
      --offsetY: 0px;

      position: fixed;
      bottom: 11.5rem;
      &.edge {
        bottom: 1rem;
      }
      left: 50%;
      transform: translateX(-50%) translateY(var(--offsetY, 0px));
      background: #222;
      background: var(--background-dark-p3);
      color: var(--text);
      padding-block: 0.5rem;
      padding-left: 1rem;
      padding-right: 1.25rem;
      font-size: 0.95rem;
      font-weight: 450;
      border-radius: 5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      user-select: none;
      pointer-events: none;
      border: var(--border-width) solid var(--border-color);

      &:global(._starting) {
        opacity: 0;
        --offsetY: 3px;
      }
      opacity: 1;

      .icon {
        margin-top: 1px;
      }
    }
  }

  #screen-picker-frame {
    pointer-events: none;
    box-sizing: content-box;
    position: absolute;
    z-index: 2147483642;

    top: var(--rect-y);
    left: var(--rect-x);
    width: var(--rect-w);
    height: var(--rect-h);
    margin-top: -6px;
    margin-left: -6px;

    background: none;
    box-sizing: content-box;
    border: 3px dotted #fff;
    border-radius: 0.75rem;
    // filter: invert(100%);
    mix-blend-mode: difference;

    mix-blend-mode: exclusion;
  }

  :global(#screen-picker) {
    position: absolute;
    z-index: 2147483642;

    top: var(--rect-y);
    left: var(--rect-x);
    width: var(--rect-w);
    height: var(--rect-h);

    anchor-name: --screen-picker;

    background: none;
    box-sizing: content-box;
    border-radius: 8px;
    //border: 3px dotted #fff;
    //backdrop-filter: invert(100%);
    // filter: invert(100%);
    // mix-blend-mode: exclusion;
    // mix-blend-mode: difference;

    // Makes the border fit outside the screenshot area
    margin-top: -3px;
    margin-left: -3px;
    &.isLocked {
      border: 3px solid #999;
    }

    &.isResizing .toolbox * {
      pointer-events: none !important;
    }

    &.insetTools {
      .toolbox {
        top: unset;
        bottom: calc(anchor(end) + 1em);
      }
      &:has(.expanded) .toolbox {
        bottom: calc(anchor(end) + 0.5em);
      }
      .messageBox {
        top: unset;
        bottom: calc(anchor(end) + 0em) !important;
      }
    }

    .toolbox {
      width: 100%;
      max-width: 44ch;
      pointer-events: all;

      display: flex;
      flex-direction: column;
      align-items: start;

      position: fixed;
      position-anchor: --screen-picker;
      top: calc(anchor(end) + 1em);
      left: calc(anchor(center));
      transform: translateX(-50%);
      z-index: 10;

      transition-property: top, left, bottom;
      transition-duration: $transition-timing;
      transition-timing-function: $transition-easing;

      --radii: 12px;

      &.mode-as-input {
        &:not(.insetTools) {
          ul.buttonGroup {
            border-bottom-left-radius: var(--radii) !important;
            border-bottom-right-radius: var(--radii) !important;
          }
        }
      }

      ul.buttonGroup {
        display: flex;
        align-items: center;
        width: fit-content;
        height: 100%;

        overflow: hidden;
        padding: 0.2em;

        background: light-dark(#fff, rgba(24, 24, 24, 1));
        border-radius: var(--radii);
        border: 1px solid currentColor;
        border-color: light-dark(rgba(0, 0, 0, 0.125), rgba(255, 255, 255, 0.085));

        color: light-dark(#222, #fff);
        font-weight: 450;
        letter-spacing: 0.13px;

        > li {
          --radii: calc(12px - 0.2em);

          display: flex;
          align-items: center;
          height: 100%;
          button {
            height: 100%;
            display: flex;
            align-items: center;
            gap: 0.5ch;
            padding: 0.25em 0.7em;
            letter-spacing: 0.01em;

            transition:
              background 65ms ease-out,
              color 65ms ease-out;

            &:hover,
            &.active {
              background: rgb(from #93c7fd r g b / 0.9);
              color: #222;

              :global(body.custom) & {
                background: var(--base-color);
                color: var(--contrast-color);
              }
            }
          }
        }
      }

      &.chatExpanded,
      &.mode-as-input {
        top: calc(anchor(end) - 0px) !important;
        left: calc(anchor(center) + 0em);
        width: fit-content;

        &:not(.insetTools) ul.buttonGroup {
          border-top-left-radius: 0;
          border-top-right-radius: 0;

          border-top: 0 !important;

          > li {
            button {
            }
          }

          > :first-child {
            border-bottom-left-radius: var(--radii) !important;
            border-bottom-right-radius: 0 !important;
            border-top-right-radius: 0 !important;
            border-top-left-radius: 0 !important;
            overflow: hidden;
          }
          > :last-child {
            border-bottom-right-radius: var(--radii) !important;
            border-bottom-left-radius: 0 !important;
            border-top-right-radius: 0 !important;
            border-top-left-radius: 0 !important;
            overflow: hidden;
          }
        }

        &.insetTools {
          top: unset !important;
          bottom: calc(anchor(end) + 3px) !important;

          ul.buttonGroup {
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
            border-bottom: 0 !important;

            > :first-child {
              border-top-left-radius: var(--radii) !important;
              border-bottom-right-radius: 0 !important;
              border-top-right-radius: 0 !important;
              border-bottom-left-radius: 0 !important;
              overflow: hidden;
            }
            > :last-child {
              border-top-right-radius: var(--radii) !important;
              border-bottom-left-radius: 0 !important;
              border-bottom-right-radius: 0 !important;
              border-top-left-radius: 0 !important;
              overflow: hidden;
            }
          }
        }
      }

      &:not(.chatExpanded) {
        ul.buttonGroup {
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
          border-bottom: 0 !important;

          > :first-child {
            border-top-left-radius: var(--radii) !important;
            border-bottom-right-radius: 0 !important;
            border-top-right-radius: 0 !important;
            border-bottom-left-radius: 0 !important;
            overflow: hidden;
          }
          > :last-child {
            border-top-right-radius: var(--radii) !important;
            border-bottom-left-radius: 0 !important;
            border-top-left-radius: 0 !important;
            border-bottom-right-radius: 0 !important;
            overflow: hidden;
          }
        }
      }

      > ul {
        margin-left: 1em;
        display: flex;
        gap: 1ch;
        align-items: center;
        font-size: 0.9em;
        pointer-events: auto;

        .separator {
          height: 20px;
          border-right: 2px solid #fff;
        }
      }
    }

    .apps-wrapper {
      position: fixed;
      position-anchor: --screen-picker;
      top: calc(anchor(end) + 6.5em);
      left: calc(anchor(center));
      position-try-fallbacks: top center;
      transform: translateX(-50%);
      overflow: visible;

      width: 100%;
      max-width: 36ch;

      transition-property: top, left, bottom;
      transition-duration: $transition-timing;
      transition-timing-function: $transition-easing;
    }

    .chatWrapper {
      position: fixed;
      inset: 0;
      position-anchor: --screen-picker;
      min-width: 52ch;

      transition-property: top, left, bottom;
      transition-duration: $transition-timing;
      transition-timing-function: $transition-easing;

      &:not(.expanded) {
        display: contents;
      }

      &.location-left {
        //width: calc(anchor(start));
        right: calc(anchor(start));
        flex-direction: row-reverse;
      }
      &.location-right {
        left: calc(anchor(end));
        flex-direction: row;
      }
      &.location-center {
        left: 50%;
        transform: translateX(-50%);
        flex-direction: row;
        justify-content: center;
        min-width: 70ch;
      }

      //     background: rgba(0, 0, 123, 0.4);
      display: flex;
      padding: 1em;

      .messageBox {
        width: 100%;
        height: 100%;
        max-width: min(50ch, 45vw);
        max-height: 10ch;
        min-height: 10ch;

        display: flex;
        flex-direction: column;

        background: transparent;
        border-radius: 11px;
        overflow: hidden;

        border: 3px solid light-dark(rgba(0, 0, 0, 0.125), rgba(255, 255, 255, 0.085));

        pointer-events: all;
        cursor: default;

        > header {
          //height: 3em;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1em;
          padding: 0.5em 0.5em;
          width: 100%;

          font-size: 0.9em;

          background: light-dark(#fff, #101827);
          color: #ababab;
          border-bottom: 1px solid light-dark(#eee, #454545);

          .messageBoxHeaderLeft {
            display: flex;
            align-items: center;
            gap: 0.5em;
            width: 100%;
            overflow: hidden;

            > div {
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
          }

          .messageBoxHeaderRight {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            gap: 0.5em;
            overflow: visible;
          }

          button {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            gap: 0.4ch;
            padding: 0.25em 0.45em;

            border-radius: 7px;

            transition:
              background 65ms ease-out,
              color 65ms ease-out;

            &:hover {
              background: rgb(from #93c7fd r g b / 0.4);
              color: #222;
            }

            :global(body.custom) & {
              &:hover {
                background: var(--base-color);
                color: var(--contrast-color);
              }
            }
          }
        }

        &.expanded {
          max-width: 57ch;
          max-width: min(60ch, 45vw);
          max-height: 85vh;
          height: 100%;
          margin-block: auto;

          background: light-dark(#f3f3f3, #101827);
        }
        &:not(.expanded) {
          position: fixed;
          position-anchor: --screen-picker;
          bottom: calc(anchor(end) - 6.25em);
          left: calc(anchor(center));
          position-try-fallbacks: top center;
          transform: translateX(-50%);
          overflow: visible;

          transition-property: top, left, bottom;
          transition-duration: $transition-timing;
          transition-timing-function: $transition-easing;
        }
      }

      // Enhanced styling for center mode
      &.location-center .messageBox {
        &.expanded {
          max-width: 75ch;
          max-width: min(80ch, 60vw);
        }
      }
    }
  }

  .vision-disclaimer {
    z-index: 1;
    margin-left: 1em;
    display: flex;
    align-items: center;
    gap: 0.75em;
    width: fit-content;
    height: 100%;

    overflow: hidden;
    padding: 0.45em 0.75em;

    color: rgb(241, 152, 64);
    background: #fff;
    border-radius: var(--radii);
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    border-top: 0 !important;

    font-weight: 450;
    letter-spacing: 0.01em;
    font-size: 0.8em;
    pointer-events: auto;
  }

  .vision-disclaimer-icon {
    flex-shrink: 0;
  }

  /* :global(#screen-picker .chatWrapper .chat-input-wrapper) {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 1.25em;
  --text-color-dark: #222;
}*/
  :global(#screen-picker .chatWrapper .suggestion-items) {
    padding-inline: -0.25rem;
  }

  :global(#screen-picker .chatWrapper .chat.bg-gradient-to-t) {
    background: none;
    box-shadow: none !important;
  }
  :global(body.custom #screen-picker .chatWrapper .chat .submit-button) {
    background: var(--base-color);
    color: var(--contrast-color);

    &:hover {
      background: color-mix(in hsl, var(--base-color), 15% hsl(0, 0%, 0%));
    }
    :global(body.dark) &:hover {
      background: color-mix(in hsl, var(--base-color), 20% hsl(0, 0%, 100%));
    }
  }

  :global(.prompt-item) {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 0.5rem;

    .icon {
      max-width: 1.25rem;
      max-height: 1.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .name {
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 1rem;
      font-weight: 400;
    }
  }

  :global(body.onboarding #screen-picker-backdrop .instructions) {
    bottom: 1rem !important;
  }
</style>
