<script lang="ts">
  import { useLogScope } from '@horizon/utils'
  import { DragculaDragEvent, HTMLDragZone } from '@horizon/dragcula'
  import { type MentionItem } from '@horizon/editor'

  import {
    EventContext,
    PageChatMessageSentEventTrigger,
    PageChatUpdateContextEventTrigger,
    PromptType
  } from '@horizon/types'

  import type { AIChatMessageRole } from '../../types/browser.types'
  import { DragTypeNames, type DragTypes } from '../../types'

  import { Resource, useResourceManager } from '../../service/resources'
  import { useToasts } from '../../service/toast'
  import { useAI, type ChatPrompt } from '@horizon/core/src/lib/service/ai/ai'

  import { BUILT_IN_PAGE_PROMPTS } from '../../constants/prompts'
  import TextResource from '@horizon/core/src/lib/components/Resources/Previews/Text/TextResource.svelte'
  import type { SmartNote } from '@horizon/core/src/lib/service/ai/note'
  import ChatControls from './ChatControls.svelte'
  import { useConfig } from '@horizon/core/src/lib/service/config'
  import { onMount } from 'svelte'

  export let note: SmartNote

  // TDOO: replace with new context store in AI service
  export let preparingTabs: boolean = false

  export let inputOnly = false
  export let showAddToContext = true

  const log = useLogScope('Chat')
  const resourceManager = useResourceManager()
  const toasts = useToasts()
  const ai = useAI()
  const config = useConfig()
  const smartNotes = ai.smartNotes

  const userConfigSettings = config.settings
  const telemetry = resourceManager.telemetry
  const activeNoteId = smartNotes.activeNoteId
  const contextManager = note.contextManager

  $: chat = note.chat

  let noteComp: TextResource

  export const updateChatInput = (text: string, focus = true) => {
    noteComp.replaceContent(text)
  }

  export const insertQueryIntoChat = async (query: string, target: 'note' | 'input' = 'note') => {
    if (!noteComp) return

    if (target === 'input') {
      noteComp.setChatInputContent(query, true)
    } else {
      noteComp.insertText(query, true)
    }
  }

  export const addChatWithQuery = async (query: string, replace = false) => {
    const value = '<blockquote>' + query + '</blockquote>' + '<p></p>'

    if (replace) {
      updateChatInput(value, true)
    } else {
      await insertQueryIntoChat(value)
    }
  }

  export const submitCurrentChatMessage = async () => {
    try {
      if (noteComp && typeof noteComp.submitChatMessage === 'function') {
        return await noteComp.submitChatMessage()
      }
      return false
    } catch (e) {
      log.error('Error submitting chat message', e)
      toasts.error('Error submitting chat message')
      return false
    }
  }

  export const createChatCompletion = async (
    query: string,
    systemPrompt?: string,
    mentions?: MentionItem[],
    trigger?: PageChatMessageSentEventTrigger
  ) => {
    try {
      await noteComp.generateAndInsertAIOutput(query, systemPrompt, mentions, trigger)
    } catch (e) {
      log.error('Error creating chat completion', e)
      toasts.error('Error creating chat completion')
    }
  }

  export const submitChatMessage = async (_selected?: 'general' | 'all' | 'active') => {
    await submitCurrentChatMessage()
  }

  const handleDrop = async (drag: DragculaDragEvent<DragTypes>) => {
    if (drag.isNative) {
      log.warn('Not yet implemented!')
    } else if (drag.item!.data.hasData(DragTypeNames.SURF_TAB)) {
      const tabId = drag.item!.data.getData(DragTypeNames.SURF_TAB).id
      contextManager.addTab(tabId, { trigger: PageChatUpdateContextEventTrigger.DragAndDrop })
    } else if (drag.item!.data.hasData(DragTypeNames.SURF_SPACE)) {
      const space = drag.item!.data.getData(DragTypeNames.SURF_SPACE)

      contextManager.addSpace(space, { trigger: PageChatUpdateContextEventTrigger.DragAndDrop })
    } else if (
      drag.item!.data.hasData(DragTypeNames.SURF_RESOURCE) ||
      drag.item!.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)
    ) {
      let resource: Resource | null = null
      if (drag.item!.data.hasData(DragTypeNames.SURF_RESOURCE)) {
        resource = drag.item!.data.getData(DragTypeNames.SURF_RESOURCE)
      } else if (drag.item!.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)) {
        const resourceFetcher = drag.item!.data.getData(DragTypeNames.ASYNC_SURF_RESOURCE)
        resource = await resourceFetcher()
      }

      if (resource === null) {
        log.warn('Dropped resource but resource is null! Aborting drop!')
        drag.abort()
        return
      }

      log.debug('dropped resource, adding to context', resource)

      contextManager.addResource(resource, {
        trigger: PageChatUpdateContextEventTrigger.DragAndDrop
      })
    }
  }

  let selectedMode: 'general' | 'all' | 'active' | 'context' = 'general'

  // const generateChatPrompts = useDebounce(async (contextItem: ContextItem) => {
  //   await tick()
  //   await chat.getChatPrompts(contextItem)
  // }, 500)

  const runPrompt = async (prompt: ChatPrompt, custom: boolean = false) => {
    try {
      log.debug('Handling prompt submit', prompt)
      selectedMode = 'active'

      let promptType = PromptType.BuiltIn
      if (custom) {
        promptType = PromptType.Custom
      } else {
        const builtIn = BUILT_IN_PAGE_PROMPTS.find((p) => p.prompt === prompt.prompt)
        promptType = builtIn ? PromptType.BuiltIn : PromptType.Generated
      }
      telemetry.trackUsePrompt(
        promptType,
        EventContext.Chat,
        prompt.label ? prompt.label.toLowerCase() : undefined
      )

      noteComp?.runPrompt(prompt, { focusEnd: true, autoScroll: true, showPrompt: true })
    } catch (e) {
      log.error('Error doing magic', e)
    }
  }

  const handleRunPrompt = (e: CustomEvent<{ prompt: ChatPrompt; custom: boolean }>) => {
    const { prompt, custom } = e.detail
    log.debug('Handling run prompt', prompt)
    runPrompt(prompt, custom)
  }

  const handleUpdateNoteTitle = async (e: CustomEvent<string>) => {
    const title = e.detail

    await note.updateTitle(title)
  }

  const handleSubmit = async (e: CustomEvent<{ query: string; mentions: MentionItem[] }>) => {
    try {
      const { query, mentions } = e.detail
      log.debug('Handling submit', query, mentions)

      if (note) {
        noteComp?.generateAndInsertAIOutput(
          query,
          undefined,
          mentions,
          PageChatMessageSentEventTrigger.NoteChatInput,
          { focusEnd: true, autoScroll: true, showPrompt: true }
        )
      }
    } catch (e) {
      log.error('Error doing magic', e)
    }
  }

  onMount(async () => {
    log.debug('Mounting chat', note.id)
    await contextManager.generatePrompts()
  })
