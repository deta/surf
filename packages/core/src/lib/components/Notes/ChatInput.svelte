<script context="module" lang="ts">
  export type ChatInputState = 'bottom' | 'floaty'
</script>

<script lang="ts">
  import { derived, writable, type Readable } from 'svelte/store'
  import Input from './Atoms/Input/Input.svelte'
  import AppBarButton from '../Browser/AppBarButton.svelte'
  import { Icon } from '@horizon/icons'
  import PromptPills, { type PromptPillItem } from './Atoms/PromptPills.svelte'
  import type { ContextManager } from '../../service/ai/contextManager'
  import { BUILT_IN_PAGE_PROMPTS } from '../../constants/prompts'
  import { conditionalArrayItem, isMac, useLogScope } from '@horizon/utils'
  import { createEventDispatcher, tick } from 'svelte'
  import type { Editor, MentionItem } from '@horizon/editor'
  import type { ChatPrompt } from '../../service/ai/ai'
  import { useConfig } from '../../service/config'
  import { useTabsManager } from '../../service/tabs'
  import NoteInputSavedPrompts from './NoteInputSavedPrompts.svelte'
  import NoteContextBubbles from './NoteContextBubbles.svelte'
  import { isGeneratingAI } from '@horizon/core/src/lib/service/ai/generationState'
  import { startingClass } from '../../utils/dom'
  import Tooltip from '../Atoms/Tooltip.svelte'
  import type { MentionItemsFetcher } from '@horizon/editor/src/lib/extensions/Mention/suggestion'

  const log = useLogScope('ChatInput')
  const dispatch = createEventDispatcher<{
    submit: null | { query: string; mentions: MentionItem[] }
    'cancel-completion': void
    'run-prompt': { prompt: ChatPrompt; custom: boolean }
    autocomplete: void
  }>()

  export let state: ChatInputState = 'floaty'
  export let firstLine: boolean = false
  export let disabled: boolean = false
  export let editor: Editor | undefined = undefined

  // TODO: THis should use svelte getContext() api instead
  export let contextManager: ContextManager

  // TODO: THis should use svelte getContext() api instead
  export let mentionItemsFetcher: MentionItemsFetcher | undefined = undefined

  export let focus = () => editor?.focus()

  const config = useConfig()
  const tabsManager = useTabsManager()

  const userConfigSettings = config.settings
  const activeTabId = tabsManager.activeTabId
  const { generatingPrompts, generatedPrompts, tabsInContext } = contextManager

  const savedPromptsDialogOpen = writable(false)
  const contextManagementDialogOpen = writable(false)

  const inputValue = writable('')
  const isEditorEmpty = writable(false)

  // TODO: Can we not manually track responses here but give suggested prompts from service
  // directly & cleaned up already?
  const responses = writable<unknown[]>([])

  $: activeState = $isGeneratingAI ? 'bottom' : state
  $: if (activeState) savedPromptsDialogOpen.set(false)
  $: if (activeState) contextManagementDialogOpen.set(false)

  let focusInput: () => void

  // ==== Suggested Prompts

  const usedPrompts = writable<PromptPillItem[]>([])

  const showExamplePrompts = derived(
    [tabsInContext, activeTabId, userConfigSettings],
    ([tabsInContext, activeTabId, userConfigSettings]) => {
      if (!userConfigSettings.automatic_chat_prompt_generation) {
        return false
      }

      const tab = tabsInContext.find((tab) => tab.id === activeTabId)

      if (!tab || tab.type !== 'page') {
        return false
      }

      return true
    }
  )

  const filteredExamplePrompts = derived(
    [generatedPrompts, responses, activeTabId],
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
            label: 'Anaylzing Page',
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

  const handleClickPrompt = (e: CustomEvent<PromptPillItem>) => {
    usedPrompts.update((v) => {
      v.push(e.detail)
      return v
    })
    dispatch('run-prompt', { prompt: e.detail as ChatPrompt, custom: true })
  }

  const handleSubmit = () => {
    log.debug('Handling submit', $inputValue, { firstLine })

    if ($isGeneratingAI) dispatch('cancel-completion')
    if (!$inputValue && firstLine) {
      dispatch('submit', null)
      return
    }
    if (!$inputValue) return

    if (!editor) {
      dispatch('submit', null)
      return
    }

    const mentions: MentionItem[] = editor.getMentions()
    dispatch('submit', { query: $inputValue, mentions })

    inputValue.set('')
    editor?.clear()
    //editor.clear()
    tick().then(() => {
      focus()
    })
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

<!--
{#if disabled}
  <div class="inline-controls" use:startingClass={{}}>
    <Tooltip side="bottom">
      <AppBarButton class="-mr-1.5" on:click={handleSubmit}>
        <Icon name={$isGeneratingAI ? 'spinner' : 'cursor'} size="1.15rem" />
      </AppBarButton>
      <svelte:fragment slot="content"
        >{$isGeneratingAI ? 'Stop completion' : 'Send Message'}</svelte:fragment
      >
    </Tooltip>
    <!--<div>
      <NoteInputSavedPrompts
        {contextManager}
        promptSelectorOpen={savedPromptsDialogOpen}
        direction={'top'}
        on:run-prompt
      >
        <AppBarButton active={$savedPromptsDialogOpen}>
          <Icon name="dots.vertical" size="1rem" />
        </AppBarButton>
      </NoteInputSavedPrompts>
           <NoteContextBubbles {contextManager} pickerOpen={contextManagementDialogOpen} />
    </div>
  </div>
{/if}-->

<div
  class="note-chat-input {activeState}"
  use:startingClass={{}}
  class:firstLine
  class:focusOutside={disabled}
>
  <header>
    <PromptPills
      promptItems={$suggestedPrompts}
      hide={$isEditorEmpty || !$showExamplePrompts || $contextManagementDialogOpen}
      direction={activeState === 'bottom' ? 'horizontal' : 'vertical'}
      on:click={handleClickPrompt}
    />
    {#key activeState}
      <div
        class="context-controls {activeState}"
        use:startingClass={{}}
        class:open-context-picker={$contextManagementDialogOpen}
      >
        <div>
          {#if !$contextManagementDialogOpen}
            {#if $userConfigSettings.enable_custom_prompts}
              <NoteInputSavedPrompts
                {contextManager}
                promptSelectorOpen={savedPromptsDialogOpen}
                direction={activeState === 'bottom' ? 'top' : 'right'}
                on:run-prompt
              >
                <AppBarButton active={$savedPromptsDialogOpen}>
                  <Icon name="chat.square.heart" size="1rem" />
                </AppBarButton>
              </NoteInputSavedPrompts>
            {/if}
            <NoteContextBubbles
              {contextManager}
              pickerOpen={contextManagementDialogOpen}
              layout={activeState}
              {firstLine}
            />
          {:else}
            <NoteContextBubbles
              {contextManager}
              pickerOpen={contextManagementDialogOpen}
              layout={activeState}
              {firstLine}
            />
          {/if}
        </div>
      </div>
    {/key}
  </header>
  <Input
    bind:editor
    value={inputValue}
    isEmpty={isEditorEmpty}
    active={$contextManagementDialogOpen}
    placeholder={writable('Ask me anything…')}
    bind:focusInput
    submitOnEnter
    parseMentions
    hide={firstLine && activeState !== 'bottom'}
    {mentionItemsFetcher}
    on:submit={handleSubmit}
    on:blur
  >
    {#if !disabled}
      <div class="submit-btn" use:startingClass={{}}>
        {#if firstLine}
          <span class="submit-hint">{isMac() ? 'CMD' : 'Ctrl'} + ⮐</span>
        {/if}
        <Tooltip side="left">
          <AppBarButton class="-mr-1.5" on:click={handleSubmit} muted={false}>
            <Icon name={$isGeneratingAI ? 'spinner' : 'cursor'} size="1.15rem" />
          </AppBarButton>
          <svelte:fragment slot="content"
            >{$isGeneratingAI ? 'Stop completion' : 'Send Message'}</svelte:fragment
          >
        </Tooltip>
      </div>
    {/if}
  </Input>
</div>

<style lang="scss">
  :global(.browser-content .editor-spacer) {
    height: 60px !important;
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

    &.floaty {
      transition-property: top, left, right, padding;

      position-anchor: --editor-last-line;
      top: calc(anchor(--editor-last-line top) + 1rem);
      left: calc(anchor(--editor-last-line start) - 0.6rem);
      right: calc(anchor(--editor-last-line end) - 0.6rem);
      bottom: unset;

      &.firstLine {
        header {
          margin-top: -1.75rem;
        }
        :global(.input-container .submit-btn) {
          margin-top: -3.3rem;
        }

        position-anchor: --editor-active-line;
        top: calc(anchor(--editor-active-line end) + 1rem);
        left: calc(anchor(--editor-active-line start) - 0.6rem);
        right: calc(anchor(--editor-active-line end) - 0.6rem);
      }

      header {
        display: flex;
        justify-content: space-between;
        align-items: start;
        gap: 0.75rem;
        order: 2;
        padding-top: 0.75rem;
      }
    }

    &.bottom {
      transition-property: top, left, right, padding;
      bottom: 0;
      left: 0;
      right: 0;
      top: unset;
      padding-bottom: 1rem;
      padding-inline: 1.5rem;

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
      transition-property: opacity;
      transition-duration: 200ms;
      transition-delay: 123ms;
      transition-timing-function: ease-out;
      &:global(._starting) {
        opacity: 0;
      }

      opacity: 1;

      display: flex;
      align-items: center;
      gap: 0.25rem;
      pointer-events: all;

      .submit-hint {
        font-size: 0.65rem;
        font-weight: 500;
        color: light-dark(rgba(0, 0, 0, 0.3), rgba(255, 255, 255, 0.3));
        padding: 1.5px 8px;
        background: light-dark(rgba(0, 0, 0, 0.04), rgba(255, 255, 255, 0.04));
        border-radius: 1rem;
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
      top: -1.75rem;
      bottom: -2rem;
      left: -100vw;
      right: -100vw;

      visibility: hidden;

      background: linear-gradient(
        0deg,
        light-dark(#fff, rgb(24, 24, 24)) 80%,
        light-dark(rgba(255, 255, 255, 0), rgba(24, 24, 24, 0)) 100%
      );
      backdrop-filter: blur(1px);
    }
    &:has(> header)::before {
      top: -2rem;
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
