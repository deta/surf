<script lang="ts">
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import { derived, readable, writable, type Readable, type Writable } from 'svelte/store'
  import { fly, slide } from 'svelte/transition'
  import { tooltip, truncate } from '@horizon/utils'
  import { DropdownMenu } from 'bits-ui'

  import { Icon } from '@horizon/icons'
  import {
    EventContext,
    PageChatMessageSentEventError,
    ResourceTypes,
    SaveToOasisEventTrigger,
    type ResourceDataPost
  } from '@horizon/types'
  import { Editor, getEditorContentText } from '@horizon/editor'

  import type {
    AIChatMessageSource,
    AIChatMessageParsed,
    PageMagic,
    AIChatMessageRole,
    Tab
  } from '../../types/browser.types'
  import ChatMessage from '../Chat/ChatMessage.svelte'
  import ChatMessageMarkdown from '../Chat/ChatMessageMarkdown.svelte'
  import ContextBubbles from '../Chat/ContextBubbles.svelte'
  import { useClipboard, generateID, useLogScope, flyAndScale } from '@horizon/utils'
  import { ResourceManager, useResourceManager, type ResourceLink } from '../../service/resources'
  import { getPrompt, PromptIDs } from '../../service/prompts'
  import { parseChatResponseSources } from '../../service/ai'
  import { useToasts } from '../../service/toast'
  import { useConfig } from '../../service/config'
  import ChatContextTabPicker from '../Chat/ChatContextTabPicker.svelte'
  import { useTabsManager } from '../../service/tabs'
  import Onboarding from '../Core/Onboarding.svelte'

  export let inputValue = ''
  export let magicPage: Writable<PageMagic>
  export let tabsInContext: Readable<Tab[]> = readable([])
  export let allTabs: Tab[] = []
  export let activeTab: Tab | null = null
  export let activeTabMagic: PageMagic
  export let horizontalTabs = false
  export let experimentalMode = false

  const dispatch = createEventDispatcher<{
    highlightText: { tabId: string; text: string }
    highlightWebviewText: { resourceId: string; answerText: string; sourceUid?: string }
    seekToTimestamp: { resourceId: string; timestamp: number }
    navigate: { url: string }
    saveText: string
    updateActiveChatId: string
    updateMagicTabs: string
    'exclude-tab': string
    'remove-magic-tab': Tab
    'include-tab': string
    'close-chat': void
  }>()

  const log = useLogScope('MagicSidebar')
  const { copy, copied } = useClipboard()
  const resourceManager = useResourceManager()
  const toasts = useToasts()
  const config = useConfig()
  const tabsManager = useTabsManager()

  const userConfigSettings = config.settings
  const telemetry = resourceManager.telemetry

  const optPressed = writable(false)
  const cmdPressed = writable(false)
  const shiftPressed = writable(false)
  const aPressed = writable(false)
  const hasError = writable(false)
  const errorMessage = writable('')
  const optToggled = writable(false)
  const toggleSelectAll = writable(false)
  const prevSelectedTabs: Writable<Tab[]> = writable([])
  const tabPickerOpen = writable(false)
  const savedResponse = writable(false)
  const savedChatResponses = writable<Record<string, string>>({})

  const CMD_A_DELAY = 300

  let listElem: HTMLDivElement
  let editorFocused = false
  let editor: Editor
  let lastCmdATime = 0
  let autoScrollChat = true
  let abortController: AbortController | null = null
  let onboardingOpen = writable(true)

  const chatBoxPlaceholder = /*writable('Ask anything...') */ derived(
    [optPressed, cmdPressed, shiftPressed, magicPage, optToggled, tabsInContext],
    ([$optPressed, $cmdPressed, $shiftPressed, $magicPage, $optToggled, $tabsInContext]) => {
      if ($tabsInContext.length === 0) return 'Ask me anything...'
      if ($magicPage.responses.length >= 1) return 'Ask a follow up...'
      if ($tabsInContext.length === allTabs.length) return 'Ask anything about all tabs...'
      return `Ask anything about ${$tabsInContext.length} ${
        $tabsInContext.length === 1 ? 'tab' : 'tabs'
      }...`
    }
  )

  export const startChatWithQuery = async (query: string) => {
    await handleClearChat()
    inputValue = query
    await handleChatSubmit()
  }

  export const addChatWithQuery = async (query: string) => {
    inputValue = '<blockquote>' + query + '</blockquote>' + '</br>'
    editor.setContent(inputValue)
    console.log('focus addChatWithQuery')
    editor.focus()
  }

  const updateMagicPage = (data: Partial<PageMagic>) => {
    if (data.chatId) {
      dispatch('updateActiveChatId', data.chatId)
    }

    magicPage.update((page) => {
      return {
        ...page,
        ...data
      }
    })
  }

  const addPageMagicResponse = (response: AIChatMessageParsed) => {
    magicPage.update((page) => {
      return {
        ...page,
        responses: [...page.responses, response]
      }
    })
  }

  const updatePageMagicResponse = (responseId: string, updates: Partial<AIChatMessageParsed>) => {
    magicPage.update((page) => {
      const updatedPage = {
        ...page,
        responses: page.responses.map((response) => {
          if (response.id === responseId) {
            return {
              ...response,
              ...updates
            }
          }
          return response
        })
      }

      tick().then(scrollToBottom)

      return updatedPage
    })
  }

  const saveResponseOutput = async (response: AIChatMessageParsed) => {
    log.debug('Saving chat response')

    let content = response.content
    const element = document.getElementById(`chat-response-${response.id}`)
    if (element) {
      content = element.innerHTML
    }

    const resource = await resourceManager.createResourceNote(content, {
      name: truncate(response.query, 50)
    })

    savedChatResponses.update((responses) => {
      responses[response.id] = resource.id
      return responses
    })

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

  const populateRenderAndChunkIds = (sources: AIChatMessageSource[] | undefined) => {
    if (!sources) return
    sources.forEach((source, idx) => {
      source.render_id = (idx + 1).toString()
      source.all_chunk_ids = [source.id]
    })
    return sources
  }

  const handleCitationClick = async (
    sourceId: string,
    answerText: string,
    message: AIChatMessageParsed,
    sourceUid?: string
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
      resource.type === ResourceTypes.LINK ||
      resource.type === ResourceTypes.ARTICLE ||
      resource.type.startsWith(ResourceTypes.POST)
    ) {
      if (
        resource.type === ResourceTypes.POST_YOUTUBE &&
        source.metadata?.timestamp !== undefined
      ) {
        const timestamp = source.metadata.timestamp
        dispatch('seekToTimestamp', { resourceId: resource.id, timestamp: timestamp })

        await telemetry.trackPageChatCitationClick('timestamp', sourceTabType)

        if (sourceTabType === 'space') {
          await telemetry.trackPageChatCitationClickResourceFromSpace('timestamp')
        }
      } else {
        dispatch('highlightWebviewText', {
          resourceId: resource.id,
          answerText: answerText,
          sourceUid: sourceUid
        })

        await telemetry.trackPageChatCitationClick('text', sourceTabType)

        if (sourceTabType === 'space') {
          await telemetry.trackPageChatCitationClickResourceFromSpace('text')
        }
      }
    }
  }

  const handleChatSubmit = async () => {
    if (!inputValue) {
      log.debug('No input value')
      return
    }

    const savedInputValue = inputValue.trim().replace('<p>', '').replace('</p>', '')
    autoScrollChat = true

    try {
      log.debug('Handling chat submit', savedInputValue)
      inputValue = ''
      editor.clear()

      await sendChatMessage(savedInputValue)
    } catch (e) {
      log.error('Error doing magic', e)
      inputValue = savedInputValue
      editor.setContent(savedInputValue)
    }
  }

  const handleSelectAllTabs = async () => {
    log.debug('Selecting all tabs')
  }

  const scrollToBottom = () => {
    if (!autoScrollChat) return
    if (listElem) {
      listElem.scrollTop = listElem.scrollHeight
    }
  }

  const handleListWheel = (e: WheelEvent) => {
    autoScrollChat = false
  }

  const runPrompt = async (promptType: PromptIDs) => {
    try {
      log.debug('Handling prompt submit', promptType)
      autoScrollChat = true

      const prompt = await getPrompt(promptType)

      await sendChatMessage(prompt.content, 'assistant', prompt.title)
    } catch (e) {
      log.error('Error doing magic', e)
    }
  }

  const handleClearChat = async () => {
    log.debug('Clearing chat')

    if (!$magicPage.chatId) {
      log.error('No chat found to clear')
      return
    }

    await clearChat($magicPage.chatId)
  }

  const handleClearContext = () => {
    for (const t of $tabsInContext) {
      dispatch('exclude-tab', t.id)
    }
    editor.focus()
  }

  const handleInputKeydown = (e: KeyboardEvent) => {
    const currentTime = Date.now()

    if (e.key === 'Alt' || e.key === 'Option') {
      $optPressed = true
    } else if (e.key === 'Meta' || e.key === 'Control') {
      $cmdPressed = true
    } else if (e.key === 'Shift') {
      shiftPressed.set(true)
    } else if (e.key.toLowerCase() === 'a') {
      aPressed.set(true)
    } else if (e.key === 'a' && e.metaKey) {
      lastCmdATime = currentTime
    }
    // NOTE: Disabled for now as it interfears with text editing.
    /*else if (e.ctrlKey && e.key === 'Backspace') {
      e.preventDefault()
      e.stopPropagation()
      if (currentTime - lastCmdATime < CMD_A_DELAY) {
        // If Cmd+A was pressed recently, don't clear chat
        return
      }
      if (abortController) {
        abortController.abort()
        abortController = null
      } else {
        handleClearChat()
      }
    }*/
    else if (e.shiftKey && e.key === 'Backspace') {
      // Shift + Backspace to clear context
      e.preventDefault()
      handleClearContext()
    } else if (e.key === 'Enter' && !$shiftPressed) {
      e.preventDefault()
      if ($cmdPressed && $shiftPressed) {
        selectedMode = 'all'
      } else if ($optPressed) {
        selectedMode = 'general'
      } else {
        selectedMode = 'active'
      }
      contextTabs = getContextTabs(selectedMode, $tabsInContext, allTabs, activeTab)
      handleChatSubmit()
    } else if (e.key === 'Escape') {
      if ($optToggled) {
        e.stopPropagation()
        e.stopImmediatePropagation()
        e.preventDefault()
        optToggled.set(false)
        $tabPickerOpen = false
        return
      }
    } else if (e.key === 'Enter' && $shiftPressed && $cmdPressed) {
      if (inputValue !== '') {
        contextTabs = allTabs
        handleChatSubmit()
      }
    }

    // Check for Cmd + Shift + A
    if (
      $cmdPressed &&
      $shiftPressed &&
      $aPressed &&
      e.key.toLowerCase() === 'a' &&
      $activeTabMagic.showSidebar
    ) {
      e.preventDefault()
      if ($tabsInContext.length < allTabs.length) {
        toggleSelectAll.set(false)
      }

      if ($toggleSelectAll) {
        for (const t of allTabs) {
          dispatch('exclude-tab', t.id)
        }
        for (const t of $prevSelectedTabs) {
          dispatch('include-tab', t.id)
        }
      } else {
        prevSelectedTabs.set($tabsInContext)
        for (const t of allTabs) {
          dispatch('include-tab', t.id)
        }
      }

      toggleSelectAll.set(!$toggleSelectAll)
    }
  }

  const handleInputKeyup = (e: KeyboardEvent) => {
    if (e.key === 'Alt' || e.key === 'Option') {
      $optPressed = false
    } else if (e.key === 'Meta' || e.key === 'Control') {
      $cmdPressed = false
    } else if (e.key === 'Shift') {
      $shiftPressed = false
    } else if (e.key.toLowerCase() === 'a') {
      $aPressed = false
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

  let selectedMode: 'general' | 'all' | 'active' | 'context' = 'general'

  function getContextTabs(
    mode: 'general' | 'all' | 'active' | 'context',
    tabsInContext: Tab[],
    allTabs: Tab[],
    activeTab: Tab | null
  ): Tab[] {
    let result: Tab[]
    switch (mode) {
      case 'general':
        result = []
        break
      case 'all':
        result = allTabs
        break
      case 'active':
        result = tabsInContext
        break
      case 'context':
        result = tabsInContext
        break
      default:
        result = []
    }
    return result
  }

  let contextTabs: Tab[] = getContextTabs(selectedMode, $tabsInContext, allTabs, activeTab)

  const sendChatMessage = async (
    prompt: string,
    role: AIChatMessageRole = 'user',
    query?: string
  ) => {
    const chatId = $magicPage.chatId
    if (!chatId) {
      log.error('Error: Existing chat not found')
      return
    }

    errorMessage.set('')
    hasError.set(false)

    if (contextTabs.length === 0) {
      log.debug('No tabs in context, general chat:')
    } else {
      log.debug('Tabs in context:', contextTabs)
    }

    let response: AIChatMessageParsed | null = null

    const generalMode = contextTabs.length === 0
    const previousMessages = $magicPage.responses.filter(
      (message) => message.id !== (response?.id ?? '')
    )
    const numSpaces = generalMode ? 0 : contextTabs.filter((tab) => tab.type === 'space').length
    const numPages = generalMode
      ? 0
      : contextTabs.filter((tab) => tab.type === 'page' && tab.chatResourceBookmark).length
    let contextSize = generalMode ? 0 : contextTabs.length

    try {
      const resourceIds: string[] = []
      for (const tab of contextTabs) {
        if (tab.type === 'page' && tab.chatResourceBookmark) {
          resourceIds.push(tab.chatResourceBookmark)
        } else if (tab.type === 'space') {
          const spaceContents = await resourceManager.getSpaceContents(tab.spaceId)
          if (spaceContents) {
            resourceIds.push(...spaceContents.map((content) => content.resource_id))
          }
        } else if (tab.type === 'resource') {
          resourceIds.push(tab.resourceId)
        }
      }

      if (!generalMode && resourceIds.length > 0) {
        contextSize = resourceIds.length
      }

      response = {
        id: generateID(),
        role: role,
        query: query ?? prompt,
        status: 'pending',
        content: '',
        citations: {}
      } as AIChatMessageParsed

      updateMagicPage({ running: true })
      addPageMagicResponse(response)

      log.debug('calling the AI', prompt, resourceIds)
      let step = 'idle'
      let content = ''

      abortController = new AbortController()

      await resourceManager.sffs.sendAIChatMessage(
        chatId!,
        prompt,
        (chunk: string) => {
          if (step === 'idle') {
            log.debug('sources chunk', chunk)

            content += chunk

            if (content.includes('</sources>')) {
              const sources = parseChatResponseSources(content)
              log.debug('Sources', sources)

              step = 'sources'
              content = ''

              updatePageMagicResponse(response?.id ?? '', {
                sources
              })
            }
          } else {
            content += chunk
            updatePageMagicResponse(response?.id!, {
              content: content
                .replace('<answer>', '')
                .replace('</answer>', '')
                // .replace('<citation>', '')
                // .replace('</citation>', '')
                .replace('<br>', '\n')
            })
          }
        },
        {
          limit: 30,
          resourceIds: resourceIds,
          general: resourceIds.length === 0
        }
      )

      updatePageMagicResponse(response.id, {
        status: 'success',
        content: content.replace('<answer>', '').replace('</answer>', '')
      })

      await telemetry.trackPageChatMessageSent({
        contextSize: contextSize,
        numPages: numPages,
        numSpaces: numSpaces,
        numPreviousMessages: previousMessages.length,
        embeddingModel: $userConfigSettings.embedding_model
      })

      if (numSpaces > 0) {
        await telemetry.trackChatWithSpace()
      }
    } catch (e) {
      log.error('Error doing magic', e)
      let content = 'Failed to generate response.'
      let error = PageChatMessageSentEventError.Other

      if ((e as any)?.includes('RAG Empty Context')) {
        content = `Unfortunately, we failed to find relevant information to answer your query.
\nThere might have been an issue with extracting all information from your current context.
\nPlease try asking a different question or let us know if the issue persists.`
      }
      if (response) {
        updatePageMagicResponse(response.id, {
          content: content,
          status: 'error'
        })
      }
      hasError.set(true)
      errorMessage.set(content)
      setTimeout(() => {
        hasError.set(false)
      }, 10000)

      await telemetry.trackPageChatMessageSent({
        contextSize: contextSize,
        numPages: numPages,
        numSpaces: numSpaces,
        numPreviousMessages: previousMessages.length,
        embeddingModel: $userConfigSettings.embedding_model,
        error: error
      })

      if (numSpaces > 0) {
        await telemetry.trackChatWithSpace()
      }

      throw e
    } finally {
      updateMagicPage({ running: false })
      abortController = null
    }
  }

  const clearChat = async (id: string) => {
    const toast = toasts.loading('Clearing chat...')

    try {
      log.debug('Clearing chat', id)

      const messagesLength = $magicPage.responses.length

      $magicPage.responses = []

      await resourceManager.sffs.deleteAIChat(id)

      log.debug('Old chat deleted, creating new chat...')
      const newChatId = await resourceManager.sffs.createAIChat('')
      if (!newChatId) {
        log.error('Failed to create new chat aftering clearing the old one')
        return
      }

      updateMagicPage({
        chatId: newChatId,
        responses: []
      })

      toast.success('Chat cleared!')

      await telemetry.trackPageChatClear(messagesLength)
    } catch (e) {
      log.error('Error clearing chat:', e)
      toast.error('Failed to clear chat')
    }
  }

  const fetchExistingChat = async (id: string) => {
    const chat = await resourceManager.sffs.getAIChat(id)
    if (chat) {
      log.debug('Chat fetched', chat)
      const userMessages = chat.messages.filter((message) => message.role === 'user')
      const queries = userMessages.map((message) => message.content) // TODO: persist the query saved in the AIChatMessageParsed instead of using the actual content
      const systemMessages = chat.messages.filter((message) => message.role === 'assistant')

      log.debug('User messages', userMessages)
      log.debug('System messages', systemMessages)

      const responses = systemMessages.map((message, idx) => {
        message.sources = message.sources
        log.debug('Message', message)
        return {
          id: generateID(),
          role: 'user',
          query: queries[idx],
          content: message.content.replace('<answer>', '').replace('</answer>', ''),
          sources: message.sources,
          status: 'success'
        } as AIChatMessageParsed
      })

      updateMagicPage({
        responses
      })
    } else {
      log.error('Failed to fetch chat', id)
    }
  }

  const createNewChat = async () => {
    const chatId = await resourceManager.sffs.createAIChat('')
    if (!chatId) {
      log.error('Failed to create chat')
      return
    }

    log.debug('Chat created', chatId)

    updateMagicPage({ chatId })
  }

  const stopGeneration = async () => {
    log.debug('Stopping generation')
    updateMagicPage({ running: false })
  }

  onMount(async () => {
    log.debug('Magic Sidebar mounted', $magicPage.chatId)

    if ($magicPage.chatId) {
      log.debug('Existing chat found', $magicPage.chatId)
      await fetchExistingChat($magicPage.chatId)
    } else {
      log.debug('No existing chat found, creating new chat')
      await createNewChat()
    }
  })

  $: smallSize = inputValue.length < 75
</script>

{#if $onboardingOpen}
  <Onboarding on:close={() => onboardingOpen.set(false)} />
{/if}

<div class="flex flex-col h-full relative overflow-hidden">
  {#if !experimentalMode}
    <div class="flex items-center justify-between gap-3 px-4 py-4 border-b-2 border-sky-100">
      {#if $magicPage.responses.length > 0}
        <button
          class="flex items-center gap-2 p-2 rounded-lg opacity-60 hover:bg-blue-200"
          on:click={() => {
            handleClearChat()
          }}
        >
          <Icon name="add" />
          New Chat
        </button>
      {:else}
        <div class="flex items-center justify-start text-lg p-1.5 font-semibold">Chat</div>
      {/if}

      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      {#if !horizontalTabs}
        <div
          role="button"
          tabindex="0"
          on:click={() => dispatch('close-chat')}
          class="flex items-center gap-2 p-1 text-sky-800/50 rounded-lg hover:bg-sky-100 hover:text-sky-800 group cursor-pointer"
        >
          <Icon name="sidebar.right" class="group-hover:hidden" size="20px" />
          <Icon name="close" class="hidden group-hover:block" size="20px" />
        </div>
      {/if}
    </div>
  {/if}
  <div
    class="flex flex-col overflow-auto h-full pb-52 pt-2 overflow-x-hidden"
    bind:this={listElem}
    on:wheel|passive={handleListWheel}
  >
    {#if $magicPage.responses.length > 0}
      {#each $magicPage.responses as response, idx (response.id)}
        {#if response.status === 'success'}
          <div
            class="response-wrapper text-lg flex flex-col gap-2 rounded-xl p-4 text-opacity-90 group relative"
          >
            <div class="">
              <div
                class="font-medium text-neutral-800 bg-sky-100 border-sky-200 border-1 px-6 py-2 rounded-xl w-fit mb-2 truncate max-w-full"
              >
                <div class="tiptap query">
                  {#if response.role === 'user'}
                    {@html response.query}
                  {:else}
                    {sanitizeQuery(response.query)}
                  {/if}
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
                  e.detail.sourceUid
                )}
              showSourcesAtEnd={true}
            />

            <div
              class="flex-row items-center mx-auto space-x-2 hidden group-hover:flex absolute text-sm -bottom-2 left-1/2 -translate-x-1/2 transition-all duration-300 ease-in-out"
            >
              {#if $savedChatResponses[response.id]}
                <button
                  on:click={() => openResponseResource(response.id)}
                  use:tooltip={{
                    text: 'Open as tab',
                    position: 'left'
                  }}
                  class="transform active:scale-95 appearance-none border-0 group margin-0 flex items-center gap-2 py-2 px-3 bg-sky-200 hover:bg-sky-200/50 transition-colors duration-200 rounded-xl text-sky-800 cursor-pointer"
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
                  class="transform active:scale-95 appearance-none border-0 group margin-0 flex items-center gap-2 py-2 px-3 bg-sky-200 hover:bg-sky-200/50 transition-colors duration-200 rounded-xl text-sky-800 cursor-pointer"
                >
                  <Icon name="leave" />
                  Save
                </button>
              {/if}

              <button
                on:click={() => copy(response.content)}
                use:tooltip={{
                  text: 'Copy to Clipboard',
                  position: 'left'
                }}
                class="transform active:scale-95 appearance-none border-0 group margin-0 flex items-center py-2.5 px-2.5 bg-sky-100 hover:bg-sky-100/50 transition-colors duration-200 rounded-xl text-sky-800 cursor-pointer"
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
                class="font-medium flex gap-2 text-neutral-800 bg-sky-100 border-sky-200 border-1 px-4 py-2 rounded-xl w-fit mb-2 truncate max-w-full"
              >
                <div class="icon">
                  <Icon name="spinner" />
                </div>

                <div class="tiptap query">{@html response.query}</div>
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
                    e.detail.sourceUid
                  )}
                showSourcesAtEnd={true}
              />
            {/if}
          </div>
          <!-- {:else if response.status === 'error'}
          <div
            class="output text-lg flex flex-col gap-2 rounded-xl p-8 text-opacity-90 group relative bg-[#f5faff]"
          >
            {response.content}
          </div> -->
        {/if}
      {/each}

      {#if $magicPage.errors.length > 0}
        <div
          class="flex flex-col bg-yellow-50 border-yellow-300 border-[1px] p-4 mx-4 gap-4 shadow-sm rounded-xl text-lg leading-relaxed text-yellow-800 relative"
        >
          {#each $magicPage.errors as error}
            <div class="info-box">
              <Icon name="alert-triangle" />
              <p>Warning: {error}</p>
            </div>
          {/each}

          <button
            class="absolute top-3 right-3 text-yellow-800 hover:text-yellow-600"
            on:click={() => magicPage.update((v) => ({ ...v, errors: [] }))}
          >
            <Icon name="close" />
          </button>
        </div>
      {/if}

      {#if $hasError}
        <div
          class="flex flex-col bg-yellow-50 border-yellow-300 border-[1px] p-4 mx-4 gap-4 shadow-sm rounded-xl text-lg leading-relaxed text-yellow-800 relative"
        >
          {$errorMessage}
          <button
            class="absolute top-5 right-4 text-yellow-800 hover:text-yellow-600"
            on:click={() => hasError.set(false)}
          >
            <Icon name="close" />
          </button>
        </div>
      {/if}
    {:else}
      <div class="flex flex-col items-center justify-center empty">
        <div class="empty-title" style="line-height: 1;">
          <Icon name="chat" />
          <h1>New Chat</h1>
        </div>

        <p class="text-sky-900">
          Ask questions about specific tabs or start a general conversation.
        </p>
        <p class=" text-sky-900/60">
          Use the + icon or select tabs from the tab bar to add context.
          <!-- Select tabs with the + Icon or by selecting them from the tab bar.( {#if navigator.platform
            .toLowerCase()
            .indexOf('mac') > -1}⌘{:else}Ctrl{/if} + click or Shift + click ). -->
        </p>
      </div>
    {/if}
  </div>

  <div
    class="chat bg-gradient-to-t from-sky-300/20 via-sky-300/10 to-transparent mx-auto absolute w-full bottom-0 rounded-xl flex flex-col shadow-xl pb-2"
  >
    {#if experimentalMode && !$magicPage.running && $magicPage.responses.length >= 1}
      <button
        transition:flyAndScale={{ duration: 125, y: 22 }}
        on:click={() => {
          if (!$magicPage.running) {
            handleClearChat()
          }
        }}
        class="transform mb-4 active:scale-95 appearance-none w-fit mx-auto border-[0.5px] border-sky-900/10 group margin-0 flex items-center px-3 py-2 bg-sky-100 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 cursor-pointer text-xs"
      >
        {#if navigator.platform.toLowerCase().indexOf('mac') > -1}
          Clear Chat
        {:else}
          Clear Chat
        {/if}
      </button>
    {/if}

    {#if $magicPage.initializing}
      <div
        transition:slide={{ duration: 150, axis: 'y' }}
        class="err flex flex-col bg-blue-50 border-t-blue-300 border-l-blue-300 border-r-blue-300 border-[1px] py-2 px-4 gap-4 shadow-sm mx-8 rounded-t-xl text-lg leading-relaxed text-blue-800/60 relative"
      >
        Preparing tabs for the chat…
      </div>
    {:else if $tabsInContext.length}
      {#if !$optToggled}
        <div
          class="flex flex-col bg-blue-50 border-t-blue-300 border-l-blue-300 border-r-blue-300 border-[1px] py-2 px-4 gap-4 shadow-sm mx-8 rounded-t-xl text-lg leading-relaxed text-blue-800/60 relative"
          transition:slide={{ duration: 150, axis: 'y', delay: 350 }}
        >
          <div class=" flex-row items-center gap-2 flex">
            <ContextBubbles
              tabs={$tabsInContext.slice(0, 10)}
              on:select-all-tabs={handleSelectAllTabs}
              on:select
              on:exclude-tab
              on:include-tab
            />
            {#if $tabsInContext.length > 0}
              <button
                class="flex items-center gap-2 p-2 text-sm rounded-lg opacity-60 hover:bg-blue-200"
                on:click={() => {
                  handleClearContext()
                }}
                use:tooltip={{
                  text: 'Shift + ⌫',
                  position: 'left'
                }}
              >
                <Icon name="close" />
              </button>
            {/if}
          </div>
        </div>
      {/if}
    {/if}

    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="flex bg-sky-50 border-blue-300 border-[1px] px-4 py-3 gap-2 shadow-lg mx-4"
      class:rounded-2xl={smallSize}
      class:rounded-xl={!smallSize}
      class:flex-col={!smallSize}
      class:items-center={smallSize}
      on:keydown={handleInputKeydown}
      on:keyup={handleInputKeyup}
    >
      <div class="flex-grow overflow-y-auto">
        <Editor
          bind:this={editor}
          bind:content={inputValue}
          bind:focused={editorFocused}
          autofocus={true}
          placeholder={$chatBoxPlaceholder}
        />
      </div>

      <div class="flex items-center gap-2 relative justify-end">
        {#if $tabPickerOpen}
          <ChatContextTabPicker
            tabItems={allTabs
              .filter((e) => !$tabsInContext.includes(e))
              .sort((a, b) => b.index - a.index)}
            on:include-tab
            on:close={() => {
              $tabPickerOpen = false
              editor.focus()
            }}
          />
        {/if}
        <button
          disabled={allTabs.filter((e) => !$tabsInContext.includes(e)).length <= 0}
          popovertarget="chat-add-context-tabs"
          class="open-tab-picker disabled:opacity-40 disabled:cursor-not-allowed transform whitespace-nowrap active:scale-95 disabled:opacity-10 appearance-none border-0 group margin-0 flex items-center px-2 py-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-1000 cursor-pointer text-sm"
          on:click={(e) => {
            $tabPickerOpen = !$tabPickerOpen
          }}
          use:tooltip={{
            text: 'Add tab',
            position: 'left'
          }}
        >
          <Icon name={'add'} size={'18px'} color="#1e3a8a" className="opacity-60" />
        </button>

        <button
          class="transform whitespace-nowrap active:scale-95 disabled:opacity-10 appearance-none border-0 group margin-0 flex items-center px-2 py-2 bg-sky-300 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-1000 cursor-pointer text-sm"
          on:click={() => {
            selectedMode = 'active'
            contextTabs = getContextTabs(selectedMode, $tabsInContext, allTabs, activeTab)
            handleChatSubmit()
          }}
          disabled={!inputValue || $magicPage.running}
        >
          {#if $magicPage.running && !$optToggled}
            <Icon name="spinner" />
          {:else}
            <div class="rotate-90"><Icon name="arrow.left" /></div>
          {/if}
        </button>
      </div>
    </div>
  </div>
</div>
-

<style lang="scss">
  @keyframes blurIn {
    0% {
      filter: blur(10px);
      transform: translateY(1rem);
      opacity: 0;
    }
    100% {
      filter: blur(0);
      transform: translateY(0);
      opacity: 1;
    }
  }
  .animate-blur {
    animation: blurIn 0.42s cubic-bezier(0.68, -0.55, 0.27, 1.55);
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    flex: 1;
    overflow: auto;
    padding-bottom: 4rem;
  }

  /* Prevent copy button cuttof */
  .response-wrapper:hover {
    position: relative;
    z-index: 5;
  }

  .chat {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    font-family: inherit;
    z-index: 10;

    .editor-wrapper {
      flex: 1;
      background: #fff;
      border: 1px solid #eeece0;
      border-radius: 12px;
      padding: 0.75rem;
      font-size: 1rem;
      font-family: inherit;
      resize: vertical;
      min-height: 80px;
    }
  }

  // .chat button {
  //   appearance: none;
  //   border: none;
  //   background: #f73b95;
  //   color: #fff;
  //   border-radius: 8px;
  //   padding: 0;
  //   width: 40px;
  //   height: 40px;
  //   display: flex;
  //   align-items: center;
  //   justify-content: center;
  //   cursor: pointer;
  //   flex-shrink: 0;

  //   // secondary styles
  //   &.secondary {
  //     background: #fff;
  //     color: #f73b95;
  //   }
  // }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .title {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #2b2715;
    white-space: nowrap;

    h1 {
      font-size: 1.5rem;
      font-weight: 500;
    }
  }

  .status {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
    border-radius: 8px;
    color: #3f3f3f;

    p {
      flex: 1;
      font-size: 1rem;
      font-weight: 500;
      color: #3f3f3f;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .output-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .input {
    display: flex;
    align-items: center;
    gap: 10px;
    overflow: hidden;
    opacity: 0.75;
  }

  .icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .query {
    flex: 1;
    // truncate with ellipses after two lines
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .output-actions {
    display: flex;
    align-items: center;
    gap: 10px;

    button {
      appearance: none;
      border: none;
      background: none;
      cursor: pointer;
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s ease;

      &:hover {
        opacity: 1 !important;
      }
    }
  }

  input {
    width: 100%;
    padding: 10px;
    border: 1px solid transparent;
    border-radius: 5px;
    font-size: 1rem;
    background-color: #fff;
    color: #3f3f3f;

    &:hover {
      background: #eeece0;
    }

    &:focus {
      outline: none;
      border-color: #f73b95;
      color: #000;
      background-color: #ffffff;
    }
  }

  .prompts {
    position: absolute;
    bottom: 4.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    width: 100%;
    padding: 15px 0;
    overflow-x: auto;
    // linear gradient from bottom background color to transparent top
    background: linear-gradient(180deg, transparent, #eeece0);

    button {
      flex-shrink: 0;
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      background: #fff;
      color: #353535;
      cursor: pointer;
      font-size: 1rem;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
      transition: background 0.2s;

      &:hover {
        background: #f6f5ef;
      }
    }
  }

  .clear-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: auto;
    border: none;
    background: none;
    color: #616179;
    cursor: pointer;
    font-size: 1rem;

    &:hover {
      color: #2b2b3d;
    }
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

  .info-box {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    border-radius: 8px;
    background: #ffffff;
    color: #3f3f3f;
    font-size: 1rem;
    opacity: 0.75;
  }

  :global(.chat-message-content h2) {
    font-size: 1.4rem;
    margin-top: 1rem !important;
    margin-bottom: 0.5rem !important;
  }
</style>
