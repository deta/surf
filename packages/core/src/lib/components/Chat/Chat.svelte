<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte'
  import { writable } from 'svelte/store'

  import {
    htmlToMarkdown,
    tooltip,
    truncate,
    useClipboard,
    useLogScope,
    wait
  } from '@horizon/utils'
  import { Icon } from '@horizon/icons'
  import { DragculaDragEvent, HTMLDragItem, HTMLDragZone } from '@horizon/dragcula'
  import { Editor, getEditorContentText, MentionItemType, type MentionItem } from '@horizon/editor'
  import MarkdownRenderer from '@horizon/editor/src/lib/components/MarkdownRenderer.svelte'

  import {
    EventContext,
    PageChatMessageSentEventError,
    PageChatMessageSentEventTrigger,
    PageChatUpdateContextEventAction,
    PageChatUpdateContextEventTrigger,
    PromptType,
    ResourceTagsBuiltInKeys,
    ResourceTypes,
    SaveToOasisEventTrigger
  } from '@horizon/types'

  import type {
    AIChatMessageParsed,
    AIChatMessageRole,
    JumpToWebviewTimestampEvent,
    HighlightWebviewTextEvent
  } from '../../types/browser.types'
  import { DragTypeNames, SpaceEntryOrigin, type DragTypes } from '../../types'

  import { Resource, useResourceManager } from '../../service/resources'
  import { useToasts } from '../../service/toast'
  import { useTabsManager } from '../../service/tabs'
  import { useAI, type ChatPrompt } from '@horizon/core/src/lib/service/ai/ai'

  import ChatMessageMarkdown from './ChatMessageMarkdown.svelte'
  import { BUILT_IN_PAGE_PROMPTS } from '../../constants/prompts'
  import FileIcon from '../Resources/Previews/File/FileIcon.svelte'
  import { type ContextItem } from '@horizon/core/src/lib/service/ai/contextManager'
  import { openDialog } from '../Core/Dialog/Dialog.svelte'
  import { useOasis } from '@horizon/core/src/lib/service/oasis'
  import {
    convertChatOutputToNoteContent,
    populateRenderAndChunkIds
  } from '@horizon/core/src/lib/service/ai/helpers'
  import { MODEL_CLAUDE_MENTION, MODEL_GPT_MENTION } from '@horizon/core/src/lib/constants/chat'
  import { Provider } from '@horizon/types/src/ai.types'
  import TextResource from '@horizon/core/src/lib/components/Resources/Previews/Text/TextResource.svelte'
  import type { SmartNote } from '@horizon/core/src/lib/service/ai/note'
  import ChatControls from './ChatControls.svelte'

  export let note: SmartNote
  export let inputValue = ''

  // TDOO: replace with new context store in AI service
  export let contextItemErrors: string[] = []
  export let preparingTabs: boolean = false

  export let inputOnly = false
  export let showContextBar = true
  export let showAddToContext = true
  export let onSubmitChatHook: ((input: string) => void) | undefined = undefined

  const dispatch = createEventDispatcher<{
    highlightWebviewText: HighlightWebviewTextEvent
    seekToTimestamp: JumpToWebviewTimestampEvent
    'open-context-item': ContextItem
    'process-context-item': ContextItem
    'close-chat': void
    'pick-screenshot': void
    'clear-chat': void
    'clear-errors': void
    'open-onboarding': void
  }>()

  const log = useLogScope('Chat')
  const { copy, copied } = useClipboard()
  const resourceManager = useResourceManager()
  const toasts = useToasts()
  const tabsManager = useTabsManager()
  const oasis = useOasis()
  const ai = useAI()
  const smartNotes = ai.smartNotes

  const telemetry = resourceManager.telemetry
  const activeNoteId = smartNotes.activeNoteId
  const contextManager = note.contextManager
  const { tabsInContext } = contextManager

  $: responses = writable<AIChatMessageParsed[]>([])
  $: chat = note.chat
  $: error = note.chat?.error

  const savedChatResponses = writable<Record<string, string>>({})

  let editor: Editor
  let noteComp: TextResource
  let autoScrollChat = false
  let listElem: HTMLDivElement | null = null

  export const updateChatInput = (text: string, focus = true) => {
    noteComp.replaceContent(text)
  }

  export const insertQueryIntoChat = async (query: string) => {
    if (!noteComp) return
    console.log('xxx-insert')

    noteComp.insertText(query, true)
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

  const openModelSettings = () => {
    // window.api.openSettings('ai')
    window.api.openSettings()
  }

  const handleShowOnboarding = () => {
    dispatch('open-onboarding')
  }

  const saveResponseOutput = async (response: AIChatMessageParsed) => {
    log.debug('Saving chat response')

    const content = await convertChatOutputToNoteContent(response, { tabsManager, resourceManager })
    // let content = response.content
    // const element = document.getElementById(`chat-response-${response.id}`)
    // if (element) {
    //   content = element.innerHTML
    // }

    log.debug('Saving chat response', content)
    if (!content) {
      log.error('No content found for response', response)
      toasts.error('Failed to save response')
      return
    }

    const resource = await resourceManager.createResourceNote(
      content,
      {
        name: truncate(cleanQuery(response.query), 50)
      },
      undefined,
      EventContext.Chat
    )

    if (tabsManager.activeScopeIdValue) {
      await oasis.addResourcesToSpace(
        tabsManager.activeScopeIdValue,
        [resource.id],
        SpaceEntryOrigin.ManuallyAdded
      )
    }

    savedChatResponses.update((responses) => {
      responses[response.id] = resource.id
      return responses
    })

    const chatOutputResources = response.sources
      ? [...new Set(response.sources.map((source) => source.resource_id))]
      : []

    log.debug('Chat output resources', chatOutputResources)

    // make sure the resource used by the chat response doesn't get auto deleted
    if (chatOutputResources.length === 1) {
      const chatOutputResource = await resourceManager.getResource(chatOutputResources[0])
      log.debug('Chat output resource', chatOutputResource)
      if (chatOutputResource) {
        const isSilent =
          (chatOutputResource.tags ?? []).find((tag) => tag.name === ResourceTagsBuiltInKeys.SILENT)
            ?.value === 'true'
        const isHideInEverything =
          (chatOutputResource.tags ?? []).find(
            (tag) => tag.name === ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING
          )?.value === 'true'

        log.debug('isSilent', isSilent)
        if (isSilent) {
          log.debug('Removing silent tag from chat output resource')
          await resourceManager.deleteResourceTag(
            chatOutputResource.id,
            ResourceTagsBuiltInKeys.SILENT
          )
          if (!isHideInEverything) {
            await resourceManager.createResourceTag(
              chatOutputResource.id,
              ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING,
              'true'
            )
          }
        }
      }
    }

    await resourceManager.telemetry.trackSaveToOasis(
      ResourceTypes.DOCUMENT_SPACE_NOTE,
      SaveToOasisEventTrigger.Click,
      false,
      EventContext.Chat,
      'text'
    )

    log.debug('Saved response', resource)

    toasts.success('Saved to My Stuff!')
  }

  const openResponseResource = async (responseId: string) => {
    const resourceId = $savedChatResponses[responseId]
    if (!resourceId) {
      log.error('No resource found for response', responseId)
      toasts.error('No resource found for response')
      return
    }

    log.debug(tabsManager)

    await tabsManager.openResourceAsTab(resourceId, {
      active: true
    })

    log.debug('Opened saved response', resourceId)
  }

  const handleCitationClick = async (
    sourceId: string,
    answerText: string,
    message: AIChatMessageParsed,
    sourceUid?: string,
    preview?: boolean
  ) => {
    log.debug('Citation clicked', sourceId, message, sourceUid)
    const source = (message.sources ?? []).find((s) => s.id === sourceId)
    if (!source) return

    const resource = await resourceManager.getResource(source.resource_id)
    if (!resource) return

    // If the resource came from a tab directly we assume it was a page tab, otherwise it was a space tab
    const sourceTab = $tabsInContext.find((tab) =>
      tab.type === 'page' ? tab.chatResourceBookmark === resource.id : false
    )
    const sourceTabType = sourceTab?.type === 'page' ? 'page' : 'space'

    if (
      resource.type === ResourceTypes.PDF ||
      resource.type === ResourceTypes.LINK ||
      resource.type === ResourceTypes.ARTICLE ||
      resource.type.startsWith(ResourceTypes.POST)
    ) {
      if (
        resource.type === ResourceTypes.POST_YOUTUBE &&
        source.metadata?.timestamp !== undefined
      ) {
        const timestamp = source.metadata.timestamp
        dispatch('seekToTimestamp', {
          resourceId: resource.id,
          timestamp: timestamp,
          preview: preview ?? false
        })

        await telemetry.trackPageChatCitationClick('timestamp', sourceTabType)

        if (sourceTabType === 'space') {
          await telemetry.trackPageChatCitationClickResourceFromSpace('timestamp')
        }
      } else {
        dispatch('highlightWebviewText', {
          resourceId: resource.id,
          answerText: answerText,
          sourceUid: sourceUid,
          preview: preview ?? false
        })

        await telemetry.trackPageChatCitationClick('text', sourceTabType)

        if (sourceTabType === 'space') {
          await telemetry.trackPageChatCitationClickResourceFromSpace('text')
        }
      }
    }
  }

  const cleanEditorHTML = (raw: string) => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(raw, 'text/html')

    // filter out all mention nodes that are mentions models since these could trip up the LLM
    doc
      .querySelectorAll('span[data-type="mention"][data-mention-type="model"')
      .forEach((mention) => {
        mention.remove()
      })

    return doc.body.innerHTML
  }

  export const submitChatMessage = async (selected?: 'general' | 'all' | 'active') => {
    if (!inputValue) {
      log.debug('No input value')
      return
    }

    if (selected) {
      selectedMode = selected
    }

    const cleanHtml = cleanEditorHTML(inputValue)
    const markdownQuery = await htmlToMarkdown(cleanHtml)
    const chatQuery = markdownQuery.trim()
    autoScrollChat = true

    const contextItems = []

    try {
      const mentions = editor.getMentions()
      log.debug('Handling chat submit', chatQuery, mentions)
      const items = (mentions ?? []).filter((mention) => mention.type !== MentionItemType.MODEL)

      if (items.length > 0) {
        for await (const item of items) {
          const contextItem = await contextManager.addMentionItem(item, { visible: false })
          if (contextItem) {
            contextItems.push(contextItem)
          }
        }

        ai.telemetry.trackPageChatContextUpdate(
          PageChatUpdateContextEventAction.Add,
          contextManager.itemsValue.length,
          items.length,
          undefined,
          PageChatUpdateContextEventTrigger.EditorMention
        )
      }

      const modelMention = (mentions ?? [])
        .reverse()
        .find((mention) => mention.type === MentionItemType.MODEL)

      if (modelMention) {
        if (modelMention.id === MODEL_CLAUDE_MENTION.id) {
          chat?.selectProviderModel(Provider.Anthropic)
        } else if (modelMention.id === MODEL_GPT_MENTION.id) {
          chat?.selectProviderModel(Provider.OpenAI)
        } else {
          const modelId = modelMention.id.replace('model-', '')
          chat?.selectModel(modelId)
        }
      }

      inputValue = ''
      editor.clear()

      if (onSubmitChatHook !== undefined) {
        onSubmitChatHook(chatQuery)
      } else {
        await sendChatMessage(chatQuery)
      }
    } catch (e) {
      log.error('Error doing magic', e)
      const savedInputValue = await htmlToMarkdown(inputValue)
      updateChatInput(savedInputValue)
    } finally {
      try {
        log.debug(
          'chat complete, removing context items and resetting model',
          contextItems,
          chat?.selectedModelId
        )

        chat?.selectModel(null)

        for await (const contextItem of contextItems) {
          await contextManager.removeContextItem(contextItem.id)
        }
      } catch (e) {
        log.error('Error removing context items', e)
      }
    }
  }

  const handleChatSubmit = async () => {
    await submitChatMessage()
  }

  const rerunChatMessageWithoutScreenshot = async () => {
    const lastResponse = $responses[$responses.length - 1]
    if (!lastResponse) {
      log.error('No last response found')
      toasts.error('No last response found')
      return
    }

    const lastQuery = lastResponse.query
    const lastRole = lastResponse.role

    const { closeType: confirmed } = await openDialog({
      message:
        'Removing the screenshot will clear the chat and rerun the chat message without the screenshot in the context. \n\nAre you sure you want to proceed?',
      actions: [
        { title: 'Cancel', type: 'reset' },
        { title: 'OK', type: 'submit' }
      ]
    })

    if (!confirmed) {
      return
    }

    log.debug('Rerunning chat message without screenshot', lastQuery)

    // TODO: Implement handling for this
    // dispatch('new-chat-with-prompt', { query: lastQuery, role: lastRole, skipScreenshot: true })
  }

  // const scrollToBottom = () => {
  //   if (!autoScrollChat) return
  //   if (listElem) {
  //     listElem.scrollTop = listElem.scrollHeight
  //   }
  // }

  const handleListWheel = (e: WheelEvent) => {
    autoScrollChat = false
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

  // HACK: Right now the saved chat doesn't store the query we provide, it only stores the raw message content. For system messages we don't want to display our long prompts.
  const sanitizeQuery = (raw: string) => {
    const query = raw.toLowerCase()
    if (query.includes('summary')) {
      return 'Page Summary'
    } else if (query.includes('table of content')) {
      return 'Table of Contents'
    } else if (query.includes('translate')) {
      return 'Translate Page'
    } else {
      return raw
    }
  }

  const cleanQuery = (raw: string) => {
    return getEditorContentText(raw)
  }

  let selectedMode: 'general' | 'all' | 'active' | 'context' = 'general'

  // const generateChatPrompts = useDebounce(async (contextItem: ContextItem) => {
  //   await tick()
  //   await chat.getChatPrompts(contextItem)
  // }, 500)

  const runPrompt = async (prompt: ChatPrompt, custom: boolean = false) => {
    try {
      log.debug('Handling prompt submit', prompt)
      autoScrollChat = true
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

      if (note) {
        noteComp?.runPrompt(prompt)
      } else {
        await sendChatMessage(prompt.prompt, 'user', prompt.label)
      }
    } catch (e) {
      log.error('Error doing magic', e)
    }
  }

  const handleRunPrompt = (e: CustomEvent<{ prompt: ChatPrompt; custom: boolean }>) => {
    const { prompt, custom } = e.detail
    log.debug('Handling run prompt', prompt)
    runPrompt(prompt, custom)
  }

  const sendChatMessage = async (
    prompt: string,
    role: AIChatMessageRole = 'user',
    query?: string,
    skipScreenshot = false
  ) => {
    await chat?.sendMessageAndHandle(prompt, {
      trigger: PageChatMessageSentEventTrigger.SidebarChat,
      useContext: selectedMode !== 'general',
      role,
      query,
      skipScreenshot
    })
  }

  const handleUpdateNoteTitle = async (e: CustomEvent<string>) => {
    const title = e.detail

    await note.updateTitle(title)
  }
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
    <div
      id="chat-responses-{note.id}"
      class="flex flex-col overflow-auto h-full overflow-x-hidden"
      bind:this={listElem}
      on:wheel|passive={handleListWheel}
    >
      {#if note}
        <TextResource
          bind:this={noteComp}
          resourceId={note.id}
          {note}
          hideContextSwitcher
          manualContextControl
          autoGenerateTitle
          autofocus={false}
          showTitle={false}
          on:highlightWebviewText
          on:seekToTimestamp
          on:update-title={handleUpdateNoteTitle}
        />
      {:else if $responses.length > 0}
        {#each $responses as response, idx (response.id)}
          {#if response.status === 'success'}
            <div
              class="response-wrapper text-lg flex flex-col gap-2 rounded-xl px-12 py-8 pr-16 text-opacity-90 group relative"
            >
              <div class="flex items-end justify-end">
                <div
                  class="font-medium bg-gray-100 dark:bg-gray-800 border-sky-200 dark:border-gray-800 text-gray-900 dark:text-gray-50 border-1 py-3 px-5 pl-3 pr-6 rounded-2xl w-fit"
                >
                  <div class="flex items-start gap-2.5">
                    <div class="icon bg-white dark:bg-gray-700 rounded-full p-1.5">
                      <Icon name="message" size="1em" />
                    </div>

                    <div class="query">
                      {#if response.role === 'user'}
                        <MarkdownRenderer content={response.query} id={response.id} />
                      {:else}
                        {sanitizeQuery(response.query)}
                      {/if}
                    </div>
                  </div>
                </div>
              </div>

              <ChatMessageMarkdown
                id={`chat-response-${response.id}`}
                content={response.content}
                sources={populateRenderAndChunkIds(response.sources)}
                on:citationClick={(e) =>
                  handleCitationClick(
                    e.detail.citationID,
                    e.detail.text,
                    response,
                    e.detail.sourceUid,
                    e.detail.preview
                  )}
                on:removeScreenshot={() => rerunChatMessageWithoutScreenshot()}
                showSourcesAtEnd={true}
                usedPageScreenshot={response.usedPageScreenshot}
                usedInlineScreenshot={response.usedInlineScreenshot}
              />

              <div
                class="flex flex-row items-center mx-auto space-x-2 relative text-sm transition-all duration-300 ease-in-out"
              >
                {#if $savedChatResponses[response.id]}
                  <button
                    on:click={() => openResponseResource(response.id)}
                    use:tooltip={{
                      text: 'Open as tab',
                      position: 'left'
                    }}
                    class="transform active:scale-95 appearance-none border-[0.5px] border-gray-500/50 group margin-0 flex items-center gap-2 py-2 px-3 bg-white dark:bg-gray-800 hover:bg-sky-100 dark:hover:bg-gray-800/50 transition-colors duration-200 rounded-xl text-sky-800 dark:text-gray-100"
                  >
                    <Icon name="check" />
                    Saved
                  </button>
                {:else}
                  <button
                    on:click={() => saveResponseOutput(response)}
                    use:tooltip={{
                      text: 'Save to My Stuff',
                      position: 'left'
                    }}
                    class="transform active:scale-95 appearance-none border-[0.5px] group margin-0 flex items-center gap-2 py-2 px-3 bg-white dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-gray-800/50 transition-colors duration-200 rounded-xl text-sky-800 dark:text-gray-100"
                  >
                    <Icon name="save" />
                    Save as Note
                  </button>
                {/if}

                <button
                  draggable={true}
                  use:HTMLDragItem.action={{}}
                  on:DragStart={(drag) => {
                    drag.dataTransfer.setData('text/html', response.content)
                    drag.item.data.setData('text/plain', response.content)
                    drag.continue()
                  }}
                  on:click={() => copy(response.content)}
                  use:tooltip={{
                    text: 'Copy to Clipboard',
                    position: 'left'
                  }}
                  class="transform active:scale-95 appearance-none border-[0.5px] group margin-0 flex items-center py-2.5 px-2.5 bg-white dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-gray-800/50 transition-colors duration-200 rounded-xl text-sky-800 dark:text-gray-100"
                >
                  {#if $copied}
                    <Icon name="check" size="16px" />
                  {:else}
                    <Icon name="copy" size="16px" />
                  {/if}
                </button>
              </div>
            </div>
          {:else if response.status === 'pending'}
            <div class="text-lg flex flex-col gap-2 rounded-xl p-4 text-opacity-90 group relative">
              <div class="">
                <div
                  class="font-medium bg-sky-100 dark:bg-gray-800 border-sky-200 dark:border-gray-800 border-1 p-3 rounded-xl w-fit mb-2 text-gray-900 dark:text-gray-100"
                >
                  <div class="flex items-start gap-2.5">
                    <div class="icon mt-0.5 rounded-full p-1">
                      <Icon name="spinner" size="1.1em" />
                    </div>

                    <div class="query">
                      <MarkdownRenderer content={response.query} id={response.id} />
                    </div>
                  </div>

                  {#if response.usedPageScreenshot && (!response.sources || response.sources.length === 0)}
                    <div class="flex items-center gap-2">
                      <div class="w-4 h-4 text-gray-600 dark:text-gray-400">
                        <FileIcon kind="image" />
                      </div>
                      <span class="text-gray-600 dark:text-gray-400 font-normal text-base"
                        >Using screenshot as additional context</span
                      >
                    </div>
                  {/if}
                </div>
              </div>

              {#if response.content}
                <ChatMessageMarkdown
                  id={`chat-response-${response.id}`}
                  content={response.content}
                  sources={populateRenderAndChunkIds(response.sources)}
                  on:citationClick={(e) =>
                    handleCitationClick(
                      e.detail.citationID,
                      e.detail.text,
                      response,
                      e.detail.sourceUid,
                      e.detail.preview
                    )}
                  showSourcesAtEnd={true}
                  usedPageScreenshot={response.usedPageScreenshot}
                  usedInlineScreenshot={response.usedInlineScreenshot}
                />
              {/if}
            </div>
          {/if}
        {/each}

        {#if contextItemErrors.length > 0}
          <div
            class="flex flex-col bg-yellow-50 dark:bg-gray-800 border-yellow-300 dark:border-gray-800 border-[1px] p-4 pr-12 mx-4 gap-4 shadow-sm rounded-xl text-lg leading-relaxed text-yellow-800 dark:text-gray-100 relative"
          >
            {#each contextItemErrors as error}
              <div class="info-box">
                <Icon name="alert-triangle" />
                <p>Warning: {error}</p>
              </div>
            {/each}

            <button
              class="absolute top-3 right-3 text-yellow-800 dark:text-gray-100 hover:text-yellow-600 dark:hover:text-gray-100"
              on:click={() => dispatch('clear-errors')}
            >
              <Icon name="close" />
            </button>
          </div>
        {/if}

        {#if $error}
          <div
            class="flex flex-col justify-start bg-yellow-50 dark:bg-gray-800 border-yellow-300 dark:border-gray-800 border-[1px] p-4 pr-12 mx-4 gap-4 shadow-sm rounded-xl text-lg leading-relaxed text-yellow-800 dark:text-gray-100 relative"
          >
            {$error.message}

            {#if $error.type.startsWith(PageChatMessageSentEventError.QuotaExceeded)}
              <button class="w-fit" on:click={() => openModelSettings()}
                >View Your Chat Quotas →</button
              >
            {/if}

            <button
              class="absolute top-5 right-4 text-yellow-800 dark:text-gray-100 hover:text-yellow-600 dark:hover:text-gray-100"
              on:click={() => error?.set(null)}
            >
              <Icon name="close" />
            </button>
          </div>
        {/if}
      {:else}
        <div
          class="flex flex-col items-center justify-center empty text-gray-900 dark:text-gray-100"
        >
          <div class="empty-title" style="line-height: 1;">
            <Icon name="chat" />
            <h1>New Chat</h1>
          </div>

          <p class="text-sky-900 dark:text-gray-100 max-w-[520px] text-balance">
            Use the + icon next to the chat input to add your tabs or contexts to the chat.
          </p>

          <button
            on:click={handleShowOnboarding}
            class="flex items-center gap-2 rounded-lg px-3 py-1.5 font-medium hover:bg-sky-200"
          >
            <!-- <Icon name="info" /> -->
            <span>Learn More</span>
          </button>
        </div>
      {/if}
    </div>
  {/if}

  <ChatControls
    chatId={note.id}
    active={note.id === $activeNoteId}
    contextManager={note.contextManager}
    {preparingTabs}
    {showAddToContext}
    on:open-context-item
    on:process-context-item
    on:run-prompt={handleRunPrompt}
  />
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
