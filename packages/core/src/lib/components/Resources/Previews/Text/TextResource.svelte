<script lang="ts">
  import { writable, derived, get } from 'svelte/store'
  import { createEventDispatcher, getContext, onDestroy, onMount, tick } from 'svelte'
  import tippy, { type Instance, type Placement, type Props } from 'tippy.js'

  import {
    Editor,
    type EditorAutocompleteEvent,
    type EditorRewriteEvent,
    type EditorSimilaritiesSearchEvent,
    type MentionItem,
    type Range
  } from '@horizon/editor'
  import '@horizon/editor/src/editor.scss'

  import { Resource, ResourceNote, useResourceManager } from '../../../../service/resources'
  import {
    getFormattedDate,
    isMac,
    isModKeyPressed,
    markdownToHtml,
    tooltip,
    useDebounce,
    useLocalStorageStore,
    useLogScope,
    useThrottle,
    wait
  } from '@horizon/utils'
  import CitationItem, {
    type CitationClickData,
    type CitationInfo
  } from '../../../Chat/CitationItem.svelte'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import { mapCitationsToText } from '@horizon/core/src/lib/service/ai/helpers'
  import { useGlobalMiniBrowser } from '@horizon/core/src/lib/service/miniBrowser'
  import {
    ChangeContextEventTrigger,
    CreateTabEventTrigger,
    EventContext,
    GeneratePromptsEventTrigger,
    MentionEventType,
    OpenInMiniBrowserEventFrom,
    PageChatMessageSentEventError,
    PageChatMessageSentEventTrigger,
    PromptType,
    ResourceTypes
  } from '@horizon/types'
  import {
    DragTypeNames,
    type AIChatMessageParsed,
    type AIChatMessageSource,
    type DragTypes,
    type HighlightWebviewTextEvent,
    type JumpToWebviewTimestampEvent,
    type TabResource
  } from '@horizon/core/src/lib/types'
  import { AIChat, useAI, type ChatPrompt } from '@horizon/core/src/lib/service/ai/ai'
  import type { ContextManager } from '@horizon/core/src/lib/service/ai/contextManager'
  import {
    INLINE_TRANSFORM,
    SMART_NOTES_SUGGESTIONS_GENERATOR_PROMPT
  } from '@horizon/core/src/lib/constants/prompts'
  import { OasisSpace, useOasis } from '@horizon/core/src/lib/service/oasis'
  import FloatingMenu from '@horizon/core/src/lib/components/Chat/Notes/FloatingMenu.svelte'
  import type { MentionAction } from '@horizon/editor/src/lib/extensions/Mention'
  import { generalContext } from '@horizon/core/src/lib/constants/browsingContext'
  import { ModelTiers } from '@horizon/types/src/ai.types'
  import SimilarityResults from '@horizon/core/src/lib/components/Chat/Notes/SimilarityResults.svelte'
  import ChangeContextBtn from '@horizon/core/src/lib/components/Chat/Notes/ChangeContextBtn.svelte'
  import { useToasts } from '@horizon/core/src/lib/service/toast'
  import { useTelemetry } from '@horizon/core/src/lib/service/telemetry'
  import type { InsertSourceEvent } from '@horizon/core/src/lib/components/Chat/Notes/SimilarityItem.svelte'
  import { useConfig } from '@horizon/core/src/lib/service/config'
  import { DragculaDragEvent, HTMLDragZone } from '@horizon/dragcula'
  import { useOnboardingNote } from '@horizon/core/src/lib/service/demoitems'
  import OnboardingControls from '@horizon/core/src/lib/components/Chat/Notes/OnboardingControls.svelte'
  import { launchTimeline } from '../../../Onboarding/timeline'
  import { OnboardingFeature } from '../../../Onboarding/onboardingScripts'
  import { Icon } from '@horizon/icons'
  import type { OnboardingNote } from '@horizon/core/src/lib/constants/notes'

  export let resourceId: string
  export let autofocus: boolean = true
  export let showTitle: boolean = true
  export let showOnboarding: boolean = false
  export let minimal: boolean = false

  const log = useLogScope('TextCard')
  const resourceManager = useResourceManager()
  const tabsManager = useTabsManager()
  const globalMiniBrowser = useGlobalMiniBrowser()
  const ai = useAI()
  const toasts = useToasts()
  const oasis = useOasis()
  const telemetry = useTelemetry()
  const config = useConfig()
  const onboarding = useOnboardingNote(oasis)

  const dispatch = createEventDispatcher<{
    'update-title': string
    seekToTimestamp: JumpToWebviewTimestampEvent
    highlightWebviewText: HighlightWebviewTextEvent
    'change-onboarding-note': OnboardingNote
  }>()

  const onboardingNote = onboarding.note
  const userSettings = config.settings

  const content = writable('')
  const autocompleting = writable(false)
  const prompts = writable<ChatPrompt[]>([])
  const contentHash = writable('')
  const generatingPrompts = writable(false)
  const showPrompts = writable(false)
  const floatingMenuShown = writable(false)
  const showBubbleMenu = writable(true)
  const bubbleMenuLoading = writable(false)
  const generatingSimilarities = writable(false)
  const similarityResults = writable<null | {
    sources: AIChatMessageSource[]
    range: Range
    text: string
  }>(null)
  const selectedContext = writable<string | null>(null)

  const collapsedSources = useLocalStorageStore<boolean>('smart-note-collapse-sources', false, true)

  let clientWidth = 0
  let disableSimilaritySearch = false
  let tippyPopover: Instance<Props> | null = null

  const builtInMentions = [
    {
      id: generalContext.id,
      label: generalContext.label,
      suggestionLabel: 'Home Context',
      aliases: ['inbox', 'general'],
      icon: 'icon;;circle-dot'
    },
    {
      id: 'everything',
      label: 'Surf',
      suggestionLabel: 'Everything in Surf',
      aliases: ['everything', 'all my stuff', 'all your stuff', 'surf'],
      icon: 'icon;;save'
    },
    {
      id: 'tabs',
      label: 'Tabs',
      suggestionLabel: 'Your Tabs',
      aliases: ['tabs', 'context', 'active'],
      icon: 'icon;;world'
    }
  ]

  const emptyPlaceholder = 'Start typing or hit space for suggestions…'

  const activeSpace = derived(
    [oasis.spaces, tabsManager.activeScopeId],
    ([spaces, activeScopeId]) => {
      return spaces.find((space) => space.id === activeScopeId)
    }
  )

  const isSmartNotesEnabled = derived(userSettings, ($userSettings) => {
    return $userSettings.experimental_smart_notes
  })

  const editorPlaceholder = derived(
    [
      floatingMenuShown,
      showPrompts,
      generatingPrompts,
      activeSpace,
      autocompleting,
      isSmartNotesEnabled,
      selectedContext,
      onboardingNote
    ],
    ([
      $floatingMenuShown,
      $showPrompts,
      $generatingPrompts,
      $activeSpace,
      $autocompleting,
      $isSmartNotesEnabled,
      $selectedContext,
      $onboardingNote
    ]) => {
      if ($autocompleting) {
        return ''
      }

      if (!$isSmartNotesEnabled) {
        return `Jot something down…`
      }

      if (showOnboarding) {
        if ($onboardingNote.id === 'intro') {
          return ``
        } else if ($onboardingNote.id === 'basics') {
          return `Press ${isMac() ? '⌥' : 'alt'} + ↵ to let Surf continue writing…`
        } else if ($onboardingNote.id === 'suggestions') {
          return `Press space to generate suggestions…`
        }
      }

      let contextName = generalContext.label
      if ($selectedContext) {
        if ($selectedContext === 'everything') {
          contextName = 'all your stuff'
        } else if ($selectedContext === generalContext.id) {
          contextName = `"${generalContext.label}"`
        } else if ($selectedContext === 'tabs') {
          contextName = 'your tabs'
        } else if ($selectedContext === 'active-context') {
          contextName = 'the active context'
        }
      } else if ($activeSpace) {
        contextName = `"${$activeSpace?.dataValue.folderName}"`
      }

      if ($floatingMenuShown) {
        if ($generatingPrompts) {
          const mentions = editorElem.getMentions()
          return `Generating suggestions based on "${contextName}"${mentions.length > 0 ? ' and the mentioned contexts' : ''}…`
        } else if ($showPrompts) {
          return `Select a suggestion or press ${isMac() ? '⌥' : 'alt'} + ↵ to let Surf write based on ${contextName}`
        } else {
          return `Press space for suggestions or ${isMac() ? '⌥' : 'alt'} + ↵ to let Surf write based on ${contextName}`
        }
      }

      return `Press ${isMac() ? '⌥' : 'alt'} + ↵ to autocomplete based on ${contextName}`
    }
  )

  const mentionItems = derived([oasis.spaces], ([spaces]) => {
    const spaceItems = spaces
      .sort((a, b) => {
        return a.indexValue - b.indexValue
      })
      .map((space) => ({
        id: space.id,
        label: space.dataValue.folderName,
        icon: space.getIconString()
      }))

    return [...builtInMentions, ...spaceItems] as MentionItem[]
  })

  const isBuiltInMention = (id: string) => {
    return builtInMentions.some((mention) => mention.id === id)
  }

  const prepLoadingPhrases = [
    'Analysing your context…',
    'Getting to the essence…',
    'Surfing the data…',
    'Unpacking details…',
    'Summoning the goodies…',
    'Charging the knowledge battery…',
    'Gathering bits of brilliance…',
    'Preparing the magic…',
    'Crafting the wisdom…',
    'Cooking up the insights…',
    'Brewing the brilliance…'
  ]

  const writingLoadingPhrases = [
    'Writing…',
    'Composing…',
    'Gathering thoughts…',
    'Crafting the words…',
    'Weaving the wisdom…',
    'Spinning the story…',
    'Painting the picture…',
    'Sculpting the text…',
    'Inking the ideas…'
  ]

  const getPrepPhrase = () => {
    return prepLoadingPhrases[Math.floor(Math.random() * prepLoadingPhrases.length)]
  }

  const getWritingPhrase = () => {
    return writingLoadingPhrases[Math.floor(Math.random() * writingLoadingPhrases.length)]
  }

  let initialLoad = true
  let resource: ResourceNote | null = null
  let focusEditor: () => void
  let title = ''
  let chat: AIChat | null = null
  let contextManager: ContextManager | null = null

  let editorElem: Editor
  let editorWrapperElem: HTMLElement

  const trackUpdateContent = useDebounce(() => {
    if ($autocompleting) {
      return
    }

    telemetry.trackUpdateNote()
  }, 1000)

  const debouncedSaveContent = useDebounce((value: string) => {
    const newHash = generateContentHash(value)

    if (newHash === $contentHash) {
      log.debug('content hash has not changed, skipping save')
      return
    }

    if (resource) {
      log.debug('saving content', value.length)
      resource.updateContent(value)
      contentHash.set(generateContentHash(value))
      trackUpdateContent()
    }
  }, 500)

  // prevent default drag and drop behavior (i.e. the MediaImporter handling it)
  // const handleDrop = (e: DragEvent) => {
  //   e.preventDefault()
  //   e.stopPropagation()

  //   log.debug('dropped onto text card', e)

  //   // seems like tiptap handles text drag and drop already
  // }

  let dragPosition: number | null = null
  const handleDragOver = (e: DragEvent) => {
    const x = e.clientX
    const y = e.clientY

    const editor = editorElem.getEditor()

    const position = editor.view.posAtCoords({ left: x, top: y })
    if (position) {
      dragPosition = position.pos
    }
  }

  const handleDrop = async (drag: DragculaDragEvent<DragTypes>) => {
    const editor = editorElem.getEditor()
    const position = dragPosition ?? editor.view.state.selection.from

    const processDropResource = (resource: Resource) => {
      if (resource.type.startsWith('image/')) {
        editor.commands.insertContentAt(position, `<img src="surf://resource/${resource.id}">`)
      } else {
        const citationElem = createCitationHTML({
          id: resource.id,
          metadata: {
            url: resource.url
          },
          resource_id: resource.id,
          all_chunk_ids: [resource.id],
          render_id: resource.id,
          content: ''
        })

        editor.commands.insertContentAt(position, citationElem)
      }
    }

    const processDropSpace = (space: OasisSpace) => {
      editor
        .chain()
        .focus()
        .insertContentAt(position, [
          {
            type: 'mention',
            attrs: {
              id: space.id,
              label: space.dataValue.folderName
            }
          },
          {
            type: 'text',
            text: ' '
          }
        ])
        .run()
    }

    if (drag.isNative) {
      log.warn('Not yet implemented!')
    } else if (drag.item!.data.hasData(DragTypeNames.SURF_TAB)) {
      const tabId = drag.item!.data.getData(DragTypeNames.SURF_TAB).id
      const tab = await tabsManager.get(tabId)
      if (!tab) {
        log.error('Tab not found', tabId)
        drag.abort()
        return
      }

      log.debug('dropped tab', tab)

      if (tab.type === 'page') {
        if (tab.resourceBookmark && tab.resourceBookmarkedManually) {
          const resource = await resourceManager.getResource(tab.resourceBookmark)
          if (resource) {
            processDropResource(resource)
            drag.continue()
            return
          }
        }
      } else if (tab.type === 'space') {
        const space = await oasis.getSpace(tab.spaceId)
        if (space) {
          processDropSpace(space)
          drag.continue()
          return
        }
      }

      log.warn('Dropped tab but no resource found! Aborting drop!')
      drag.abort()
    } else if (drag.item!.data.hasData(DragTypeNames.SURF_SPACE)) {
      const space = drag.item!.data.getData(DragTypeNames.SURF_SPACE)

      log.debug('dropped space', space)
      processDropSpace(space)
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

      log.debug('dropped resource', resource)
      processDropResource(resource)

      drag.continue()
    }
  }

  const handleTitleBlur = () => {
    if (resource && title) {
      resourceManager.updateResourceMetadata(resourceId, { name: title })
      dispatch('update-title', title)
    }
  }

  const handleTitleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleBlur()

      editorElem.focus()
    }
  }

  // FIX: This interfears with the waa we use the active state -> e.g. inside visor
  // onDestroy(
  //   activeCardId.subscribe((id) => {
  //     if (id === $card.id) {
  //       active = true
  //       tick().then(focusEditor)
  //     } else {
  //       active = false
  //     }
  //   })
  // )

  const handleCitationClick = async (e: CustomEvent<CitationClickData>) => {
    const { citationID, uniqueID, preview, source, skipHighlight } = e.detail
    log.debug('Citation clicked', citationID, uniqueID, source, preview)

    if (!source) {
      log.error('No source found for citation', citationID)
      return
    }

    let text = ''
    if (source.metadata?.timestamp === undefined || source.metadata?.timestamp === null) {
      const contentElem = editorWrapperElem.querySelector(
        '.editor-wrapper div.tiptap'
      ) as HTMLElement
      const citationsToText = mapCitationsToText(contentElem || editorWrapperElem)
      text = citationsToText.get(uniqueID) ?? ''
      log.debug('Citation text', text)
    }

    const resource = await resourceManager.getResource(source.resource_id)
    if (!resource) {
      log.error('Resource not found', source.resource_id)
      return
    }

    log.debug('Resource linked to citation', resource)

    if (
      (resource.type === ResourceTypes.PDF ||
        resource.type === ResourceTypes.LINK ||
        resource.type === ResourceTypes.ARTICLE ||
        resource.type.startsWith(ResourceTypes.POST)) &&
      !skipHighlight
    ) {
      if (
        resource.type === ResourceTypes.POST_YOUTUBE &&
        source.metadata?.timestamp !== undefined &&
        source.metadata?.timestamp !== null
      ) {
        const timestamp = source.metadata.timestamp
        dispatch('seekToTimestamp', {
          resourceId: resource.id,
          timestamp: timestamp,
          preview: preview ?? false,
          context: EventContext.Note
        })
      } else {
        // TODO: pass correct from and trigger telemetry properties
        dispatch('highlightWebviewText', {
          resourceId: resource.id,
          answerText: text,
          sourceUid: source.uid,
          preview: preview ?? false,
          context: EventContext.Note
        })
      }
    } else {
      if (preview) {
        globalMiniBrowser.openResource(resource.id, {
          from: OpenInMiniBrowserEventFrom.Note
        })
      } else {
        tabsManager.openResourcFromContextAsPageTab(resource.id, {
          active: true,
          trigger: CreateTabEventTrigger.NoteCitation
        })
      }
    }
  }

  const createNewNote = async (title?: string) => {
    const resource = await resourceManager.createResourceNote(
      '',
      { name: title ?? `Note ${getFormattedDate(Date.now())}` },
      undefined,
      EventContext.CommandMenu
    )
    await tabsManager.openResourceAsTab(resource, { active: true })
    toasts.success('Note created!')
  }

  const populateRenderAndChunkIds = (sources: AIChatMessageSource[] | undefined) => {
    if (!sources) return
    sources.forEach((source, idx) => {
      source.render_id = (idx + 1).toString()
      source.all_chunk_ids = [source.id]
    })
    return sources
  }

  const renderIDFromCitationID = (citationID: string | null, sources?: AIChatMessageSource[]) => {
    if (!citationID || !sources) return ''

    for (const source of sources) {
      if ((source.all_chunk_ids ?? []).includes(citationID)) {
        return source.render_id
      }
    }
    return ''
  }

  const getCitationInfo = (id: string, sources?: AIChatMessageSource[]) => {
    const renderID = renderIDFromCitationID(id, sources)
    const source = sources?.find((source) => source.render_id === renderID)

    return {
      id,
      source,
      renderID
    }
  }

  const parseChatOutput = async (output: AIChatMessageParsed) => {
    const content = output.content
    const sources = populateRenderAndChunkIds(output.sources)

    const domParser = new DOMParser()
    const doc = domParser.parseFromString(content, 'text/html')

    const citations = doc.querySelectorAll('citation')

    citations.forEach((elem) => {
      const id = elem.textContent
      if (!id) {
        log.error('No citation id found')
        return
      }

      const info = getCitationInfo(id, sources)
      elem.setAttribute('test', 'hello')
      elem.setAttribute('data-info', encodeURIComponent(JSON.stringify(info)))
    })

    const markdown = doc.body.innerHTML

    const html = await markdownToHtml(markdown)
    return html
  }

  const getLastNode = (type: string) => {
    const editor = editorElem.getEditor()
    const nodes = editor.$nodes(type)
    if (!nodes || nodes.length === 0) {
      return null
    }

    return nodes[nodes.length - 1]
  }

  const createCitationHTML = (source: AIChatMessageSource, skipHighlight = false) => {
    const citationInfo = encodeURIComponent(
      JSON.stringify({
        id: source.id,
        renderID: source.id,
        source: source,
        skipHighlight: skipHighlight,
        hideText: true
      } as CitationInfo)
    )

    const elem = document.createElement('citation')
    elem.setAttribute('id', source.id)
    elem.setAttribute('data-info', citationInfo)
    elem.textContent = source.id

    return elem.outerHTML
  }

  const createNewNoteChat = async (spaces?: string[]) => {
    if (!contextManager) {
      log.error('No context manager found')
      return null
    }

    const chatContextManager = contextManager.clone()

    const addSpace = (spaceId: string) => {
      const activeSpaceContextItem = chatContextManager.getActiveSpaceContextItem()
      if (spaceId === generalContext.id) {
        chatContextManager.addHomeContext()
      } else if (spaceId === 'everything') {
        chatContextManager.addEverythingContext()
      } else if (spaceId === 'tabs') {
        if (activeSpaceContextItem) {
          activeSpaceContextItem.include =
            activeSpaceContextItem.include === 'resources' ? 'everything' : 'tabs'
        } else {
          chatContextManager.addActiveSpaceContext(undefined, undefined, 'tabs')
        }
      } else if (spaceId === 'active-context') {
        if (activeSpaceContextItem) {
          activeSpaceContextItem.include =
            activeSpaceContextItem.include === 'tabs' ? 'everything' : 'resources'
        } else {
          chatContextManager.addActiveSpaceContext(undefined, undefined, 'resources')
        }
      } else {
        chatContextManager.addSpace(spaceId)
      }
    }

    if (spaces && spaces.length > 0) {
      log.debug('Adding spaces to context', spaces)
      spaces.forEach((space) => {
        addSpace(space)
      })
    } else if ($selectedContext) {
      log.debug('Adding selected context to context', $selectedContext)
      addSpace($selectedContext)
    } else {
      log.debug('Adding active space to context', resourceId)
      // chatContextManager.addResource(resourceId)
      chatContextManager.addActiveSpaceContext(undefined, undefined, 'resources')
    }

    const chat = await ai.createChat(undefined, chatContextManager)
    if (!chat) {
      log.error('Failed to create chat')
      return null
    }

    return chat
  }

  const cleanupCompletion = () => {
    const editor = editorElem.getEditor()
    const loading = getLastNode('loading')
    if (loading) {
      editor.commands.deleteRange(loading.range)
    }

    const outputNode = getLastNode('output')
    if (outputNode) {
      const range = outputNode.range
      editor.commands.deleteRange(range)
    }
  }

  const generateAndInsertAIOutput = async (
    query: string,
    systemPrompt?: string,
    spaces?: string[],
    trigger?: PageChatMessageSentEventTrigger
  ) => {
    try {
      const chat = await createNewNoteChat(spaces)
      if (!chat || !query) {
        log.error('Failed to create chat')
        return
      }

      const editor = editorElem.getEditor()
      const currentPosition = editor.view.state.selection.from

      autocompleting.set(true)

      const replace = trigger === PageChatMessageSentEventTrigger.NoteRewrite

      if (!replace) {
        editor.commands.insertContentAt(currentPosition, `<loading>${getPrepPhrase()}</loading>`, {
          updateSelection: false
        })
      }

      let createdLoading = false

      const renderFunction = useThrottle(async (message: AIChatMessageParsed) => {
        if (!createdLoading) {
          createdLoading = true

          editor.commands.insertContentAt(currentPosition, '<output> </output>', {
            updateSelection: false
          })

          const loading = getLastNode('loading')
          if (loading) {
            editor.commands.deleteRange(loading.range)
          }

          if (!replace) {
            let outputNode = getLastNode('output')
            editor.commands.insertContentAt(
              outputNode?.range.to ?? currentPosition,
              `<loading>${getWritingPhrase()}</loading>`,
              {
                updateSelection: false
              }
            )
          }

          await tick()
        }

        //log.debug('chat message', message)
        const html = await parseChatOutput(message)
        let outputNode = getLastNode('output')
        if (!outputNode) {
          log.error('No output node found')
          return
        }

        const tr = editor.view.state.tr
        const json = editorElem.generateJSONFromHTML(html)
        const newOutputNode = editor.view.state.schema.nodeFromJSON({
          type: 'output',
          content: json.content
        })

        tr.replaceRangeWith(outputNode.range.from, outputNode.range.to, newOutputNode)
        editor.view.dispatch(tr)
      }, 15)

      const response = await chat.createChatCompletion(
        `${query} \n ${systemPrompt ?? ''}`,
        { trigger },
        renderFunction
      )

      log.debug('autocomplete response', response)

      if (response.error) {
        log.error('Error generating AI output', response.error)
        if (response.error.type.startsWith(PageChatMessageSentEventError.QuotaExceeded)) {
          toasts.error(response.error.message)
        } else {
          toasts.error('Failed to generate AI output')
        }
        cleanupCompletion()
      } else if (!response.output) {
        log.error('No output found')
        toasts.error('Failed to generate AI output')
        cleanupCompletion()
      } else {
        const html = await parseChatOutput(response.output)

        const loading = getLastNode('loading')
        if (loading) {
          editor.commands.deleteRange(loading.range)
        }

        const outputNode = getLastNode('output')
        if (!outputNode) {
          log.error('No output node found')
          editor.commands.insertContent(html, {
            updateSelection: false
          })
          return
        }

        const range = outputNode.range
        editor.commands.deleteRange(range)
        editor.commands.insertContentAt(range.from, html, {
          updateSelection: false
        })
      }
    } catch (err) {
      log.error('Error generating AI output', err)
      toasts.error('Failed to generate AI output')

      const loading = getLastNode('loading')
      if (loading) {
        const editor = editorElem.getEditor()
        editor.commands.deleteRange(loading.range)
      }
    } finally {
      autocompleting.set(false)
    }
  }

  const handleAutocomplete = async (e: CustomEvent<EditorAutocompleteEvent>) => {
    try {
      log.debug('autocomplete', e.detail)

      hideInfoPopover()

      const { query, mentions } = e.detail
      const spaces = (mentions ?? []).map((mention) => mention.id)
      await generateAndInsertAIOutput(
        query,
        'Stay short and use citations!',
        spaces,
        PageChatMessageSentEventTrigger.NoteAutocompletion
      )
    } catch (e) {
      log.error('Error doing magic', e)
      toasts.error('Failed to autocomplete')
    }
  }

  const generateContentHash = (content: string) => {
    return content
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0)
      .toString()
  }

  const generatePrompts = useDebounce(async () => {
    try {
      log.debug('generating prompts')
      showPrompts.set(true)
      generatingPrompts.set(true)
      editorElem.focus()

      const hash = generateContentHash($content)
      if ($prompts.length > 0 && hash === $contentHash) {
        log.debug('content hash has not changed, skipping prompt generation')
        generatingPrompts.set(false)
        return
      }

      const mentions = editorElem.getMentions()
      const contextNames = mentions.map((mention) => mention.label)

      const generatedPrompts = await ai.generatePrompts(
        {
          title: title,
          content: $content,
          contexts: [$activeSpace?.dataValue.folderName ?? '', ...contextNames]
        },
        {
          systemPrompt: SMART_NOTES_SUGGESTIONS_GENERATOR_PROMPT,
          trigger: GeneratePromptsEventTrigger.Shortcut,
          context: EventContext.Note
        }
      )

      if (!generatedPrompts) {
        log.error('Failed to generate prompts')
        generatingPrompts.set(false)
        return
      }

      log.debug('prompts', generatedPrompts)
      prompts.set(generatedPrompts)
    } catch (e) {
      log.error('Error generating prompts', e)
      toasts.error('Failed to generate suggestions')
    } finally {
      generatingPrompts.set(false)
    }
  }, 500)

  const runPrompt = async (prompt: ChatPrompt) => {
    try {
      log.debug('Handling prompt submit', prompt)
      const mentions = editorElem.getMentions()
      const spaces = mentions.map((mention) => mention.id)

      telemetry.trackUsePrompt(PromptType.Generated, EventContext.Note)

      hideInfoPopover()

      await generateAndInsertAIOutput(
        prompt.prompt,
        'Stay short and use citations!',
        spaces,
        PageChatMessageSentEventTrigger.NoteUseSuggestion
      )
    } catch (e) {
      log.error('Error doing magic', e)
      toasts.error('Failed to generate suggestion')
    }
  }

  const openSpaceInStuff = (id: string) => {
    oasis.changeSelectedSpace(id)
    tabsManager.showNewTabOverlay.set(2)
  }

  const getMentionType = (id: string) => {
    if (id === 'everything') {
      return MentionEventType.Everything
    } else if (id === 'tabs') {
      return MentionEventType.Tabs
    } else if (id === generalContext.id) {
      return MentionEventType.GeneralContext
    } else if (id === 'active-context') {
      return MentionEventType.ActiveContext
    } else {
      return MentionEventType.Context
    }
  }

  const handleMentionClick = async (
    e: CustomEvent<{ item: MentionItem; action: MentionAction }>
  ) => {
    try {
      log.debug('mention click', e.detail)
      const { item, action } = e.detail
      const { id } = item

      telemetry.trackNoteOpenMention(getMentionType(id), action)

      if (id === 'tabs') {
        return
      }

      if (action === 'new-tab' || action === 'new-background-tab') {
        if (isBuiltInMention(id)) {
          tabsManager.changeScope(null, ChangeContextEventTrigger.Note)
          return
        }

        const space = await oasis.getSpace(id)
        if (!space) {
          log.error('Space not found', id)
          return
        }

        tabsManager.addSpaceTab(space, {
          active: action === 'new-tab'
        })
      } else if (action === 'overlay') {
        if (id === generalContext.id) {
          openSpaceInStuff('inbox')
        } else if (id === 'everything') {
          openSpaceInStuff('all')
        } else if (!isBuiltInMention(id)) {
          openSpaceInStuff(id)
        }
      } else {
        tabsManager.changeScope(
          id === generalContext.id || id === 'everything' ? null : id,
          ChangeContextEventTrigger.Note
        )
      }
    } catch (e) {
      log.error('Error handling mention click', e)
      toasts.error('Failed to handle mention click')
    }
  }

  const handleMentionInsert = (e: CustomEvent<MentionItem>) => {
    const { id } = e.detail
    log.debug('mention insert', id)

    telemetry.trackNoteCreateMention(getMentionType(id))
  }

  const handleRewrite = async (e: CustomEvent<EditorRewriteEvent>) => {
    try {
      const { prompt, text, range, mentions } = e.detail

      // const editor = editorElem.getEditor()
      // const tr = editor.view.state.tr
      // tr.delete(range.from, range.to)

      // editor.view.dispatch(tr)

      // await generateAndInsertAIOutput(text, INLINE_TRANSFORM.replace('${INSTRUCTION}', prompt), undefined, PageChatMessageSentEventTrigger.NoteRewrite)

      const spaces = (mentions ?? []).map((mention) => mention.id)

      log.debug('Rewriting', prompt, text, range, spaces)

      hideInfoPopover()

      const chat = await createNewNoteChat(spaces)
      if (!chat) {
        log.error('Failed to create chat')
        return
      }

      const response = await chat.createChatCompletion(
        `${INLINE_TRANSFORM.replace('${INSTRUCTION}', prompt)} \n ${text}`,
        {
          trigger: PageChatMessageSentEventTrigger.NoteRewrite
        }
      )

      log.debug('autocomplete response', response)

      showBubbleMenu.set(false)

      if (response.error) {
        log.error('Error generating AI output', response.error)

        if (response.error.type.startsWith(PageChatMessageSentEventError.QuotaExceeded)) {
          toasts.error(response.error.message)
        } else {
          toasts.error('Failed to generate AI output')
        }

        return
      }

      if (response.output) {
        const html = await parseChatOutput(response.output)

        // replace the text with the new text
        const editor = editorElem.getEditor()

        const tr = editor.view.state.tr
        const json = editorElem.generateJSONFromHTML(html)

        log.debug('json', json)

        const newOutputNode = editor.view.state.schema.nodeFromJSON({
          type: 'output',
          content: json.content
        })

        log.debug('replacing range', range, 'with', newOutputNode)
        tr.replaceRangeWith(range.from, range.to, newOutputNode)

        editor.view.dispatch(tr)
      }

      showBubbleMenu.set(true)
    } catch (e) {
      log.error('Error rewriting', e)
      toasts.error('Failed to rewrite')
      showBubbleMenu.set(false)
    }
  }

  const runSimilaritySearch = async (text: string, range: Range, loading: boolean) => {
    try {
      const editor = editorElem.getEditor()

      log.debug('Searching for similarities', text, range)

      generatingSimilarities.set(true)

      if (loading) {
        bubbleMenuLoading.set(true)
      }

      const node = editor.view.state.doc.cut(range.from, range.to)
      const mentions = editorElem.getMentions(node)
      const spaces = mentions.map((mention) => mention.id)

      const chat = await createNewNoteChat(spaces)
      if (!chat) {
        log.error('Failed to create chat')
        return
      }

      // await chat.contextManager.addEverythingContext()

      const result = await chat.similaritySearch(text, {
        trigger: PageChatMessageSentEventTrigger.NoteSimilaritySearch
      })
      const sources = result.filter((source) => source.resource_id !== resourceId)

      log.debug('sources', sources)

      similarityResults.set({
        text,
        sources,
        range
      })

      // insert below the current selection
      // const resultText = parsed.map(source => `<p>${source.content}</p>`).join('\n\n')
      // const editor = editorElem.getEditor()
      // const tr = editor.view.state.tr
      // const json = editorElem.generateJSONFromHTML(resultText)
      // const newOutputNode = editor.view.state.schema.nodeFromJSON({
      //   type: 'paragraph',
      //   content: json.content
      // })

      // tr.insert(range.to, newOutputNode)
      // editor.view.dispatch(tr)
    } catch (e) {
      log.error('Error searching for similarities', e)
      toasts.error('Failed to search for similarities')
    } finally {
      generatingSimilarities.set(false)
      bubbleMenuLoading.set(false)
    }
  }

  const debouncedSimilaritySearch = useDebounce(runSimilaritySearch, 500)

  const handleSimilaritySearch = async (e: CustomEvent<EditorSimilaritiesSearchEvent>) => {
    try {
      const { text, range, loading } = e.detail

      if ((showOnboarding && get(onboarding.idx) < 3) || disableSimilaritySearch) {
        log.debug('Onboarding mode, skipping similarity search', get(onboarding.idx))
        return
      }

      await debouncedSimilaritySearch(text, range, loading)
    } catch (e) {
      log.error('Error searching for similarities', e)
      toasts.error('Failed to search for similarities')
    }
  }

  const handleInsertSimilarity = async (e: CustomEvent<InsertSourceEvent>) => {
    try {
      if (!$similarityResults) {
        log.error('No similarity results found')
        return
      }

      const editor = editorElem.getEditor()

      const { source, text, summarized } = e.detail

      log.debug('Inserting similarity', source, text, summarized)
      const citationElem = createCitationHTML(source, summarized)

      const tr = editor.view.state.tr
      const json = editorElem.generateJSONFromHTML(`${text} ${citationElem}`)
      const newOutputNode = editor.view.state.schema.nodeFromJSON({
        type: 'paragraph',
        content: json.content
      })

      // insert at the end of the document
      tr.insert(editor.view.state.doc.content.size, newOutputNode)
      editor.view.dispatch(tr)

      resourceManager.getResource(resourceId).then((resource) => {
        if (resource) {
          telemetry.trackNoteInsertSimilarSource(resource?.type, summarized)
        }
      })
    } catch (e) {
      log.error('Error inserting similarity', e)
      toasts.error('Failed to insert similarity')
    }
  }

  const closeSimilarities = () => {
    similarityResults.set(null)
  }

  const handleOpenBubbleMenu = () => {
    if (showOnboarding && $onboardingNote.id === 'similarity') {
      showInfoPopover('#editor-bubble-similarity-btn', `Click to search`, 'right')
    }
  }

  const handleCloseBubbleMenu = () => {
    const editor = editorElem.getEditor()
    const currentSelection = editor.view.state.selection
    if (currentSelection.from === currentSelection.to) {
      closeSimilarities()
    }

    if (showOnboarding && $onboardingNote.id === 'similarity') {
      hideInfoPopover()
    }
  }

  const handleSelectContext = (e: CustomEvent<string>) => {
    try {
      log.debug('Selected context', e.detail)
      selectedContext.set(e.detail)

      if ($similarityResults) {
        runSimilaritySearch($similarityResults.text, $similarityResults.range, false)
      }

      telemetry.trackNoteChangeContext(getMentionType(e.detail))
    } catch (e) {
      log.error('Error selecting context', e)
      toasts.error('Failed to select context')
    }
  }

  const selectElemText = (selector: string) => {
    const elem = document.querySelector(selector)
    if (elem) {
      const range = document.createRange()
      range.selectNodeContents(elem)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  }

  const handleNoteButtonClick = async (e: CustomEvent<string>) => {
    try {
      const action = e.detail

      log.debug('Note button click', action)

      if (action === 'onboarding-start-demo') {
        onboarding.start()
      } else if (action === 'onboarding-create-note') {
        createNewNote()
      } else if (action === 'onboarding-open-stuff') {
        openSpaceInStuff('all')
      } else if (action === 'onboarding-select-text') {
        selectElemText('output[data-id="similarity-selection"]')
      } else if (action === 'onboarding-generate-suggestions') {
        generatePrompts()
      } else if (action === 'onboarding-rewrite-selection') {
        disableSimilaritySearch = true
        selectElemText('output[data-id="rewrite-content"]')
        await wait(500)
        const btn = document.getElementById('editor-bubble-rewrite-btn')
        if (btn) {
          btn.click()
        }
        disableSimilaritySearch = false
      } else {
        log.warn('Unknown action', action)
      }
    } catch (e) {
      log.error('Error handling note button click', e)
      toasts.error('Failed to handle note button click')
    }
  }

  const showOnboardingNote = async () => {
    const newTab = await tabsManager.create<TabResource>(
      {
        title: 'Intro to Smart Notes',
        icon: '',
        type: 'resource',
        resourceId: 'onboarding',
        resourceType: ResourceTypes.DOCUMENT_SPACE_NOTE
      },
      {
        active: true
      }
    )

    log.debug('created onboarding tab', newTab)
  }

  const showBasicsTimeline = async () => {
    await wait(1000)
    launchTimeline(OnboardingFeature.SmartNotesOnboarding)
  }

  const showInfoPopover = async (selector: string, content: string, placement: Placement) => {
    await wait(500)
    const elem = document.querySelector(selector)
    if (!elem) {
      log.debug('No basics query found')
      return
    }

    tippyPopover = tippy(elem, {
      appendTo: () => document.body,
      content: content,
      trigger: 'manual',
      placement: placement,
      theme: 'dark'
    })

    tippyPopover.show()
  }

  const hideInfoPopover = () => {
    if (tippyPopover) {
      tippyPopover.destroy()
      tippyPopover = null
    }
  }

  const showBasicsPopover = async () => {
    showInfoPopover('output[data-id="basics-query"]', `Press ${isMac() ? '⌥' : 'Alt'} + ↵`, 'right')
  }

  const showSimilarityPopover = async () => {
    showInfoPopover('output[data-id="similarity-selection"]', `Select Text`, 'left')
  }

  let unsubscribeValue: () => void
  let unsubscribeContent: () => void

  $: if (!$floatingMenuShown) {
    $showPrompts = false
  }

  onMount(async () => {
    if (showOnboarding) {
      initialLoad = false

      title = get(onboarding.note)?.title ?? 'Onboarding'
      content.set(get(onboarding.note)?.html ?? '')

      unsubscribeContent = onboarding.note.subscribe((note) => {
        title = note.title
        content.set(note.html)

        log.debug('onboarding note', note.title, note.html)
        dispatch('change-onboarding-note', note)

        hideInfoPopover()

        if (note.id === 'basics') {
          showBasicsPopover()
        } else if (note.id === 'similarity') {
          showSimilarityPopover()
        }

        // if (editorElem) {
        //   editorElem.setContent(note.html)
        // }
      })

      contentHash.set(generateContentHash($content))

      contextManager = ai.createContextManager()
      contextManager.clear()
      return
    }

    resource = (await resourceManager.getResource(resourceId)) as ResourceNote | null
    if (!resource) {
      log.error('Resource not found', resourceId)
      return
    }

    const value = resource.parsedData
    unsubscribeValue = value.subscribe((value) => {
      if (value) {
        content.set(value)
      }
    })

    await resource.getContent()

    initialLoad = false

    unsubscribeContent = content.subscribe((value) => {
      debouncedSaveContent(value ?? '')
    })

    title = resource.metadata?.name ?? 'Untitled'

    log.debug('text resource', resource, title, $content)

    contentHash.set(generateContentHash($content))

    contextManager = ai.createContextManager()
    contextManager.clear()

    // await generatePrompts()
  })

  onDestroy(() => {
    if (resource) {
      resource.releaseData()
    }

    if (unsubscribeContent) {
      unsubscribeContent()
    }

    if (unsubscribeValue) {
      unsubscribeValue()
    }
  })
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="wrapper text-gray-900 dark:text-gray-100"
  bind:clientWidth
  use:HTMLDragZone.action={{
    accepts: (drag) => {
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
  on:dragover={handleDragOver}
>
  <div class="content">
    {#if showTitle}
      <div class="details">
        <input
          type="text"
          placeholder="Note Title"
          disabled={showOnboarding}
          bind:value={title}
          on:blur={handleTitleBlur}
          on:keydown={handleTitleKeydown}
          on:click
        />
      </div>
    {/if}

    {#if !initialLoad}
      {#key showOnboarding ? `${$onboardingNote.id}-${$isSmartNotesEnabled}` : $isSmartNotesEnabled}
        <div class="notes-editor-wrapper" bind:this={editorWrapperElem}>
          <Editor
            bind:this={editorElem}
            bind:focus={focusEditor}
            bind:content={$content}
            bind:floatingMenuShown={$floatingMenuShown}
            placeholder={emptyPlaceholder}
            placeholderNewLine={$editorPlaceholder}
            citationComponent={CitationItem}
            mentionItems={$mentionItems}
            autocomplete={$isSmartNotesEnabled}
            floatingMenu={$isSmartNotesEnabled}
            readOnlyMentions={!$isSmartNotesEnabled}
            bubbleMenu={$showBubbleMenu && $isSmartNotesEnabled && !minimal}
            bubbleMenuLoading={$bubbleMenuLoading}
            autoSimilaritySearch={$userSettings.auto_note_similarity_search && !minimal}
            enableRewrite={$userSettings.experimental_note_inline_rewrite}
            parseMentions
            {tabsManager}
            on:click
            on:dragstart
            on:citation-click={handleCitationClick}
            on:autocomplete={handleAutocomplete}
            on:suggestions={() => generatePrompts()}
            on:mention-click={handleMentionClick}
            on:mention-insert={handleMentionInsert}
            on:rewrite={handleRewrite}
            on:similarity-search={handleSimilaritySearch}
            on:close-bubble-menu={handleCloseBubbleMenu}
            on:open-bubble-menu={handleOpenBubbleMenu}
            on:button-click={handleNoteButtonClick}
            {autofocus}
          >
            <div slot="floating-menu">
              <FloatingMenu
                bind:showPrompts={$showPrompts}
                {prompts}
                {generatingPrompts}
                on:generatePrompts={() => generatePrompts()}
                on:runPrompt={(e) => runPrompt(e.detail)}
              />
            </div>
          </Editor>
        </div>
      {/key}
    {/if}
  </div>

  {#if showOnboarding}
    <div class="onboarding-wrapper">
      <OnboardingControls
        idx={onboarding.idx}
        total={onboarding.notes.length}
        canGoPrev={onboarding.canGoPrev}
        canGoNext={onboarding.canGoNext}
        title={showTitle ? undefined : title}
        on:prev={onboarding.prev}
        on:next={onboarding.next}
      />
    </div>
  {/if}

  {#if !minimal}
    {#if $similarityResults}
      <SimilarityResults
        {activeSpace}
        {selectedContext}
        sources={$similarityResults.sources}
        floating={clientWidth > 1400}
        loading={$generatingSimilarities}
        bind:collapsed={$collapsedSources}
        on:close={() => closeSimilarities()}
        on:insert={handleInsertSimilarity}
        on:change-context={handleSelectContext}
        on:highlightWebviewText
        on:seekToTimestamp
      />
    {:else}
      <div class="change-context-wrapper">
        <ChangeContextBtn
          spaces={oasis.spaces}
          {selectedContext}
          {activeSpace}
          on:select={handleSelectContext}
        />
      </div>
    {/if}

    {#if !showOnboarding}
      <button
        on:click={() => showOnboardingNote()}
        class="info-btn"
        use:tooltip={{ text: 'Intro to Smart Notes', position: 'right' }}
      >
        <Icon name="info" />
      </button>
    {/if}
  {/if}
</div>

<style lang="scss">
  .wrapper {
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
    padding-bottom: 0;
    background: #fff;
    display: flex;
    justify-content: center;
    align-items: center;

    :global(.dark) & {
      background: #181818;
    }

    --text-color: #1f163c;
    --text-color-dark: #fff;
  }

  .content {
    width: 100%;
    max-width: 86ch;
    height: 100%;
    overflow: hidden;
    position: relative;
    padding: 2em;
    padding-top: 3em;
    padding-bottom: 0;
    display: flex;
    flex-direction: column;
    gap: 2em;
  }

  .details {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 1em;
    padding-bottom: 0.25em;
    border-bottom: 1px dashed #ddd;

    input {
      font-size: 1.9em;
      font-weight: 600;
      border: none;
      outline: none;
      background: transparent;
      padding: 0;
      margin: 0;
      width: 100%;

      font-family: Gambarino;
      letter-spacing: 0.3px;

      color: var(--text-color);

      :global(.dark) & {
        color: var(--text-color-dark) !important;
      }
    }

    &:active,
    &:focus,
    &:focus-within {
      border-color: #aaa;
    }

    :global(.dark) & {
      border-color: #444;

      &:active,
      &:focus,
      &:focus-within {
        border-color: #777;
      }
    }
  }

  .prompts-wrapper {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 1em;
  }

  .prompts {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    margin-bottom: 0.5rem;
    overflow: auto;
    z-index: 0;
  }

  .prompts-list {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .change-context-wrapper {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 100;
  }

  .onboarding-wrapper {
    position: absolute;
    z-index: 100;
    left: 50%;
    bottom: 1.5rem;
    transform: translateX(-50%);
  }

  .info-btn {
    position: fixed;
    top: 1rem;
    left: 1rem;
    z-index: 100;
    background: #fff;
    border: none;
    padding: 0.25rem;
    border-radius: 0.5rem;
    opacity: 0.5;

    :global(.dark) & {
      background: #333;
    }

    &:hover {
      background: #f8f8f8;
      opacity: 1;

      :global(.dark) & {
        background: #444;
      }
    }
  }

  .notes-editor-wrapper {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 1em;
    overflow: hidden;
  }

  :global(.notes-editor-wrapper .editor-wrapper div.tiptap) {
    padding-bottom: 12rem;
  }

  :global(.tiptap) {
    :global(ul) {
      :global(li) {
        margin-block: 0.25em !important;
      }
    }

    :global(pre) {
      background: #f8f8f8;
    }
    :global(.dark) & {
      :global(*):not(.mention, a) {
        color: var(--text-color-dark) !important;
      }
      :global(pre) {
        background: #111;
      }
    }
  }
</style>
