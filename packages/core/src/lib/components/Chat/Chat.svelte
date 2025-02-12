<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte'
  import { derived, writable } from 'svelte/store'
  import { fade, fly, slide } from 'svelte/transition'

  import {
    htmlToMarkdown,
    tooltip,
    truncate,
    useClipboard,
    useLogScope,
    parseUrlIntoCanonical,
    codeLanguageToMimeType,
    isMac
  } from '@horizon/utils'
  import { Icon } from '@horizon/icons'
  import { DragculaDragEvent, HTMLDragItem, HTMLDragZone } from '@horizon/dragcula'
  import { Editor, getEditorContentText, MentionItemType } from '@horizon/editor'
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
  import type { App } from '@horizon/backend/types'

  import type {
    AIChatMessageParsed,
    AIChatMessageRole,
    JumpToWebviewTimestampEvent,
    HighlightWebviewTextEvent
  } from '../../types/browser.types'
  import { DragTypeNames, SpaceEntryOrigin, type DragTypes } from '../../types'

  import { Resource, ResourceTag, useResourceManager } from '../../service/resources'
  import { useToasts } from '../../service/toast'
  import { useConfig } from '../../service/config'
  import { useTabsManager } from '../../service/tabs'
  import { useGlobalMiniBrowser } from '@horizon/core/src/lib/service/miniBrowser'
  import { AIChat, useAI, type ChatPrompt } from '@horizon/core/src/lib/service/ai/ai'

  import ChatMessageMarkdown from './ChatMessageMarkdown.svelte'
  import ContextBubbles from './ContextBubbles.svelte'
  import ChatContextTabPicker from './ChatContextTabPicker.svelte'
  import { BUILT_IN_PAGE_PROMPTS } from '../../constants/prompts'
  import FileIcon from '../Resources/Previews/File/FileIcon.svelte'
  import PromptItem from './PromptItem.svelte'
  import { SelectDropdown, SelectDropdownItem, type SelectItem } from '../Atoms/SelectDropdown'
  import { type ContextItem } from '@horizon/core/src/lib/service/ai/contextManager'
  import { openDialog } from '../Core/Dialog/Dialog.svelte'
  import { useOasis } from '@horizon/core/src/lib/service/oasis'
  import CreateAiToolDialog from './CreateAiToolDialog.svelte'
  import { quartOut } from 'svelte/easing'
  import { contextMenu } from '../Core/ContextMenu.svelte'
  import {
    populateRenderAndChunkIds,
    renderIDFromCitationID,
    useEditorSpaceMentions
  } from '@horizon/core/src/lib/service/ai/helpers'
  import type { CitationInfo } from '@horizon/core/src/lib/components/Chat/CitationItem.svelte'
  import { MODEL_CLAUDE_MENTION, MODEL_GPT_MENTION } from '@horizon/core/src/lib/constants/chat'
  import { Provider } from '@horizon/types/src/ai.types'
  import ModelPicker from './ModelPicker.svelte'

  export let chat: AIChat
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
  const config = useConfig()
  const tabsManager = useTabsManager()
  const oasis = useOasis()
  const ai = useAI()
  const globalMiniBrowser = useGlobalMiniBrowser()

  const tabs = tabsManager.tabs
  const userConfigSettings = config.settings
  const telemetry = resourceManager.telemetry
  const activeTabId = tabsManager.activeTabId
  const customAIApps = ai.customAIApps

  const { contextManager, contextItems, status, error } = chat
  const { tabsInContext, generatingPrompts, generatedPrompts } = contextManager

  $: responses = chat.responses

  const optPressed = writable(false)
  const cmdPressed = writable(false)
  const shiftPressed = writable(false)
  const aPressed = writable(false)
  const optToggled = writable(false)
  const tabPickerOpen = writable(false)
  const promptSelectorOpen = writable(false)
  const savedChatResponses = writable<Record<string, string>>({})

  let listElem: HTMLDivElement
  let editorFocused = false
  let editor: Editor
  let autoScrollChat = true
  let showAddPromptDialog = false
  const appModalContent = writable<App | null>(null)

  const addPromptItem = {
    id: 'addprompt',
    label: 'Add Prompt',
    icon: 'add'
  } as SelectItem

  const promptItems = derived([ai.customAIApps], ([customAiApps]) => {
    return customAiApps.map(
      (app) =>
        ({
          id: app.id,
          label: app.name,
          icon: app.icon
        }) as SelectItem
    )
  })

  const visibleContextItems = derived([contextItems], ([$contextItems]) => {
    return $contextItems.filter((item) => item.visibleValue)
  })

  $: chatBoxPlaceholder = derived(
    [responses, visibleContextItems, tabs],
    ([$responses, $visibleContextItems, $tabs]) => {
      if ($visibleContextItems.length === 0) return 'Ask me anything...'
      if ($responses.length >= 1) return 'Ask a follow up...'
      if ($visibleContextItems.length === $tabs.length) return 'Ask anything about all tabs...'
      return `Ask anything about ${$visibleContextItems.length} ${
        $visibleContextItems.length === 1 ? 'tab' : 'tabs'
      }...`
    }
  )

  const contextPickerTabs = derived([tabs, tabsInContext], ([tabs, tabsInContext]) => {
    return tabs
      .filter((e) => !tabsInContext.find((i) => i.id === e.id))
      .sort((a, b) => b.index - a.index)
  })

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

  $: filteredExamplePrompts = derived(
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

  $: filteredBuiltInPrompts = derived([responses], ([$responses]) => {
    return BUILT_IN_PAGE_PROMPTS.filter((prompt) => {
      return !$responses.find(
        (response) => response.query === prompt.prompt || response.query === prompt.label
      )
    })
  })

  const mentionItems = useEditorSpaceMentions(oasis, ai)

  export const updateChatInput = (text: string, focus = true) => {
    inputValue = text
    editor.setContent(text)

    if (focus) {
      editor.focus()
      editor.focusEnd()
    }
  }

  export const insertQueryIntoChat = async (query: string) => {
    inputValue = query
    editor.setContent(inputValue)
    editor.focus()
  }

  export const addChatWithQuery = async (query: string) => {
    const value = '<blockquote>' + query + '</blockquote>' + '<p></p>'
    updateChatInput(value)
  }

  const openModelSettings = () => {
    // window.api.openSettings('ai')
    window.api.openSettings()
  }

  const handleShowOnboarding = () => {
    dispatch('open-onboarding')
  }

  const convertChatOutputToNote = async (response: AIChatMessageParsed) => {
    let content = response.content
    log.debug('Parsing response content', response, content)

    const sources = populateRenderAndChunkIds(response.sources)

    const element = document.getElementById(`chat-response-${response.id}`)
    if (!element) {
      log.debug('No element found for response', response)
      return null
    }

    const html = element.innerHTML
    const domParser = new DOMParser()
    const doc = domParser.parseFromString(html, 'text/html')

    const getInfo = (id: string) => {
      const renderID = renderIDFromCitationID(id, sources)
      const source = sources?.find((source) => source.render_id === renderID)

      return { id, source, renderID } as CitationInfo
    }

    const citations = doc.querySelectorAll('citation')

    // loop through the citations and replace them with the citation item
    citations.forEach((citation) => {
      const id = citation.textContent
      if (!id) return

      const info = getInfo(id)
      citation.setAttribute('id', info.renderID)
      citation.setAttribute('data-info', encodeURIComponent(JSON.stringify(info)))
      citation.innerHTML = info.renderID
    })

    const replaceWithResource = (node: Element, resourceId: string, type: string) => {
      const newCodeBlock = document.createElement('resource')

      newCodeBlock.setAttribute('id', resourceId)
      newCodeBlock.setAttribute('data-type', type)
      newCodeBlock.innerHTML = ''

      node.replaceWith(newCodeBlock)
    }

    const codeBlocksRes = doc.querySelectorAll('code-block')
    const codeBlocks = Array.from(codeBlocksRes)

    for await (const codeBlock of codeBlocks) {
      try {
        const resourceId = codeBlock.getAttribute('data-resource')
        const language = codeBlock.getAttribute('data-language') ?? 'plaintext'
        const type = codeLanguageToMimeType(language)
        if (resourceId) {
          replaceWithResource(codeBlock, resourceId, type)
          continue
        }

        const pre = codeBlock.querySelector('pre')
        if (!pre) continue

        const code = pre.textContent
        if (!code) continue

        const name = codeBlock.getAttribute('data-name') ?? undefined
        const tab = tabsManager.activeTabValue
        const rawUrl = tab?.type === 'page' ? tab.currentLocation || tab.initialLocation : undefined
        const url = (rawUrl ? parseUrlIntoCanonical(rawUrl) : undefined) || undefined
        // todo: create resource with code
        log.debug('Creating resource for', language, { code })

        const resource = await resourceManager.findOrCreateCodeResource(
          {
            code,
            name,
            language,
            url: url
          },
          undefined,
          [ResourceTag.silent()]
        )

        log.debug('Created resource', resource)

        replaceWithResource(codeBlock, resource.id, resource.type)
      } catch (e) {
        log.error('Error creating code resource', e)
      }
    }

    // remove html comments like <!--  -->
    doc.querySelectorAll('comment').forEach((comment) => {
      comment.remove()
    })

    return doc.body.innerHTML
  }

  const saveResponseOutput = async (response: AIChatMessageParsed) => {
    log.debug('Saving chat response')

    const content = await convertChatOutputToNote(response)
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
      const items = (mentions ?? [])
        .filter((mention) => mention.type !== MentionItemType.MODEL)
        .map((mention) => mention.id)

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
          chat.selectProviderModel(Provider.Anthropic)
        } else if (modelMention.id === MODEL_GPT_MENTION.id) {
          chat.selectProviderModel(Provider.OpenAI)
        } else {
          const modelId = modelMention.id.replace('model-', '')
          chat.selectModel(modelId)
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
          chat.selectedModelId
        )

        chat.selectModel(null)

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

  const scrollToBottom = () => {
    if (!autoScrollChat) return
    if (listElem) {
      listElem.scrollTop = listElem.scrollHeight
    }
  }

  const handleListWheel = (e: WheelEvent) => {
    autoScrollChat = false
  }

  const handleClearContext = () => {
    contextManager.clear(PageChatUpdateContextEventTrigger.ChatAddContextMenu)
    editor.focus()
  }

  const handleRemoveContextItem = (e: CustomEvent<string>) => {
    const id = e.detail
    log.debug('Removing context item', id)
    contextManager.removeContextItem(id, PageChatUpdateContextEventTrigger.ChatContextItem)
  }

  const handleSelectContextItem = async (e: CustomEvent<string>) => {
    const id = e.detail
    const contextItem = contextManager.getItem(id)
    if (!contextItem) {
      log.error('Context item not found', id)
      return
    }

    dispatch('open-context-item', contextItem)
  }

  const handleRetryContextItem = async (e: CustomEvent<string>) => {
    const id = e.detail
    log.debug('Retrying context item', id)
    const contextItem = contextManager.getItem(id)
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
    await chat.sendMessageAndHandle(prompt, {
      trigger: PageChatMessageSentEventTrigger.SidebarChat,
      useContext: selectedMode !== 'general',
      role,
      query,
      skipScreenshot
    })
  }

  const clearChat = async () => {
    log.debug('Clearing chat')

    dispatch('clear-chat')

    await tick().then(() => {
      editor?.focus()
    })
  }

  $: smallSize = inputValue.length < 75
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
  {#if showAddPromptDialog}
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
  {/if}

  {#if !inputOnly}
    <div
      id="chat-responses-{chat.id}"
      class="flex flex-col overflow-auto h-full pb-60 pt-2 overflow-x-hidden"
      bind:this={listElem}
      on:wheel|passive={handleListWheel}
    >
      {#if $responses.length > 0}
        {#each $responses as response, idx (response.id)}
          {#if response.status === 'success'}
            <div
              class="response-wrapper text-lg flex flex-col gap-2 rounded-xl p-4 text-opacity-90 group relative"
            >
              <div class="">
                <div
                  class="font-medium bg-sky-100 dark:bg-gray-800 border-sky-200 dark:border-gray-800 text-gray-900 dark:text-gray-50 border-1 p-3 rounded-xl w-fit mb-2"
                >
                  <div class="flex items-start gap-2.5">
                    <div class="icon mt-0.5 bg-sky-50 dark:bg-gray-700 rounded-full p-1.5">
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
                class="flex-row items-center mx-auto space-x-2 hidden group-hover:!flex absolute text-sm -bottom-2 left-1/2 -translate-x-1/2 transition-all duration-300 ease-in-out"
              >
                {#if $savedChatResponses[response.id]}
                  <button
                    on:click={() => openResponseResource(response.id)}
                    use:tooltip={{
                      text: 'Open as tab',
                      position: 'left'
                    }}
                    class="transform active:scale-95 appearance-none border-[0.5px] border-gray-500/50 group margin-0 flex items-center gap-2 py-2 px-3 bg-sky-200 dark:bg-gray-800 hover:bg-sky-100 dark:hover:bg-gray-800/50 transition-colors duration-200 rounded-xl text-sky-800 dark:text-gray-100"
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
                    class="transform active:scale-95 appearance-none border-[0.5px] border-gray-500/50 group margin-0 flex items-center gap-2 py-2 px-3 bg-blue-50 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-gray-800/50 transition-colors duration-200 rounded-xl text-sky-800 dark:text-gray-100"
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
                  class="transform active:scale-95 appearance-none border-[0.5px] border-gray-500/50 group margin-0 flex items-center py-2.5 px-2.5 bg-blue-50 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-gray-800/50 transition-colors duration-200 rounded-xl text-sky-800 dark:text-gray-100"
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
              on:click={() => error.set(null)}
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

          <p class="text-sky-900 dark:text-gray-100 max-w-[520px]">
            Use the + icon next to the chat input to add your tabs or contexts to the chat.
          </p>
          <p class="text-sky-900/60 dark:text-gray-100/60">
            Pro tip: use the Vision Tool ({isMac() ? '⌘' : 'ctrl'} + shift + 1) to add screenshots to
            the chat.
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

  <div
    class="chat bg-gradient-to-t from-sky-300/20 via-sky-300/10 dark:from-gray-800/20 dark:via-gray-800/10 to-transparent mx-auto absolute w-full bottom-0 rounded-xl flex flex-col shadow-xl pb-2"
    style:view-transition-name="chat-{chat.id}-input"
  >
    <div class="overflow-hidden suggestion-items flex items-center">
      <div
        in:fly={{ y: 200 }}
        class="flex items-center gap-2 pl-8 pr-8 mb-3 w-full z-0 overflow-auto no-scrollbar"
      >
        <SelectDropdown
          items={promptItems}
          search="disabled"
          selected={null}
          footerItem={addPromptItem}
          open={promptSelectorOpen}
          side="top"
          closeOnMouseLeave={false}
          keepHeightWhileSearching
          on:select={(e) => {
            if (e.detail === addPromptItem.id) {
              appModalContent.set(null)
              showAddPromptDialog = true
              return
            }
            const app = $customAIApps.find((app) => app.id === e.detail)
            if (!app) return
            runPrompt(
              {
                label: app.name ?? '',
                prompt: (app.content || app.name) ?? ''
              },
              true
            )
          }}
        >
          <button
            use:tooltip={{
              text: 'Add a Prompt',
              position: 'right',
              disabled: $promptItems.length > 0
            }}
            class="flex-shrink-0 max-w-64 flex items-center justify-center gap-1 {$promptItems.length >
              0 ||
            !(
              $showExamplePrompts &&
              ($filteredBuiltInPrompts.length > 0 ||
                $filteredExamplePrompts.length > 0 ||
                $generatingPrompts)
            )
              ? 'px-2 py-1'
              : 'px-1.5 py-1.5 aspect-square'} w-fit rounded-xl transition-colors text-sky-800 bg-blue-50 border-blue-300 dark:border-gray-700 dark:text-gray-100 hover:bg-blue-100 dark:bg-gray-800 dark:hover:bg-gray-700 border-[1px] select-none"
            on:click={(e) => {
              if ($promptItems.length === 0) {
                e.preventDefault()
                e.stopPropagation()
                appModalContent.set(null)
                showAddPromptDialog = true
              }
            }}
          >
            {#if $promptItems.length > 0}
              {#if $promptSelectorOpen}
                <Icon name="chevron.up" />
              {:else}
                <Icon name="chevron.down" />
              {/if}
              <div class="text-sky-800 dark:text-gray-100 w-full truncate font-medium">Saved</div>
            {:else}
              {#if $promptSelectorOpen}
                <Icon name="close" />
              {:else}
                <Icon name="add" />
              {/if}

              {#if !($showExamplePrompts && ($filteredBuiltInPrompts.length > 0 || $filteredExamplePrompts.length > 0 || $generatingPrompts))}
                Add Prompt
              {/if}
            {/if}
          </button>

          <div
            slot="item"
            class="w-full"
            let:item
            use:contextMenu={{
              canOpen: item?.data,
              items: [
                {
                  type: 'action',
                  text: 'Edit',
                  icon: 'edit',
                  action: () => {
                    const app = $customAIApps.find((app) => app.id === item.id)
                    if (!app) return
                    appModalContent.set(app)
                    showAddPromptDialog = true
                  }
                },
                {
                  type: 'action',
                  kind: 'danger',
                  text: 'Delete',
                  icon: 'trash',
                  action: async () => {
                    if (!item) return
                    const { closeType: confirmed } = await openDialog({
                      message: `Are you sure you want to delete the prompt "${item.label}"?`
                    })
                    if (confirmed) ai.deleteCustomAiApp(item.id)
                    promptSelectorOpen.set(true)
                  }
                }
              ]
            }}
          >
            <SelectDropdownItem {item} />
          </div>
        </SelectDropdown>

        {#if $showExamplePrompts && ($filteredBuiltInPrompts.length > 0 || $filteredExamplePrompts.length > 0 || $generatingPrompts)}
          {#each $filteredBuiltInPrompts as prompt (prompt.prompt.replace(/[^a-zA-Z0-9]/g, ''))}
            <PromptItem on:click={() => runPrompt(prompt)} label={prompt.label} />
          {/each}

          {#if $generatingPrompts}
            <PromptItem label="Analysing Page…" icon="spinner" />
          {:else if $filteredExamplePrompts.length > 0}
            {#each $filteredExamplePrompts as prompt (prompt.prompt.replace(/[^a-zA-Z0-9]/g, ''))}
              <PromptItem on:click={() => runPrompt(prompt)} label={prompt.label} />
            {/each}
          {/if}
        {/if}
      </div>
    </div>

    {#if showContextBar}
      {#if preparingTabs}
        <div
          transition:slide={{ duration: 150, axis: 'y' }}
          class="err flex flex-col bg-blue-50 dark:bg-gray-800 border-t-blue-300 dark:border-t-gray-700 border-l-blue-300 dark:border-l-gray-700 border-r-blue-300 dark:border-r-gray-700 border-[1px] border-b-0 py-2 px-4 gap-4 shadow-sm mx-8 rounded-t-xl text-lg leading-relaxed text-blue-800/60 dark:text-gray-100/60 relative"
        >
          Preparing tabs for the chat…
        </div>
      {:else if $visibleContextItems.length}
        {#if !$optToggled}
          <div
            class="flex flex-col bg-blue-50 dark:bg-gray-800 border-t-blue-300 dark:border-t-gray-700 border-l-blue-300 dark:border-l-gray-700 border-r-blue-300 dark:border-r-gray-700 border-[1px] border-b-0 py-2 px-4 gap-4 shadow-sm mx-8 rounded-t-xl text-lg leading-relaxed text-blue-800/60 dark:text-gray-100/60 relative"
            transition:slide={{ duration: 150, axis: 'y', delay: 350 }}
            data-tooltip-target="context-bar"
          >
            <div class=" flex-row items-center gap-2 flex">
              <ContextBubbles
                {contextManager}
                on:select={handleSelectContextItem}
                on:remove-item={handleRemoveContextItem}
                on:retry={handleRetryContextItem}
              />
              {#if $visibleContextItems.length > 0}
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
    {/if}

    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="chat-input-wrapper flex bg-sky-50 dark:bg-gray-700 border-blue-300 dark:border-gray-600 border-[1px] px-4 py-3 gap-2 shadow-lg mx-4"
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
          submitOnEnter
          parseMentions
          mentionItems={$mentionItems}
          placeholder={$chatBoxPlaceholder}
        />
      </div>

      <div class="flex items-center gap-2 relative justify-end">
        {#if $tabPickerOpen}
          <ChatContextTabPicker
            tabs={contextPickerTabs}
            {contextManager}
            on:close={() => {
              $tabPickerOpen = false
              if (editor) {
                editor.focus()
              }
            }}
          />
        {/if}

        {#if showAddToContext}
          <button
            disabled={$tabs.filter((e) => !$tabsInContext.includes(e)).length <= 0}
            popovertarget="chat-add-context-tabs"
            class="open-tab-picker disabled:opacity-40 disabled:cursor-not-allowed transform whitespace-nowrap active:scale-95 appearance-none border-0 group margin-0 flex items-center px-2 py-2 hover:bg-sky-200 dark:hover:bg-gray-800 transition-colors duration-200 rounded-xl text-sky-1000 dark:text-gray-100 text-sm"
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
        {/if}

        <!-- <SelectDropdown
          items={modelItems}
          search="disabled"
          selected={$selectedModelItem ? $selectedModelItem.id : null}
          footerItem={selectConfigureItem}
          open={modelSelectorOpen}
          side="top"
          closeOnMouseLeave={false}
          keepHeightWhileSearching
          on:select={handleModelSelect}
        >
          <button
            class="transform whitespace-nowrap active:scale-95 disabled:opacity-10 appearance-none border-0 group margin-0 flex items-center px-2 py-2 hover:bg-sky-200 dark:hover:bg-gray-800 transition-colors duration-200 rounded-xl text-sky-1000 dark:text-gray-100 text-sm"
          >
            {#if $selectedModelItem}
              <Icon name={$selectedModelItem.icon} />
            {:else}
              <Icon name="settings" className="opacity-60" />
            {/if}
          </button>
        </SelectDropdown> -->

        <ModelPicker />

        <button
          class="submit-button transform whitespace-nowrap active:scale-95 disabled:opacity-30 appearance-none border-0 group margin-0 flex items-center px-2 py-2 bg-sky-300 dark:bg-gray-800 hover:bg-sky-200 dark:hover:bg-gray-800 transition-colors duration-200 rounded-xl text-sky-1000 dark:text-gray-100 text-sm"
          on:click={() => {
            selectedMode = 'active'
            handleChatSubmit()
          }}
          data-tooltip-action="send-chat-message"
          data-tooltip-target="send-chat-message"
          disabled={!inputValue || $status === 'running'}
        >
          {#if $status === 'running' && !$optToggled}
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
