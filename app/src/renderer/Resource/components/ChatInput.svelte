<script context="module" lang="ts">
  export type ChatInputState = 'bottom' | 'floaty'
</script>

<script lang="ts">
  import { get, derived, type Writable, writable, type Readable } from 'svelte/store'
  import Input from './Input.svelte'
  import { Icon } from '@deta/icons'
  import PromptPills, { type PromptPillItem } from './PromptPills.svelte'
  import type { ContextManager } from '@deta/services/ai'
  import { BUILT_IN_PAGE_PROMPTS } from '@deta/services/constants'
  import { conditionalArrayItem, useLogScope } from '@deta/utils'
  import { createEventDispatcher, tick } from 'svelte'
  import { elementFromString, type Editor, type MentionItem } from '@deta/editor'
  import type { ChatPrompt } from '@deta/services/ai'
  import { useConfig } from '@deta/services'
  import { startingClass } from '@deta/utils/dom'
  import type { MentionItemsFetcher } from '@deta/editor/src/lib/extensions/Mention/suggestion'
  import { AddToContextMenu, Dropdown, ModelPicker } from '@deta/ui'
  import type { AIChatStatusMessage, AITool } from '@deta/types'

  const log = useLogScope('ChatInput')
  const dispatch = createEventDispatcher<{
    submit: null | { query: string; mentions: MentionItem[] }
    'cancel-completion': void
    'run-prompt': { prompt: ChatPrompt; custom: boolean }
    autocomplete: void
  }>()

  export let editor: Editor | undefined = undefined
  export let hideEmptyPrompts: boolean = false

  // TODO: THis should use svelte getContext() api instead
  export let contextManager: ContextManager

  // TODO: THis should use svelte getContext() api instead
  export let mentionItemsFetcher: MentionItemsFetcher | undefined = undefined

  export let tools: Writable<AITool[]>

  export let focus = () => editor?.focus()

  export let onFileSelect: () => void
  export let onMentionSelect: () => void

  const config = useConfig()

  const userConfigSettings = config.settings
  const { generatingPrompts, generatedPrompts } = contextManager

  const contextManagementDialogOpen = writable(false)

  const inputValue = writable('')
  $: isEditorEmpty = editor ? get(editor.isEmpty) : true

  // TODO: Can we not manually track responses here but give suggested prompts from service
  // directly & cleaned up already?
  const responses = writable<unknown[]>([])

  const statusMessage = writable<AIChatStatusMessage | null>(null)

  // Derived store for loading state
  const isLoading = derived(statusMessage, ($statusMessage) => {
    return $statusMessage !== null && $statusMessage.type !== 'error'
  })

  let focusInput: () => void
  let chatInputElement: HTMLElement
  let tempContent: string = ''

  // ==== Status Message Management

  export const showStatus = (message: AIChatStatusMessage) => {
    statusMessage.set(message)

    if (message.type === 'error') {
      setContent(tempContent, true)
    }
  }

  export const dismissStatus = () => {
    statusMessage.set(null)
    clearEditor()
  }

  export const clearEditor = () => {
    setContent('', true)
    inputValue.set('')
    editor?.clear()
  }

  // ==== Suggested Prompts

  const usedPrompts = writable<PromptPillItem[]>([])

  $: showExamplePrompts = !(
    hideEmptyPrompts &&
    $generatedPrompts.length === 0 &&
    !$generatingPrompts
  )

  const filteredExamplePrompts = derived(
    [generatedPrompts, responses],
    ([$generatedPrompts, $responses]) => {
      return $generatedPrompts.filter((prompt) => {
        return (
          !$responses.find(
            (response) => response.query === prompt.prompt || response.query === prompt.label
          ) &&
          BUILT_IN_PAGE_PROMPTS.find(
            (p) => p.label.toLowerCase() === prompt.label.toLowerCase()
          ) === undefined
        )
      })
    }
  )

  const filteredBuiltInPrompts = derived([responses], ([$responses]) => {
    return BUILT_IN_PAGE_PROMPTS.filter((prompt) => {
      return !$responses.find(
        (response) =>
          response.query.replace(/[^a-zA-Z0-9]/g, '') ===
            prompt.prompt.replace(/[^a-zA-Z0-9]/g, '') ||
          response.query.replace(/[^a-zA-Z0-9]/g, '') === prompt.label.replace(/[^a-zA-Z0-9]/g, '')
      )
    })
  })

  const suggestedPrompts: Readable<PromptPillItem[]> = derived(
    [generatingPrompts, filteredBuiltInPrompts, filteredExamplePrompts, usedPrompts],
    ([$generatingPrompts, $filteredBuiltInPrompts, $filteredExamplePrompts, $usedPrompts]) => {
      return (
        [
          ...$filteredBuiltInPrompts,
          ...conditionalArrayItem($generatingPrompts, {
            label: 'Analyzing Page',
            prompt: '',
            loading: true
          }),
          ...conditionalArrayItem(!$generatingPrompts, $filteredExamplePrompts)
        ]
          .sort((a, b) => (a.label?.length ?? 0) - (b.label?.length ?? 0))
          // NOTE: Disabled filter until we can properly extract used from chat message again
          //.filter(
          //  (prompt) =>
          //    $usedPrompts.find(
          //      (e) =>
          //        e.label?.replace(/[^a-zA-Z0-9]/g, '') === prompt.label?.replace(/[^a-zA-Z0-9]/g, '')
          //    ) === undefined
          //)
          .slice(0, 4)
      )
    }
  )

  const toolsDropdownItems = derived(tools, ($tools) => {
    if (!$tools) return []

    return $tools.map((tool) => ({
      id: tool.id,
      label: tool.name,
      icon: tool.icon,
      disabled: tool.disabled,
      disabledLabel: tool.disabled ? 'coming soon!' : undefined,
      checked: tool.active,
      type: 'checkbox',
      action: () => {
        log.debug('Toggling tool:', tool.id)
        tool.active = !tool.active
        tools.update((all) => {
          const index = all.findIndex((t) => t.id === tool.id)
          if (index !== -1) {
            all[index] = tool
          }
          return all
        })
      }
    }))
  })

  const handleClickPrompt = (e: CustomEvent<PromptPillItem>) => {
    if ($isLoading) return // Prevent prompt clicks while loading

    usedPrompts.update((v) => {
      v.push(e.detail)
      return v
    })
    dispatch('run-prompt', { prompt: e.detail as ChatPrompt, custom: true })
  }

  const handleSubmit = () => {
    if ($isLoading) return

    const currentContent = $inputValue
    const trimmedContent = currentContent.trim()

    log.debug('Handling submit', currentContent)
    if (!trimmedContent) {
      log.debug('Empty content, not submitting')
      return
    }
    if (!editor) {
      log.debug('No editor, not submitting')
      return
    }

    tempContent = currentContent

    const mentions: MentionItem[] = editor.getMentions()
    dispatch('submit', { query: currentContent, mentions })
    tick().then(() => {
      focus()
      clearEditor()
    })
  }

  const handleCancel = () => {
    if (!$isLoading) return
    dispatch('cancel-completion')
  }

  export const setContent = (content: string, focus = false) => {
    if (!editor) {
      log.warn('Editor not initialized, cannot set content')
      return
    }

    const actualEditor = editor.getEditor()

    log.debug('Setting content', content, { focus, oldInputValue: $inputValue })
    actualEditor.commands.setContent(content)
    inputValue.set(content)

    if (focus) {
      actualEditor.commands.focus('end')
    }
  }