</script>

<div
  class="flex flex-col h-full relative overflow-hidden chat-wrapper"
  id="magic-chat"
  use:HTMLDragZone.action={{
    accepts: (drag) => {
      if (drag.from?.id === 'magic-chat') return false
      if (
        drag.isNative ||
        drag.item?.data.hasData(DragTypeNames.SURF_TAB) ||
        drag.item?.data.hasData(DragTypeNames.SURF_RESOURCE) ||
        drag.item?.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE) ||
        drag.item?.data.hasData(DragTypeNames.SURF_SPACE)
      ) {
        return true
      }
      return false
    }
  }}
  on:Drop={handleDrop}
>
  <!-- {#if showAddPromptDialog}
    <div
      id="tool-dialog"
      class="absolute inset-0 z-50 flex items-end justify-start pb-[14rem] pl-8"
      style="background: rgba(0 0 0 / 0.2);"
      transition:fade={{ duration: 133, easing: quartOut }}
    >
      <CreateAiToolDialog
        bind:show={showAddPromptDialog}
        app={appModalContent}
        on:added={() => ($promptSelectorOpen = true)}
      />
    </div>
  {/if} -->

  {#if !inputOnly}
    <div id="chat-responses-{note.id}" class="flex flex-col overflow-auto h-full overflow-x-hidden">
      <TextResource
        bind:this={noteComp}
        resourceId={note.id}
        {note}
        hideContextSwitcher
        manualContextControl
        autoGenerateTitle
        autofocus={true}
        showTitle={false}
        on:highlightWebviewText
        on:seekToTimestamp
        on:update-title={handleUpdateNoteTitle}
      />
    </div>
  {/if}

  <!--
  <ChatControls
    chatId={note.id}
    active={note.id === $activeNoteId}
    contextManager={note.contextManager}
    showInput={$userConfigSettings.experimental_notes_chat_input}
    {preparingTabs}
    {showAddToContext}
    on:open-context-item
    on:process-context-item
    on:run-prompt={handleRunPrompt}
    on:submit={handleSubmit}
  />-->
</div>

<style lang="scss">
  :global(#magic-chat[data-drag-target]) {
    outline: 2px dashed gray;
    outline-offset: -2px;
  }

  /* Prevent copy button cuttof */
  .response-wrapper:hover {
    position: relative;
    z-index: 5;
  }

  .icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .query {
    flex: 1;
  }

  .empty {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 0.8rem;
    padding: 1rem;
    opacity: 0.75;
    transition: opacity 0.2s ease;

    .empty-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;

      h1 {
        font-size: 1.25rem;
        font-weight: 500;
      }
    }

    p {
      text-align: center;
    }
  }

  :global(.chat-message-content h2) {
    font-size: 1.4rem;
    margin-top: 1rem !important;
    margin-bottom: 0.5rem !important;
  }
</style>
