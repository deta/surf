<script lang="ts" context="module">
  export type ExamplePrompt = {
    label: string
    prompt: string
  }
</script>

<script lang="ts">
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import { derived, get, readable, writable, type Readable, type Writable } from 'svelte/store'
  import { fly, slide } from 'svelte/transition'
  import { htmlToMarkdown, tooltip, truncate, useDebounce, useThrottle } from '@horizon/utils'
  import { DropdownMenu } from 'bits-ui'
  import chatContextDemo from '../../../../public/assets/demo/chatcontext.gif'
  import chatAdd from '../../../../public/assets/demo/chatadd.gif'
  import chatRemove from '../../../../public/assets/demo/chatremove.gif'

  import { Icon } from '@horizon/icons'
  import {
    EventContext,
    OpenInMiniBrowserEventFrom,
    PageChatMessageSentEventError,
    PageChatUpdateContextEventTrigger,
    ResourceTypes,
    SaveToOasisEventTrigger,
    type ResourceDataPost,
    type ResourceStateCombined
  } from '@horizon/types'
  import { Editor, getEditorContentText } from '@horizon/editor'

  import type {
    AIChatMessageSource,
    AIChatMessageParsed,
    PageMagic,
    AIChatMessageRole,
    Tab,
    ContextItem,
    AddContextItemEvent,
    TabPage
  } from '../../types/browser.types'
  import ChatMessage from '../Chat/ChatMessage.svelte'
  import ChatMessageMarkdown from '../Chat/ChatMessageMarkdown.svelte'
  import ContextBubbles from '../Chat/ContextBubbles.svelte'
  import { useClipboard, generateID, useLogScope, flyAndScale } from '@horizon/utils'
  import {
    Resource,
    ResourceJSON,
    ResourceManager,
    useResourceManager,
    type ResourceLink
  } from '../../service/resources'
  import { getPrompt, PromptIDs } from '../../service/prompts'
  import { parseChatResponseSources } from '../../service/ai'
  import { useToasts } from '../../service/toast'
  import { useConfig } from '../../service/config'
  import ChatContextTabPicker from '../Chat/ChatContextTabPicker.svelte'
  import { useTabsManager } from '../../service/tabs'
  import { DragculaDragEvent, HTMLDragItem, HTMLDragZone } from '@horizon/dragcula'
  import { DragTypeNames, SpaceEntryOrigin, type DragTypes } from '../../types'
  import Onboarding from '../Core/Onboarding.svelte'
  import { blobToDataUrl } from '../../utils/screenshot'
  import { WebParser } from '@horizon/web-parser'
  import {
    BUILT_IN_PAGE_PROMPTS,
    CLASSIFY_SCREENSHOT_PROMPT,
    PAGE_PROMPTS_GENERATOR_PROMPT
  } from '../../constants/prompts'
  import FileIcon from '../Resources/Previews/File/FileIcon.svelte'
  import PromptItem from '../Chat/PromptItem.svelte'
  import { useGlobalMiniBrowser } from '@horizon/core/src/lib/service/miniBrowser'
  import MarkdownRenderer from '@horizon/editor/src/lib/components/MarkdownRenderer.svelte'

  export let inputValue = ''
  export let magicPage: Writable<PageMagic>
  export let contextItems: Readable<ContextItem[]> = readable([])
  export let activeTab: Tab | null = null
  export let activeTabMagic: PageMagic
  export let horizontalTabs = false

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
    'open-context-item': ContextItem
    'process-context-item': ContextItem
    'close-chat': void
    'pick-screenshot': void
    'remove-context-item': string
    'add-context-item': AddContextItemEvent
  }>()

  const log = useLogScope('MagicSidebar')
  const { copy, copied } = useClipboard()
  const resourceManager = useResourceManager()
  const toasts = useToasts()
  const config = useConfig()
  const tabsManager = useTabsManager()
  const globalMiniBrowser = useGlobalMiniBrowser()

  const tabs = tabsManager.tabs
  const userConfigSettings = config.settings
  const telemetry = resourceManager.telemetry
  const activeTabId = tabsManager.activeTabId

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
  const examplePrompts = writable<ExamplePrompt[]>([])
  const generatingExamplePrompts = writable(false)
  const resourceToGeneratePromptsFor = writable<string | null>(null)
  const resourceToGeneratePromptsForState = writable<ResourceStateCombined | null>(null)
  const cachedPagePrompts = new Map<string, ExamplePrompt[]>()
  const processingUnsubs = new Map<string, () => void>()

  const CMD_A_DELAY = 300

  let listElem: HTMLDivElement
  let editorFocused = false
  let editor: Editor
  let lastCmdATime = 0
  let autoScrollChat = true
  let abortController: AbortController | null = null
  let onboardingOpen = writable($userConfigSettings.onboarding.completed_chat === false)

  const tabsInContext = derived(contextItems, (contextItems) => {
    return contextItems.filter((item) => item.type === 'tab').map((item) => item.data)
  })

  const chatBoxPlaceholder = /*writable('Ask anything...') */ derived(
    [optPressed, cmdPressed, shiftPressed, magicPage, optToggled, contextItems],
    ([$optPressed, $cmdPressed, $shiftPressed, $magicPage, $optToggled, $contextItems]) => {
      if ($contextItems.length === 0) return 'Ask me anything...'
      if ($magicPage.responses.length >= 1) return 'Ask a follow up...'
      if ($contextItems.length === $tabs.length) return 'Ask anything about all tabs...'
      return `Ask anything about ${$contextItems.length} ${
        $contextItems.length === 1 ? 'tab' : 'tabs'
      }...`
    }
  )

  const contextPickerTabs = derived([tabs, contextItems], ([tabs, contextItems]) => {
    return tabs
      .filter((e) => !contextItems.find((i) => i.type === 'tab' && i.data.id === e.id))
      .sort((a, b) => b.index - a.index)
  })

  const showFloatingClearChat = derived(userConfigSettings, (userConfigSettings) => {
    return userConfigSettings.annotations_sidebar || userConfigSettings.go_wild_mode
  })

  const showExamplePrompts = derived(
    [tabsInContext, userConfigSettings],
    ([tabsInContext, userConfigSettings]) => {
      if (!userConfigSettings.automatic_chat_prompt_generation) {
        return false
      }

      const tab = tabsInContext.find((tab) => tab.id === $activeTabId)
      if (!tab || tab.type !== 'page' || !tab.chatResourceBookmark) {
        return false
      }

      return true
    }
  )

  const filteredExamplePrompts = derived(
    [examplePrompts, magicPage],
    ([examplePrompts, magicPage]) => {
      return examplePrompts.filter((prompt) => {
        return (
          !magicPage.responses.find(
            (response) => response.query === prompt.prompt || response.query === prompt.label
          ) &&
          BUILT_IN_PAGE_PROMPTS.find(
            (p) => p.label.toLowerCase() === prompt.label.toLowerCase()
          ) === undefined
        )
      })
    }
  )

  const filteredBuiltInPrompts = derived([magicPage], ([magicPage]) => {
    return BUILT_IN_PAGE_PROMPTS.filter((prompt) => {
      return !magicPage.responses.find(
        (response) => response.query === prompt.prompt || response.query === prompt.label
      )
    })
  })

  const updateChatInput = (text: string, focus = true) => {
    inputValue = text
    editor.setContent(text)

    if (focus) {
      editor.focus()
    }
  }

  export const startChatWithQuery = async (query: string) => {
    const messagesLength = $magicPage.responses.length

    if (messagesLength > 0) {
      const confirmed = await confirm(
        'Are you sure you want to start a new chat? This will clear the current chat.'
      )

      if (!confirmed) {
        log.debug('User cancelled new chat')
        updateChatInput(query)
        return
      }
    }

    await handleClearChat()
    updateChatInput(query)
    selectedMode = 'active'
    await handleChatSubmit()
  }

  export const insertQueryIntoChat = async (query: string) => {
    inputValue = query
    editor.setContent(inputValue)
    editor.focus()
  }

  export const addChatWithQuery = async (query: string) => {
    const value = '<blockquote>' + query + '</blockquote>' + '</br>'
    updateChatInput(value)
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
      name: truncate(cleanQuery(response.query), 50)
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

    if (preview && source) {
      globalMiniBrowser.openResource(source.resource_id, {
        from: OpenInMiniBrowserEventFrom.Chat,
        highlightSimilarText: answerText || source.content,
        jumptToTimestamp: source.metadata?.timestamp
      })

      await telemetry.trackPageChatCitationClick(
        source.metadata?.timestamp !== undefined ? 'timestamp' : 'text',
        sourceTabType
      )
      return
    }

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

    const savedInputValue = await htmlToMarkdown(inputValue) //inputValue.trim().replaceAll('<p></p>', '')
    autoScrollChat = true

    try {
      log.debug('Handling chat submit', savedInputValue)
      inputValue = ''
      editor.clear()

      await sendChatMessage(savedInputValue)
    } catch (e) {
      log.error('Error doing magic', e)

      updateChatInput(savedInputValue)
    }
  }

  const rerunChatMessageWithoutScreenshot = async () => {
    const lastResponse = $magicPage.responses[$magicPage.responses.length - 1]
    if (!lastResponse) {
      log.error('No last response found')
      toasts.error('No last response found')
      return
    }

    const lastQuery = lastResponse.query
    const lastRole = lastResponse.role

    const confirmed = await confirm(
      'Removing the screenshot will clear the chat and rerun the chat message without the screenshot in the context. \n\nAre you sure you want to proceed?'
    )
    if (!confirmed) {
      return
    }

    log.debug('Rerunning chat message without screenshot', lastQuery)

    // Clear chat
    if (!$magicPage.chatId) {
      log.error('No chat found to clear')
      return
    }

    await clearChat($magicPage.chatId)

    await sendChatMessage(lastQuery, lastRole, undefined, true)
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

  // const runPrompt = async (promptType: PromptIDs) => {
  //   try {
  //     log.debug('Handling prompt submit', promptType)
  //     autoScrollChat = true

  //     const prompt = await getPrompt(promptType)

  //     await sendChatMessage(prompt.content, 'assistant', prompt.title)
  //   } catch (e) {
  //     log.error('Error doing magic', e)
  //   }
  // }

  const handleClearChat = async () => {
    log.debug('Clearing chat')

    if (!$magicPage.chatId) {
      log.error('No chat found to clear')
      return
    }

    const toast = toasts.loading('Clearing chat...')

    try {
      const messagesLength = $magicPage.responses.length

      await clearChat($magicPage.chatId)
      toast.success('Chat cleared!')

      await telemetry.trackPageChatClear(messagesLength)
    } catch (e) {
      log.error('Error clearing chat:', e)
      toast.error('Failed to clear chat')
    }
  }

  const handleClearContext = () => {
    for (const item of $contextItems) {
      if (item.type === 'tab') {
        dispatch('exclude-tab', item.data.id)
      } else {
        dispatch('remove-context-item', item.id)
      }
    }

    editor.focus()
  }

  const handlePickScreenshot = () => {
    dispatch('pick-screenshot')
  }

  const handleRemoveContextItem = (e: CustomEvent<string>) => {
    const id = e.detail
    const contextItem = $contextItems.find((item) => item.id === id)
    if (!contextItem) {
      log.error('Context item not found', id)
      return
    }

    if (contextItem.type === 'tab') {
      dispatch('exclude-tab', contextItem.data.id)
    } else {
      dispatch('remove-context-item', id)
    }
  }

  const handleSelectContextItem = async (e: CustomEvent<string>) => {
    const id = e.detail
    const contextItem = $contextItems.find((item) => item.id === id)
    if (!contextItem) {
      log.error('Context item not found', id)
      return
    }

    dispatch('open-context-item', contextItem)
  }

  const handleRetryContextItem = async (e: CustomEvent<string>) => {
    const id = e.detail
    const contextItem = $contextItems.find((item) => item.id === id)
    if (!contextItem) {
      log.error('Context item not found', id)
      return
    }

    dispatch('process-context-item', contextItem)
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
        // itemsInContext = $tabs.map((tab) => {
        //   return {
        //     type: 'tab',
        //     data: tab
        //   }
        // })
        handleChatSubmit()
      }
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

  const handleDrop = async (drag: DragculaDragEvent<DragTypes>) => {
    if (drag.isNative) {
      log.warn('Not yet implemented!')
    } else if (drag.item!.data.hasData(DragTypeNames.SURF_TAB)) {
      dispatch('include-tab', drag.item!.data.getData(DragTypeNames.SURF_TAB).id)
    } else if (drag.item!.data.hasData(DragTypeNames.SURF_SPACE)) {
      const space = drag.item!.data.getData(DragTypeNames.SURF_SPACE)

      dispatch('add-context-item', {
        item: {
          id: space.id,
          type: 'space',
          data: space
        },
        trigger: PageChatUpdateContextEventTrigger.DragAndDrop
      })
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

      dispatch('add-context-item', {
        item: {
          id: resource.id,
          type: 'resource',
          data: resource
        },
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

  function getItemsInContext(
    mode: 'general' | 'all' | 'active' | 'context',
    contextItems: ContextItem[],
    activeTab: Tab | null
  ) {
    let result: ContextItem[]
    switch (mode) {
      case 'general':
        result = []
        break
      case 'all':
        result = $tabs.map((tab) => {
          return {
            id: tab.id,
            type: 'tab',
            data: tab
          }
        })
        break
      case 'active':
        result = contextItems
        break
      case 'context':
        result = contextItems
        break
      default:
        result = []
    }

    return result
  }

  const isScreenshotNeededForPromptAndTab = async (prompt: string, tab: TabPage) => {
    try {
      const title = tab.title
      const url = tab.currentLocation || tab.currentDetectedApp?.canonicalUrl || tab.initialLocation

      const screenshotNeededRaw = await window.api.createAIChatCompletion(
        JSON.stringify({
          prompt: prompt,
          title: title,
          url: url
        }),
        CLASSIFY_SCREENSHOT_PROMPT,
        {
          model: 'gpt-4o-mini'
        }
      )

      if (!screenshotNeededRaw) {
        log.error('Error determining if a screenshot is needed')
        return false
      }

      const response = JSON.parse(screenshotNeededRaw)

      // log.debug('Screenshot needed response', response)

      // if (response.reason) {
      //   toasts.info(response.reason)
      // }

      /*
        Respond with the following format:

        ```json
        {
            "needsScreenshot": true,
            "reason": "The prompt refers to a specific part of the page, the hero section, that can only be seen visually."
        }
        ```

        Only respond with the JSON itself as a string, no Markdown or other formatting.
      */

      // return response.needsScreenshot

      return response
    } catch (e) {
      log.error('Error determining if a screenshot is needed', e)
      return false
    }
  }

  const generateExamplePromptsForPage = useDebounce(async (resourceId: string, tab: TabPage) => {
    generatingExamplePrompts.set(true)
    resourceToGeneratePromptsFor.set(resourceId)
    examplePrompts.set([])

    const resource = await resourceManager.getResource(resourceId)
    if (!(resource instanceof ResourceJSON)) {
      log.debug('No resource content')
      generatingExamplePrompts.set(false)
      resourceToGeneratePromptsFor.set(null)
      resourceToGeneratePromptsForState.set(null)
      return null
    }

    const resourceState = get(resource.state)
    resourceToGeneratePromptsForState.set(resourceState)
    if (resourceState !== 'idle') {
      log.debug('Resource is still extracting')
      generatingExamplePrompts.set(false)

      if (resourceState === 'extracting' || resourceState === 'post-processing') {
        const unsubscribe = resource.state.subscribe((state) => {
          resourceToGeneratePromptsForState.set(state)
          const processingUnsub = processingUnsubs.get(resourceId)
          if (processingUnsub) {
            processingUnsub()
            processingUnsubs.delete(resourceId)
          }

          if (state === 'idle') {
            generateExamplePromptsForPage(resourceId, tab)
          } else {
            resourceToGeneratePromptsFor.set(null)
            resourceToGeneratePromptsForState.set(null)
          }
        })

        processingUnsubs.set(resourceId, unsubscribe)
      }

      return null
    }

    const data = await resource.getParsedData()
    const content = WebParser.getResourceContent(resource?.type, data)

    log.debug('Generating prompts for page', tab.title, resource.id, content.plain?.length)
    const promptsRaw = await window.api.createAIChatCompletion(
      JSON.stringify({
        title: tab.title,
        url: tab.currentLocation,
        content: content.plain
      }),
      PAGE_PROMPTS_GENERATOR_PROMPT,
      {
        model: 'gpt-4o-mini'
      }
    )

    log.debug('Prompts raw', promptsRaw)

    if (!promptsRaw) {
      log.error('Failed to generate prompts')
      examplePrompts.set([])
      generatingExamplePrompts.set(false)
      resourceToGeneratePromptsFor.set(null)
      resourceToGeneratePromptsForState.set(null)
      return null
    }

    const prompts = JSON.parse(promptsRaw)
    const parsedPrompts = prompts.filter(
      (p: any) => p.label !== undefined && p.prompt !== undefined
    )

    log.debug('Generated prompts', parsedPrompts)

    examplePrompts.set(parsedPrompts)
    cachedPagePrompts.set(resource.id, parsedPrompts)
    await tick()
    generatingExamplePrompts.set(false)
  }, 600)

  const handleTabPromptGeneration = async (tab: TabPage) => {
    const resourceId = tab.chatResourceBookmark
    if (!resourceId) {
      log.debug('No chat resource bookmark')
      return null
    }

    const cachedPrompts = cachedPagePrompts.get(resourceId)
    if (cachedPrompts) {
      log.debug('Using cached prompts for page', tab.title, resourceId, cachedPrompts)
      examplePrompts.set(cachedPrompts)
      return
    }

    if ($resourceToGeneratePromptsFor === resourceId) {
      log.debug('Already generating/generated prompts for page', tab.title, resourceId)
      return
    }

    examplePrompts.set([])
    resourceToGeneratePromptsFor.set(null)
    resourceToGeneratePromptsForState.set(null)

    await generateExamplePromptsForPage(resourceId, tab)
  }

  const runPrompt = async (prompt: ExamplePrompt) => {
    try {
      log.debug('Handling prompt submit', prompt)
      autoScrollChat = true
      selectedMode = 'active'

      await sendChatMessage(prompt.prompt, 'user', prompt.label)
    } catch (e) {
      log.error('Error doing magic', e)
    }
  }

  const sendChatMessage = async (
    prompt: string,
    role: AIChatMessageRole = 'user',
    query?: string,
    skipScreenshot = false
  ) => {
    const chatId = $magicPage.chatId
    if (!chatId) {
      log.error('Error: Existing chat not found')
      return
    }

    errorMessage.set('')
    hasError.set(false)

    const itemsInContext = getItemsInContext(selectedMode, $contextItems, activeTab)
    if (itemsInContext.length === 0) {
      log.debug('No tabs in context, general chat:')
    } else {
      log.debug('Tabs in context:', itemsInContext)
    }

    let response: AIChatMessageParsed | null = null

    const tabsInContext = itemsInContext
      .filter((item) => item.type === 'tab')
      .map((item) => item.data)

    const generalMode = itemsInContext.length === 0
    const previousMessages = $magicPage.responses.filter(
      (message) => message.id !== (response?.id ?? '')
    )
    const numSpaces = generalMode
      ? 0
      : itemsInContext.filter(
          (item) => item.type === 'space' || (item.type === 'tab' && item.data.type === 'space')
        ).length
    const numResources = generalMode
      ? 0
      : itemsInContext.filter((item) => item.type === 'resource').length

    let contextSize = generalMode ? 0 : itemsInContext.length
    let usedInlineScreenshot = false
    let usedPageScreenshot = false

    const resourceIds: string[] = []
    const inlineImages: string[] = []

    try {
      const processSpace = async (spaceId: string) => {
        const spaceContents = await resourceManager.getSpaceContents(spaceId)
        if (spaceContents) {
          const filteredContents = spaceContents
            .filter((content) => content.manually_added !== SpaceEntryOrigin.Blacklisted)
            .map((content) => content.resource_id)

          resourceIds.push(...filteredContents)
        }
      }

      const processResource = async (resourceId: string, type: string) => {
        log.debug('Processing resource', resourceId, type)
        if (type === 'application/pdf') {
          resourceIds.push(resourceId)
        } else if (type.startsWith('image/')) {
          const resource = await resourceManager.getResource(resourceId)
          if (!resource) {
            log.error('Failed to get resource', resourceId)
            return
          }

          const blob = await resource?.getData()
          resource?.releaseData()
          if (blob) {
            const dataUrl = await blobToDataUrl(blob)
            inlineImages.push(dataUrl)
          }
        } else {
          resourceIds.push(resourceId)
        }
      }

      for (const item of itemsInContext) {
        log.debug('Processing context item', item)
        if (item.type === 'tab') {
          const tab = item.data
          if (tab.type === 'page' && tab.chatResourceBookmark) {
            resourceIds.push(tab.chatResourceBookmark)
          } else if (tab.type === 'space') {
            await processSpace(tab.spaceId)
          } else if (tab.type === 'resource') {
            await processResource(tab.resourceId, tab.resourceType)
          }
        } else if (item.type === 'screenshot') {
          inlineImages.push(await blobToDataUrl(item.data))
          usedInlineScreenshot = true
        } else if (item.type === 'resource') {
          await processResource(item.data.id, item.data.type)
        } else if (item.type === 'space') {
          await processSpace(item.data.id)
        }
      }

      const inlineScreenshots = itemsInContext.filter((item) => item.type === 'screenshot')
      if (inlineScreenshots.length === 0 && !skipScreenshot) {
        log.debug('No context images found, determining if a screenshot is needed')
        let tab = tabsInContext.find(
          (tab) => tab.id === tabsManager.activeTabIdValue && tab.type === 'page'
        )

        if (tab) {
          const screenshotNeeded = $userConfigSettings.always_include_screenshot_in_chat
            ? true
            : await isScreenshotNeededForPromptAndTab(query ?? prompt, tab as TabPage)
          log.debug('Screenshot needed:', screenshotNeeded)

          if (screenshotNeeded) {
            const browserTabs = tabsManager.browserTabsValue
            const browserTab = browserTabs[tab.id]
            if (browserTab) {
              log.debug('Taking screenshot of page', tab)
              const dataUrl = await browserTab.capturePage()
              log.debug('Adding screenshot as inline image to chat context', dataUrl)
              inlineImages.push(dataUrl)
              usedPageScreenshot = true
            }
          }
        } else {
          log.debug('Active tab not in context, skipping screenshot')
        }
      }

      if (!generalMode && resourceIds.length > 0) {
        contextSize = resourceIds.length + inlineImages.length
      }

      response = {
        id: generateID(),
        role: role,
        query: query ?? prompt,
        status: 'pending',
        usedPageScreenshot: usedPageScreenshot,
        usedInlineScreenshot: usedInlineScreenshot,
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
          inlineImages: inlineImages,
          general: resourceIds.length === 0
        }
      )

      updatePageMagicResponse(response.id, {
        status: 'success',
        content: content.replace('<answer>', '').replace('</answer>', '')
      })

      await telemetry.trackPageChatMessageSent({
        contextSize: contextSize,
        numTabs: tabsInContext.length,
        numSpaces: numSpaces,
        numResources: numResources,
        numScreenshots: inlineImages.length,
        numPreviousMessages: previousMessages.length,
        tookPageScreenshot: usedPageScreenshot,
        embeddingModel: $userConfigSettings.embedding_model
      })

      if (numSpaces > 0) {
        await telemetry.trackChatWithSpace()
      }
    } catch (e) {
      log.error('Error doing magic', e)
      let content = 'Failed to generate response.'

      if (typeof e === 'string' && e.toLowerCase().includes('Content is too long'.toLowerCase())) {
        content = 'The content is too long to process. Please try a more specific question.'
      }

      let error = PageChatMessageSentEventError.Other

      if (typeof e === 'string' && e.includes('RAG Empty Context')) {
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
        numTabs: tabsInContext.length,
        numSpaces: numSpaces,
        numResources: numResources,
        numScreenshots: inlineImages.length,
        numPreviousMessages: previousMessages.length,
        tookPageScreenshot: usedPageScreenshot,
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
    log.debug('Clearing chat', id)

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

  const closeOnboarding = async () => {
    onboardingOpen.set(false)

    const existingOnboardingSettings = window.api.getUserConfigSettings().onboarding
    await window.api.updateUserConfigSettings({
      onboarding: {
        ...existingOnboardingSettings,
        completed_chat: true
      }
    })
  }

  $: smallSize = inputValue.length < 75

  $: if ($showExamplePrompts) {
    const tab = $tabsInContext.find((tab) => tab.id === $activeTabId)
    if (tab && tab.type === 'page') {
      handleTabPromptGeneration(tab)
    }
  }
</script>

<!-- {#if $onboardingOpen}
  <Onboarding
    on:close={closeOnboarding}
    title="What you see is what you chat"
    tip="Tip: Hover over any element to see how it works."
    sections={[
      {
        description: `
          <p>
            Surf gives you high quality answers from the tabs, folders, and content you add to the
            "Context Window".
          </p>
          `,
        imgAlt: 'Context Window',
        iconName: 'chat',
        imgSrc: chatContextDemo
      },
      {
        title: 'Add Context',
        description: `
        <p>
            Use <kbd class="px-2 py-0.5 text-lg font-semibold text-gray-900 bg-white border border-gray-200 rounded-lg">+</kbd> to include an item in your
            chat.
          </p>
          <p class="opacity-70">
            Hint: you can also <kbd class="px-2 py-0.5 text-lg font-semibold text-gray-900 bg-white border border-gray-200 rounded-lg">${navigator.platform.startsWith('Mac') ? '⌘' : 'Ctrl'}</kbd> or <kbd class="px-2 py-1.5 text-xs font-semibold text-gray-900 bg-white border border-gray-200 rounded-lg">Shift</kbd>
            + click to
            select multiple items.
          </p>
          `,
        imgAlt: 'Add Context',
        iconName: 'add',
        imgSrc: chatAdd
      },
      {
        title: 'Remove Context',
        description: `
        <p>
            Remove an individual item by clicking it's own <kbd class="px-2 py-0.5 text-lg font-semibold text-gray-900 bg-white border border-gray-200 rounded-lg">x</kbd> button. Or clear the whole window to start fresh.
          </p>
          `,
        imgSrc: chatRemove,
        imgAlt: 'Remove Context',
        iconName: 'close'
      }
    ]}
    warning="Chat can make mistakes. Verify results."
    buttonText="Continue"
  />
{/if} -->

<div
  class="flex flex-col h-full relative overflow-hidden"
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
  {#if !$showFloatingClearChat}
    <div
      class="flex items-center justify-between gap-3 px-4 py-4 border-b-2 border-sky-100 dark:border-gray-800"
    >
      {#if $magicPage.responses.length > 0}
        <button
          class="flex items-center gap-2 p-2 rounded-lg opacity-60 hover:bg-blue-200 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100"
          on:click={() => {
            handleClearChat()
          }}
        >
          <Icon name="add" />
          New Chat
        </button>
      {:else}
        <div
          class="flex items-center justify-start text-lg p-1.5 font-semibold text-gray-900 dark:text-gray-100"
        >
          Chat <button
            class="flex items-center gap-2 p-2 ml-2 rounded-lg opacity-60 hover:bg-blue-200 dark:hover:bg-gray-800"
            on:click={() => {
              $onboardingOpen = true
            }}
            use:tooltip={{
              text: 'Need help?',
              position: 'bottom'
            }}
          >
            <Icon name="info" />
          </button>
        </div>
      {/if}

      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      {#if !horizontalTabs}
        <div
          role="button"
          tabindex="0"
          on:click={() => dispatch('close-chat')}
          class="flex items-center gap-2 p-1 text-sky-800/50 dark:text-sky-100/50 rounded-lg hover:bg-sky-100 dark:hover:bg-gray-800 hover:text-sky-800 dark:hover:text-sky-100 group cursor-pointer"
        >
          <Icon name="sidebar.right" class="group-hover:hidden" size="20px" />
          <Icon name="close" class="hidden group-hover:block" size="20px" />
        </div>
      {/if}
    </div>
  {/if}
  <div
    class="flex flex-col overflow-auto h-full pb-60 pt-2 overflow-x-hidden"
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
                class="font-medium bg-sky-100 dark:bg-gray-800 border-sky-200 dark:border-gray-800 text-gray-900 dark:text-gray-50 border-1 p-4 rounded-xl w-fit mb-2"
              >
                <div class="flex items-start gap-2">
                  <div class="icon mt-0.5 bg-sky-50 rounded-full p-1">
                    <Icon name="user" />
                  </div>

                  <div class="query">
                    {#if response.role === 'user'}
                      <MarkdownRenderer content={response.query} id={response.id} />
                    {:else}
                      {sanitizeQuery(response.query)}
                    {/if}
                  </div>
                </div>

                <!-- {#if response.usedPageScreenshot}
                  <div class="flex items-center gap-1 group/screenshot">
                    <div class="w-4 h-4 text-gray-600">
                      <FileIcon kind="image" />
                    </div>
                    <span class="text-gray-600 font-normal text-base"
                      >Used screenshot as additional context</span
                    >
                    <button
                      use:tooltip={{ text: 'Rerun without screenshot', position: 'left' }}
                      on:click={() => rerunChatMessageWithoutScreenshot()}
                      class="text-gray-600 hover:text-gray-700 opacity-0 group-hover/screenshot:opacity-100"
                    >
                      <Icon name="close" size="16px" />
                    </button>
                  </div>
                {/if} -->
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
              class="flex-row items-center mx-auto space-x-2 hidden group-hover:flex absolute text-sm -bottom-2 left-1/2 -translate-x-1/2 transition-all duration-300 ease-in-out"
            >
              {#if $savedChatResponses[response.id]}
                <button
                  on:click={() => openResponseResource(response.id)}
                  use:tooltip={{
                    text: 'Open as tab',
                    position: 'left'
                  }}
                  class="transform active:scale-95 appearance-none border-[0.5px] border-gray-500/50 group margin-0 flex items-center gap-2 py-2 px-3 bg-sky-200 dark:bg-gray-800 hover:bg-sky-100 dark:hover:bg-gray-800/50 transition-colors duration-200 rounded-xl text-sky-800 dark:text-gray-100 cursor-pointer"
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
                  class="transform active:scale-95 appearance-none border-[0.5px] border-gray-500/50 group margin-0 flex items-center gap-2 py-2 px-3 bg-blue-50 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-gray-800/50 transition-colors duration-200 rounded-xl text-sky-800 dark:text-gray-100 cursor-pointer"
                >
                  <Icon name="save" />
                  Save
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
                class="transform active:scale-95 appearance-none border-[0.5px] border-gray-500/50 group margin-0 flex items-center py-2.5 px-2.5 bg-blue-50 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-gray-800/50 transition-colors duration-200 rounded-xl text-sky-800 dark:text-gray-100 cursor-pointer"
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
                class="font-medium bg-sky-100 dark:bg-gray-800 border-sky-200 dark:border-gray-800 border-1 p-4 rounded-xl w-fit mb-2 text-gray-900 dark:text-gray-100"
              >
                <div class="flex items-start gap-2">
                  <div class="icon mt-0.5 bg-sky-50 rounded-full p-1">
                    <Icon name="user" />
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
          class="flex flex-col bg-yellow-50 dark:bg-gray-800 border-yellow-300 dark:border-gray-800 border-[1px] p-4 pr-12 mx-4 gap-4 shadow-sm rounded-xl text-lg leading-relaxed text-yellow-800 dark:text-gray-100 relative"
        >
          {#each $magicPage.errors as error}
            <div class="info-box">
              <Icon name="alert-triangle" />
              <p>Warning: {error}</p>
            </div>
          {/each}

          <button
            class="absolute top-3 right-3 text-yellow-800 dark:text-gray-100 hover:text-yellow-600 dark:hover:text-gray-100"
            on:click={() => magicPage.update((v) => ({ ...v, errors: [] }))}
          >
            <Icon name="close" />
          </button>
        </div>
      {/if}

      {#if $hasError}
        <div
          class="flex flex-col bg-yellow-50 dark:bg-gray-800 border-yellow-300 dark:border-gray-800 border-[1px] p-4 pr-12 mx-4 gap-4 shadow-sm rounded-xl text-lg leading-relaxed text-yellow-800 dark:text-gray-100 relative"
        >
          {$errorMessage}
          <button
            class="absolute top-5 right-4 text-yellow-800 dark:text-gray-100 hover:text-yellow-600 dark:hover:text-gray-100"
            on:click={() => hasError.set(false)}
          >
            <Icon name="close" />
          </button>
        </div>
      {/if}
    {:else}
      <div class="flex flex-col items-center justify-center empty text-gray-900 dark:text-gray-100">
        <div class="empty-title" style="line-height: 1;">
          <Icon name="chat" />
          <h1>New Chat</h1>
        </div>

        <p class="text-sky-900 dark:text-gray-100">
          Ask questions about specific tabs or start a general conversation.
        </p>
        <p class="text-sky-900/60 dark:text-gray-100/60">
          Use the + icon or select tabs from the tab bar to add context.
          <!-- Select tabs with the + Icon or by selecting them from the tab bar.( {#if navigator.platform
            .toLowerCase()
            .indexOf('mac') > -1}⌘{:else}Ctrl{/if} + click or Shift + click ). -->
        </p>
      </div>
    {/if}
  </div>

  <div
    class="chat bg-gradient-to-t from-sky-300/20 via-sky-300/10 dark:from-gray-800/20 dark:via-gray-800/10 to-transparent mx-auto absolute w-full bottom-0 rounded-xl flex flex-col shadow-xl pb-2"
  >
    {#if $showFloatingClearChat && !$magicPage.running && $magicPage.responses.length >= 1}
      <button
        transition:flyAndScale={{ duration: 125, y: 22 }}
        on:click={() => {
          if (!$magicPage.running) {
            handleClearChat()
          }
        }}
        class="transform mb-4 active:scale-95 appearance-none w-fit mx-auto border-[0.5px] border-sky-900/10 group margin-0 flex items-center px-3 py-2 bg-sky-100 dark:bg-gray-800 hover:bg-sky-200 dark:hover:bg-gray-800 transition-colors duration-200 rounded-xl text-sky-800 dark:text-gray-100 cursor-pointer text-xs"
      >
        {#if navigator.platform.toLowerCase().indexOf('mac') > -1}
          Clear Chat
        {:else}
          Clear Chat
        {/if}
      </button>
    {/if}

    <div class="overflow-hidden">
      {#if $showExamplePrompts && $resourceToGeneratePromptsFor !== null && $resourceToGeneratePromptsForState === 'idle'}
        <div
          transition:fly={{ y: 200 }}
          class="flex items-center gap-2 pl-8 pr-8 mb-3 w-full overflow-auto no-scrollbar z-0"
        >
          <div class="text-sky-800 dark:text-gray-100">
            <Icon name="sparkles" />
          </div>

          {#each $filteredBuiltInPrompts as prompt (prompt.prompt.replace(/[^a-zA-Z0-9]/g, ''))}
            <PromptItem on:click={() => runPrompt(prompt)} label={prompt.label} />
          {/each}

          {#if $generatingExamplePrompts}
            <PromptItem label="Analysing Page…" icon="spinner" />
          {:else if $filteredExamplePrompts.length > 0}
            {#each $filteredExamplePrompts as prompt (prompt.prompt.replace(/[^a-zA-Z0-9]/g, ''))}
              <PromptItem on:click={() => runPrompt(prompt)} label={prompt.label} />
            {/each}
          {/if}
        </div>
      {/if}
    </div>

    {#if $magicPage.initializing}
      <div
        transition:slide={{ duration: 150, axis: 'y' }}
        class="err flex flex-col bg-blue-50 dark:bg-gray-800 border-t-blue-300 dark:border-t-gray-700 border-l-blue-300 dark:border-l-gray-700 border-r-blue-300 dark:border-r-gray-700 border-[1px] border-b-0 py-2 px-4 gap-4 shadow-sm mx-8 rounded-t-xl text-lg leading-relaxed text-blue-800/60 dark:text-gray-100/60 relative"
      >
        Preparing tabs for the chat…
      </div>
    {:else if $contextItems.length}
      {#if !$optToggled}
        <div
          class="flex flex-col bg-blue-50 dark:bg-gray-800 border-t-blue-300 dark:border-t-gray-700 border-l-blue-300 dark:border-l-gray-700 border-r-blue-300 dark:border-r-gray-700 border-[1px] border-b-0 py-2 px-4 gap-4 shadow-sm mx-8 rounded-t-xl text-lg leading-relaxed text-blue-800/60 dark:text-gray-100/60 relative"
          transition:slide={{ duration: 150, axis: 'y', delay: 350 }}
          data-tooltip-target="context-bar"
        >
          <div class=" flex-row items-center gap-2 flex">
            <ContextBubbles
              items={$contextItems.slice(0, 10)}
              on:select={handleSelectContextItem}
              on:remove-item={handleRemoveContextItem}
              on:retry={handleRetryContextItem}
            />
            {#if $contextItems.length > 0}
              <button
                class="flex items-center gap-2 p-2 text-sm rounded-lg opacity-60 hover:bg-blue-200 dark:hover:bg-gray-800"
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
      class="flex bg-sky-50 dark:bg-gray-700 border-blue-300 dark:border-gray-600 border-[1px] px-4 py-3 gap-2 shadow-lg mx-4"
      class:rounded-2xl={smallSize}
      class:rounded-xl={!smallSize}
      class:flex-col={!smallSize}
      class:items-center={smallSize}
      on:keydown={handleInputKeydown}
      on:keyup={handleInputKeyup}
    >
      <div class="flex-grow overflow-y-auto max-h-64">
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
            {contextItems}
            tabs={contextPickerTabs}
            on:include-tab
            on:add-context-item
            on:close={() => {
              $tabPickerOpen = false
              if (editor) {
                editor.focus()
              }
            }}
          />
        {/if}

        <button
          class="transform whitespace-nowrap active:scale-95 disabled:opacity-10 appearance-none border-0 group margin-0 flex items-center px-2 py-2 hover:bg-sky-200 dark:hover:bg-gray-800 transition-colors duration-200 rounded-xl text-sky-1000 dark:text-gray-100 cursor-pointer text-sm"
          on:click={handlePickScreenshot}
          use:tooltip={{
            text: 'Add Screenshot',
            position: 'left'
          }}
        >
          <Icon name="screenshot" className="opacity-60" />
        </button>

        <button
          disabled={$tabs.filter((e) => !$tabsInContext.includes(e)).length <= 0}
          popovertarget="chat-add-context-tabs"
          class="open-tab-picker disabled:opacity-40 disabled:cursor-not-allowed transform whitespace-nowrap active:scale-95 appearance-none border-0 group margin-0 flex items-center px-2 py-2 hover:bg-sky-200 dark:hover:bg-gray-800 transition-colors duration-200 rounded-xl text-sky-1000 dark:text-gray-100 cursor-pointer text-sm"
          on:click={(e) => {
            $tabPickerOpen = !$tabPickerOpen
          }}
          use:tooltip={{
            text: 'Add tab',
            position: 'left'
          }}
        >
          <Icon name={'add'} size={'18px'} className="opacity-60" />
        </button>

        <button
          class="transform whitespace-nowrap active:scale-95 disabled:opacity-10 appearance-none border-0 group margin-0 flex items-center px-2 py-2 bg-sky-300 dark:bg-gray-800 hover:bg-sky-200 dark:hover:bg-gray-800 transition-colors duration-200 rounded-xl text-sky-1000 dark:text-gray-100 cursor-pointer text-sm"
          on:click={() => {
            selectedMode = 'active'
            handleChatSubmit()
          }}
          data-tooltip-action="send-chat-message"
          data-tooltip-target="send-chat-message"
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

  :global(#magic-chat[data-drag-target]) {
    outline: 2px dashed gray;
    outline-offset: -2px;
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