</script>

<div
  bind:this={chatInputElement}
  class="note-chat-input bottom"
  class:loading={$isLoading}
  use:startingClass={{}}
>
  <div style="margin: 0 auto;width:100%;max-width: 740px;">
    {#if $statusMessage}
      <div class="status-message" class:error={$statusMessage.type === 'error'}>
        <div class="status-content">
          {#if $statusMessage.type === 'error'}
            <Icon name="exclamation.circle" size="1.15rem" />
            <span>{$statusMessage.value}</span>
          {:else}
            <Icon name="plane.loader" size="1.15rem" />
            <span class="status-text">{$statusMessage.value}</span>
          {/if}
        </div>
        {#if $statusMessage.type === 'error'}
          <button class="dismiss-button" on:click={dismissStatus} aria-label="Dismiss">
            <Icon name="close" size="0.75rem" />
          </button>
        {/if}
      </div>
    {:else if !(!isEditorEmpty || !showExamplePrompts || $contextManagementDialogOpen) && editor?.focused}
      <div class="prompts">
        <PromptPills
          promptItems={$suggestedPrompts}
          hide={!isEditorEmpty ||
            !showExamplePrompts ||
            $contextManagementDialogOpen ||
            !editor?.focused}
          direction={'horizontal'}
          on:click={handleClickPrompt}
        />
      </div>
    {/if}
    <Input
      bind:editor
      value={inputValue}
      active={$contextManagementDialogOpen}
      placeholder={writable($isLoading ? 'Answering...' : 'Ask me anything…')}
      bind:focusInput
      submitOnEnter
      parseMentions
      {mentionItemsFetcher}
      disabled={$isLoading}
      on:submit={handleSubmit}
      on:blur
    />
    <header>
      <div
        class="context-controls bottom"
        use:startingClass={{}}
        class:open-context-picker={$contextManagementDialogOpen}
      >
        <div>
          <AddToContextMenu {onFileSelect} {onMentionSelect} align="end" disabled={$isLoading} />
          <Dropdown
            items={$toolsDropdownItems}
            triggerText="Tools"
            triggerIcon="bolt"
            align="end"
            disabled={$isLoading}
          />
          <ModelPicker align="end" />
          <div>
            <button
              class="submit-btn -mr-1.5"
              on:click={$isLoading ? handleCancel : handleSubmit}
              disabled={isEditorEmpty && !$isLoading}
            >
              {#if $isLoading}
                <span class="loading-icon">
                  <Icon name="spinner" fill="var(--accent)" size="1rem" class="loading-icon" />
                </span>
                <span class="stop-icon">
                  <Icon name="spinner.stop" size="1rem" />
                </span>
              {:else}
                <Icon name="cursor" size="14" />
                <span>Ask</span>
              {/if}
            </button>
          </div>
        </div>
      </div>
    </header>
  </div>
</div>

<style lang="scss">
  :global(.browser-content .editor-spacer) {
    height: 60px !important;
  }

  .prompts {
    margin-bottom: 16px;
  }

  .status-message {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.3rem;
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.5rem;
    border-radius: 0.75rem;
    font-size: 0.95rem;
    animation: slideIn 234ms ease-out;

    --background: light-dark(rgba(255, 255, 255), rgba(15, 23, 42));
    background: var(--background);
    color: light-dark(rgb(37, 99, 235), rgb(147, 197, 253));
    backdrop-filter: blur(12px);

    border: 1px solid color-mix(in srgb, var(--background), transparent 50%);

    &.error {
      --background: light-dark(rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.15));
      color: light-dark(rgb(220, 38, 38), rgb(252, 165, 165));
    }

    .status-content {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex: 1;
    }

    $total-duration: 40s;
    $speed-multiplier: 20;
    $hump-spacing: 10%;
    $idle-delay: 20s;

    .status-text {
      font-family: var(--default);
      font-weight: var(--medium);
      font-size: 0.9rem;

      --status-shimmer: light-dark(#aae5ff, rgba(147, 197, 253, 0.65));
      --status-base: light-dark(#399bf1, var(--accent-dark, #8192ff));

      background: linear-gradient(
          90deg,
          transparent 0%,
          transparent 40%,
          var(--status-shimmer) 45%,
          45%,
          transparent 50%,
          transparent 100%
        ),
        linear-gradient(
          90deg,
          transparent 0%,
          transparent 40%,
          light-dark(#ffffff, rgba(226, 232, 240, 0.7)) 45%,
          transparent 50%,
          transparent 100%
        ),
        linear-gradient(
          90deg,
          transparent 0%,
          transparent 40%,
          var(--status-shimmer) 45%,
          transparent 50%,
          transparent 100%
        ),
        linear-gradient(
          90deg,
          transparent 0%,
          transparent 40%,
          var(--status-shimmer) 45%,
          transparent 50%,
          transparent 100%
        ),
        linear-gradient(
          90deg,
          transparent 0%,
          transparent 40%,
          var(--status-shimmer) 45%,
          transparent 50%,
          transparent 100%
        ),
        linear-gradient(
          90deg,
          transparent 0%,
          transparent 40%,
          var(--accent) 45%,
          transparent 50%,
          transparent 100%
        ),
        var(--status-base);
      background-size:
        200% 100%,
        200% 100%,
        200% 100%,
        200% 100%,
        200% 100%,
        200% 100%,
        100% 100%;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: multiSlide #{$total-duration + $idle-delay} infinite linear;
    }

    .dismiss-button,
    .cancel-button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border: none;
      background: transparent;
      border-radius: 4px;
      cursor: pointer;
      color: inherit;
      opacity: 0.7;
      transition:
        opacity 0.15s ease,
        background-color 0.15s ease;

      &:hover {
        opacity: 1;
        background: light-dark(rgba(0, 0, 0, 0.075), rgba(255, 255, 255, 0.1));
      }
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes multiSlide {
      $animation-percent: percentage($total-duration / ($total-duration + $idle-delay));
      $idle-percent: percentage($idle-delay / ($total-duration + $idle-delay));

      0% {
        background-position:
          #{300% + (0 * $hump-spacing)} 0,
          #{300% + (1 * $hump-spacing)} 0,
          #{300% + (2 * $hump-spacing)} 0,
          #{300% + (3 * $hump-spacing)} 0,
          #{300% + (4 * $hump-spacing)} 0,
          #{300% + (5 * $hump-spacing)} 0,
          0 0;
      }

      #{$animation-percent} {
        background-position:
          #{-300% * $speed-multiplier} 0,
          #{-300% * $speed-multiplier} 0,
          #{-300% * $speed-multiplier} 0,
          #{-300% * $speed-multiplier} 0,
          #{-300% * $speed-multiplier} 0,
          #{-300% * $speed-multiplier} 0,
          0 0;
      }

      100% {
        background-position:
          #{-300% * $speed-multiplier} 0,
          #{-300% * $speed-multiplier} 0,
          #{-300% * $speed-multiplier} 0,
          #{-300% * $speed-multiplier} 0,
          #{-300% * $speed-multiplier} 0,
          #{-300% * $speed-multiplier} 0,
          0 0;
      }
    }
  }

  .note-chat-input {
    transition-property: top, left, right, padding, opacity, filter;
    transition-duration: 234ms;
    transition-timing-function: ease-out;
    //transition-behavior: allow-discrete;
    //interpolate-size: allow-keywords;

    isolation: isolate;
    position: absolute;
    z-index: 9000;

    display: flex;
    flex-direction: column;

    position-anchor: --editor-last-line;
    top: calc(anchor(--editor-last-line top) + 1rem);

    &.disabled:not(:hover) {
      opacity: 0.75;
      filter: grayscale(100%);
    }

    &:global(._starting) {
      transition-delay: 200ms;
      opacity: 0 !important;
    }

    &.bottom {
      --chat-input-max-width: 800px;
      --chat-input-half-width: calc(var(--chat-input-max-width) / 2);
      --chat-input-padding: 1.75rem;

      transition-property: top, left, right, padding;
      bottom: 0;
      //left: calc(50% - 780px / 2);
      //right: calc(50% - 780px / 2);

      left: 0;
      right: 0;

      /*
      background:
        radial-gradient(
          ellipse 400px 60px at 50% 100%,
          rgba(40, 87, 247, 0.15) 0%,
          transparent 70%
        ),
        radial-gradient(
          ellipse 300px 45px at 50% 100%,
          rgba(40, 87, 247, 0.12) 0%,
          transparent 80%
        ),
        radial-gradient(ellipse 200px 30px at 50% 100%, rgba(40, 87, 247, 0.08) 0%, transparent 90%);
      background-size: 100% 100%;
      background-repeat: no-repeat;
      background-position: center bottom;
      */

      //@media screen and (min-width: 810px) {
      //  left: var(--chat-input-padding) !important;
      //  right: 50rem !important;
      //  padding-inline: 0;
      //}

      top: unset;
      padding-bottom: 2.5rem;
      padding-inline: var(--chat-input-padding);
      //padding-inline: var(--chat-input-padding);
      width: 100%;
      //max-width: var(--chat-input-max-width);

      :global(.browser-content) & {
        left: calc(anchor(--editor-last-line start) - 2rem);
        right: calc(anchor(--editor-last-line end) - 2rem);
      }

      &::before {
        visibility: visible;
      }

      header {
        position: relative;
        .context-controls {
          position: absolute;
          top: 0rem;
          bottom: 0.25rem;
          right: 0;

          &.open-context-picker {
            width: 100%;
          }

          &::before {
            content: '';
            background: linear-gradient(
              to right,
              light-dark(rgba(255, 255, 255, 0), rgba(24, 24, 24, 0)) 0%,
              light-dark(#fff, rgb(24, 24, 24)) 25%
            );
            pointer-events: none;
            position: absolute;
            inset: 0;
            left: -2rem;
            bottom: 0.5rem;
          }
        }
      }
    }

    .submit-btn {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 0.25rem 0.5rem;
      gap: 0.25rem;
      cursor: pointer;
      border-radius: 9px;
      background: transparent;
      color: light-dark(#6d82ff, var(--accent-dark, #8192ff));
      font-size: 13px;
      cursor: pointer;
      border: none;
      outline: none;
      opacity: 1;
      transition:
        background-color 150ms ease-out,
        opacity 150ms ease-out;

      &:hover:not(:disabled) {
        background: light-dark(#f3f5ff, var(--accent-background-dark, #1e2639));
      }

      &:disabled {
        color: light-dark(#808794, var(--on-surface-muted-dark, #94a3b8));
        opacity: 0.4;
        cursor: not-allowed !important;
      }

      .stop-icon {
        display: none;
      }

      &:hover {
        .loading-icon {
          display: none !important;
        }
        .stop-icon {
          display: inline;
        }
      }
    }

    .context-controls {
      transition-property: opacity;
      transition-duration: 187ms;
      transition-delay: 75ms;
      transition-timing-function: ease-out;

      isolation: isolate;
      padding-right: 0.3rem;

      &.bottom {
        padding-top: 3px;
      }
      &:global(._starting) {
        opacity: 0;
      }

      > div {
        transition-property: transform;
        transition-duration: 234ms;
        transition-delay: 250ms;
        transition-timing-function: ease-out;

        display: flex;
        align-items: start;
        gap: 0.75rem;
      }

      opacity: 1;
    }

    // Background blur
    &::before {
      transition-property: top;
      transition-duration: 134ms;
      transition-timing-function: ease-out;

      content: '';
      pointer-events: none;
      position: absolute;
      z-index: -20;

      inset: 0;
      top: -2.5rem;
      bottom: -2rem;
      left: -100vw;
      right: -100vw;

      //visibility: hidden;
      background: linear-gradient(
        to top,
        light-dark(#fff, rgb(24, 24, 24)) 80%,
        light-dark(rgba(255, 255, 255, 0), rgba(24, 24, 24, 0)) 100%
      );
      backdrop-filter: blur(2px);
      mask: linear-gradient(to top, rgba(0, 0, 0, 1) 75%, rgba(0, 0, 0, 0)) 100%;
    }
    &:has(> .prompts)::before,
    &:has(> .status-message)::before {
      top: -4rem;
    }
  }

  .inline-controls {
    transition-property: top, right, opacity, transform;
    transition-duration: 75ms;
    transition-timing-function: ease-out;

    isolation: isolate;
    position: absolute;
    z-index: 90000;

    display: flex;
    align-items: center;
    gap: 0.5rem;

    position-anchor: --editor-active-line;

    top: anchor(--editor-active-line top);
    right: anchor(--editor-active-line right);
    right: 0.5rem;

    &:global(._starting) {
      opacity: 0;
      transform: translateX(4px);
    }

    opacity: 1;
    transform: none;

    > div {
      display: flex;
      align-items: center;
      transform: translateY(2.5px);
    }
  }
</style>
