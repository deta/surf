<script lang="ts">
  import { writable, derived, get } from 'svelte/store'
  import { createEventDispatcher, getContext, onDestroy, onMount, tick } from 'svelte'
  import tippy, { type Instance, type Placement, type Props } from 'tippy.js'
  import type { Editor as TiptapEditor } from '@tiptap/core'

  import {
    Editor,
    getEditorContentText,
    MentionItemType,
    type EditorAutocompleteEvent,
    type EditorRewriteEvent,
    type EditorSimilaritiesSearchEvent,
    type MentionItem,
    type Range
  } from '@horizon/editor'
  import '@horizon/editor/src/editor.scss'

  import {
    Resource,
    ResourceNote,
    ResourceTag,
    useResourceManager
  } from '../../../../service/resources'
  import {
    conditionalArrayItem,
    getFileKind,
    getFileType,
    getFormattedDate,
    isMac,
    isModKeyPressed,
    markdownToHtml,
    tooltip,
    truncate,
    truncateURL,
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
  import {
    generateContentHash,
    mapCitationsToText,
    parseChatOutputToHtml,
    parseChatOutputToSurfletCode
  } from '@horizon/core/src/lib/service/ai/helpers'
  import {
    startAIGeneration,
    endAIGeneration,
    updateAIGenerationProgress,
    isGeneratingAI as globalIsGeneratingAI
  } from '@horizon/core/src/lib/service/ai/generationState'
  import { useGlobalMiniBrowser } from '@horizon/core/src/lib/service/miniBrowser'
  import {
    ChangeContextEventTrigger,
    CreateTabEventTrigger,
    EventContext,
    GeneratePromptsEventTrigger,
    MentionEventType,
    NoteCreateCitationEventTrigger,
    OpenInMiniBrowserEventFrom,
    PageChatMessageSentEventError,
    PageChatMessageSentEventTrigger,
    PageChatUpdateContextEventAction,
    PageChatUpdateContextEventTrigger,
    PromptType,
    ResourceTagsBuiltInKeys,
    ResourceTypes,
    WEB_RESOURCE_TYPES
  } from '@horizon/types'
  import {
    DragTypeNames,
    SpaceEntryOrigin,
    type AIChatMessageParsed,
    type AIChatMessageSource,
    type DragTypes,
    type HighlightWebviewTextEvent,
    type JumpToWebviewTimestampEvent,
    type TabResource
  } from '@horizon/core/src/lib/types'
  import { AIChat, useAI, type ChatPrompt } from '@horizon/core/src/lib/service/ai/ai'
  import {
    ContextItemTypes,
    type ContextManager
  } from '@horizon/core/src/lib/service/ai/contextManager'
  import {
    INLINE_TRANSFORM,
    SMART_NOTES_SUGGESTIONS_GENERATOR_PROMPT,
    CHAT_TITLE_GENERATOR_PROMPT
  } from '@horizon/core/src/lib/constants/prompts'
  import { OasisSpace, useOasis } from '@horizon/core/src/lib/service/oasis'
  import FloatingMenu from '@horizon/core/src/lib/components/Chat/Notes/FloatingMenu.svelte'
  import type { MentionAction } from '@horizon/editor/src/lib/extensions/Mention'
  import { inboxContext } from '@horizon/core/src/lib/constants/browsingContext'
  import { ChatMode, ModelTiers, Provider } from '@horizon/types/src/ai.types'
  import SimilarityResults from '@horizon/core/src/lib/components/Chat/Notes/SimilarityResults.svelte'
  import ChangeContextBtn from '@horizon/core/src/lib/components/Chat/Notes/ChangeContextBtn.svelte'
  import { Toast, useToasts } from '@horizon/core/src/lib/service/toast'
  import { useTelemetry } from '@horizon/core/src/lib/service/telemetry'
  import type { InsertSourceEvent } from '@horizon/core/src/lib/components/Chat/Notes/SimilarityItem.svelte'
  import { useConfig } from '@horizon/core/src/lib/service/config'
  import { DragculaDragEvent, HTMLDragZone } from '@horizon/dragcula'
  import { useOnboardingNote, useCodegenNote } from '@horizon/core/src/lib/service/demoitems'
  import OnboardingControls from '@horizon/core/src/lib/components/Chat/Notes/OnboardingControls.svelte'
  import { launchTimeline } from '../../../Onboarding/timeline'
  import { OnboardingFeature } from '../../../Onboarding/onboardingScripts'
  import { Icon } from '@horizon/icons'
  import type { OnboardingNote } from '@horizon/core/src/lib/constants/notes'
  import { createWikipediaAPI } from '@horizon/web-parser'
  import EmbeddedResource from '@horizon/core/src/lib/components/Chat/Notes/EmbeddedResource.svelte'
  import { isGeneratedResource } from '@horizon/core/src/lib/utils/resourcePreview'
  import { updateCaretPopoverVisibility } from '@horizon/editor/src/lib/extensions/CaretIndicator/utils'
  import {
    MODEL_CLAUDE_MENTION,
    MODEL_GPT_MENTION,
    NO_CONTEXT_MENTION,
    NOTE_MENTION,
    EVERYTHING_MENTION,
    INBOX_MENTION
  } from '@horizon/core/src/lib/constants/chat'
  import ModelPicker from '@horizon/core/src/lib/components/Chat/ModelPicker.svelte'
  import type {
    SlashCommandPayload,
    SlashMenuItem
  } from '@horizon/editor/src/lib/extensions/Slash/index'
  import type { SlashItemsFetcher } from '@horizon/editor/src/lib/extensions/Slash/suggestion'
  import { BUILT_IN_SLASH_COMMANDS } from '@horizon/editor/src/lib/extensions/Slash/actions'
  import { ResourceManager } from '@horizon/core/src/lib/service/resources'
  import { useSmartNotes, type SmartNote } from '@horizon/core/src/lib/service/ai/note'
  import CaretPopover from './CaretPopover.svelte'
  import type { CaretPosition } from '@horizon/editor/src/lib/extensions/CaretIndicator'
  import Surflet from '@horizon/core/src/lib/components/Chat/Notes/Surflet.svelte'
  import ChatControls from '@horizon/core/src/lib/components/Chat/ChatControls.svelte'
  import { openContextMenu } from '../../../Core/ContextMenu.svelte'
  import {
    createResourcesFromMediaItems,
    processPaste,
    type MediaParserResult
  } from '../../../../service/mediaImporter'
  import type { MentionItemsFetcher } from '@horizon/editor/src/lib/extensions/Mention/suggestion'
  import { createMentionsFetcher } from '@horizon/core/src/lib/service/ai/mentions'

  export let resourceId: string
  export let autofocus: boolean = true
  export let showTitle: boolean = true
  export let showOnboarding: boolean = false
  export let showCodegenOnboarding: boolean = false
  export let minimal: boolean = false
  export let hideContextSwitcher: boolean = false
  export let similaritySearch: boolean = false
  export let manualContextControl: boolean = false
  export let autoGenerateTitle: boolean = false
  export let contextManager: ContextManager | undefined = undefined
  export let note: SmartNote | null = null

  const log = useLogScope('TextCard')
  const resourceManager = useResourceManager()
  const tabsManager = useTabsManager()
  const globalMiniBrowser = useGlobalMiniBrowser()
  const ai = useAI()
  const toasts = useToasts()
  const oasis = useOasis()
  const telemetry = useTelemetry()
  const config = useConfig()
  const codegenOnboarding = useCodegenNote()
  const noteOnboarding = useOnboardingNote(oasis)
  const wikipediaAPI = createWikipediaAPI()
  const smartNotes = useSmartNotes()

  const dispatch = createEventDispatcher<{
    'update-title': string
    seekToTimestamp: JumpToWebviewTimestampEvent
    highlightWebviewText: HighlightWebviewTextEvent
    'change-onboarding-note': OnboardingNote
  }>()

  const userSettings = config.settings
  const activeNoteId = smartNotes.activeNoteId

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
  // Local store that syncs with the global AI generation state
  const isGeneratingAI = writable(false)

  // Set up synchronization between local and global state
  onMount(() => {
    // Subscribe to global state and update local state
    const unsubscribeGlobal = globalIsGeneratingAI.subscribe((isGenerating) => {
      isGeneratingAI.set(isGenerating)
    })

    return () => {
      // Clean up subscription when component is destroyed
      unsubscribeGlobal()
    }
  })

  const similarityResults = writable<null | {
    sources: AIChatMessageSource[]
    range: Range
    text: string
  }>(null)
  const selectedContext = writable<string | null>(null)

  const collapsedSources = useLocalStorageStore<boolean>('smart-note-collapse-sources', false, true)

  const DRAG_ZONE_PREFIX = 'text-resource/'
  const dragZoneId = DRAG_ZONE_PREFIX + resourceId + Date.now()

  let clientWidth = 0
  let disableSimilaritySearch = false
  let tippyPopover: Instance<Props> | null = null
  let editorFocused = false

  // Caret indicator state
  let caretPosition: CaretPosition | null = null
  let showCaretPopover = false

  const emptyPlaceholder = 'Start typing or hit space for suggestions…'

  const onboardingNote = derived(
    [noteOnboarding.note, codegenOnboarding.note],
    ([$note, $codegenNote]) => {
      if (showCodegenOnboarding) {
        return $codegenNote
      } else {
        return $note
      }
    }
  )

  const onboardingIndex = derived(
    [noteOnboarding.idx, codegenOnboarding.idx],
    ([$note, $codegenNote]) => {
      if (showCodegenOnboarding) {
        return $codegenNote
      } else {
        return $note
      }
    }
  )

  const activeSpace = derived(
    [oasis.spaces, tabsManager.activeScopeId],
    ([spaces, activeScopeId]) => {
      return spaces.find((space) => space.id === activeScopeId)
    }
  )

  const editorPlaceholder = derived(
    [
      floatingMenuShown,
      showPrompts,
      generatingPrompts,
      activeSpace,
      autocompleting,
      selectedContext,
      onboardingNote
    ],
    ([
      $floatingMenuShown,
      $showPrompts,
      $generatingPrompts,
      $activeSpace,
      $autocompleting,
      $selectedContext,
      $onboardingNote
    ]) => {
      if ($autocompleting) {
        return ''
      }

      if (showOnboarding) {
        if ($onboardingNote.id === 'intro') {
          return ``
        } else if ($onboardingNote.id === 'basics') {
          return `Press ${isMac() ? '⌘' : 'ctrl'} + ↵ to let Surf continue writing…`
        } else if ($onboardingNote.id === 'suggestions') {
          return `Press space to generate suggestions…`
        }
      }

      let contextName = ''
      if ($selectedContext) {
        if ($selectedContext === 'everything') {
          contextName = 'all your stuff'
        } else if ($selectedContext === 'tabs') {
          contextName = 'your tabs'
        } else if ($selectedContext === 'active-context') {
          contextName = 'the active context'
        } else if ($selectedContext === NO_CONTEXT_MENTION.id) {
          contextName = ''
        }
      } else if ($activeSpace) {
        contextName = `"${$activeSpace?.dataValue.folderName}"`
      }

      if ($floatingMenuShown) {
        if ($generatingPrompts) {
          const mentions = editorElem.getMentions()
          if (!contextName) {
            return `Generating suggestions based on the mentioned contexts…`
          }
          return `Generating suggestions based on "${contextName}"${mentions.length > 0 ? ' and the mentioned contexts' : ''}…`
        } else if ($showPrompts) {
          if (!contextName) {
            return `Select a suggestion or press ${isMac() ? '⌘' : 'ctrl'} + ↵ to let Surf continue writing…`
          }
          return `Select a suggestion or press ${isMac() ? '⌘' : 'ctrl'} + ↵ to let Surf write based on ${contextName}`
        } else {
          return `Write something or type / for commands…`
        }
      }

      return `Press ${isMac() ? '⌘' : 'ctrl'} + ↵ to autocomplete based on ${contextName}`
    }
  )

  const mentionItemsFetcher = createMentionsFetcher({ oasis, ai, resourceManager }, resourceId)

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
  let focusEditor: () => void
  let title = ''
  let chat: AIChat | null = null

  $: resource = note?.resource

  let editorElem: Editor
  let editorWrapperElem: HTMLElement

  const isEditorNodeEmptyAtPosition = (editor: TiptapEditor, position: number) => {
    return (
      (editor.view.domAtPos(position).node as HTMLElement).textContent.replaceAll(
        /[\s\\n\\t\\r]+/g,
        ''
      ).length <= 0
    )
  }

  const debouncedSaveContent = useDebounce((value: string) => {
    note?.saveContent(value)

    if (editorElem && !resource?.metadata?.name && autoGenerateTitle) {
      const { text } = editorElem.getParsedEditorContent()
      note?.generateTitle(text)
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

  const processDropResource = async (
    position: number,
    resource: Resource,
    tryToEmbed = false,
    coords: { x: number; y: number }
  ) => {
    const editor = editorElem.getEditor()

    const canonicalUrl = (resource?.tags ?? []).find(
      (tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL
    )?.value
    const canBeEmbedded =
      WEB_RESOURCE_TYPES.some((x) => resource?.type.startsWith(x)) && canonicalUrl

    if (resource.type.startsWith('image/')) {
      editor.commands.insertContentAt(
        position,
        `<resource id="${resource.id}" data-type="${resource.type}" data-expanded="true" />`
      )
    } else if (isGeneratedResource(resource) || canBeEmbedded) {
      openContextMenu({
        x: coords.x,
        y: coords.y,
        items: [
          {
            type: 'action',
            text: 'Insert as Embed',
            icon: 'world',
            action: () => {
              editor.commands.insertContentAt(
                position,
                `<resource id="${resource.id}" data-type="${resource.type}" data-expanded="true" />`
              )
            }
          },
          {
            type: 'action',
            text: 'Insert as Citation',
            icon: 'link',
            action: () => {
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
        ],
        key: Math.random().toString()
      })
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

    telemetry.trackNoteCreateCitation(
      resource.type,
      NoteCreateCitationEventTrigger.Drop,
      showOnboarding
    )
  }

  const processDropSpace = (position: number, space: OasisSpace) => {
    const editor = editorElem.getEditor()

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

    telemetry.trackNoteCreateCitation(
      DragTypeNames.SURF_SPACE,
      NoteCreateCitationEventTrigger.Drop,
      showOnboarding
    )
  }

  const handlePaste = async (e: ClipboardEvent) => {
    let toast: Toast | null = null
    e.preventDefault()
    try {
      var parsed = await processPaste(e)

      // NOTE: We only process files as other types are already handled by tiptap
      parsed = parsed.filter((e) => e.type === 'file')
      if (parsed.length <= 0) return

      toast = toasts.loading('Importing pasted items…')

      const newResources = await createResourcesFromMediaItems(resourceManager, parsed, '', [
        ResourceTag.paste()
      ])

      for (const resource of newResources) {
        if ($activeSpace) {
          oasis.addResourcesToSpace($activeSpace.id, [resource.id], SpaceEntryOrigin.ManuallyAdded)
        }
        const editor = editorElem.getEditor()
        const position = editor.view.state.selection.from

        await processDropResource(position, resource, true, { x: 0, y: 0 })
      }

      toast.success('Items imported!')
    } catch (e) {
      toast?.error('Failed to import pasted items!')

      log.error(e)
    }
  }

  const handleDrop = async (drag: DragculaDragEvent<DragTypes>) => {
    let toast: Toast | null = null
    try {
      const editor = editorElem.getEditor()
      const position = dragPosition ?? editor.view.state.selection.from
      const resolvedPos = editor.view.state.doc.resolve(position)
      const isBlock = !resolvedPos.parent.inlineContent

      log.debug('dropped something at', position, 'is block', isBlock)

      if (drag.isNative) {
        if (drag.dataTransfer?.getData('text/html')?.includes('<img ')) {
          toast = toasts.loading('Embedding image…')

          try {
            let srcUrl = drag.dataTransfer?.getData('text/html').split('<img ')[1].split('src="')[1]
            srcUrl = srcUrl.slice(0, srcUrl.indexOf('"'))
            log.debug('fetching dropped image url: ', srcUrl)

            const blob = await window.api.fetchRemoteBlob(srcUrl)

            const resource = await resourceManager.createResourceOther(
              blob,
              {
                name: srcUrl,
                sourceURI: srcUrl,
                alt: srcUrl,
                userContext: ''
              },
              [ResourceTag.dragBrowser()]
            )

            log.debug('Newly created image resource: ', resource)

            if ($activeSpace) {
              oasis.addResourcesToSpace(
                $activeSpace.id,
                [resource.id],
                SpaceEntryOrigin.ManuallyAdded
              )
            }

            await processDropResource(position, resource, isBlock)
          } catch (error) {
            log.error('Failed to embedd image: ', error)
            toast.error('Failed to embedd image!')
            drag.abort()
            return
          }

          toast.success('Image embedded!')
          drag.continue()
          return
        }
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
              processDropResource(
                position,
                resource,
                isEditorNodeEmptyAtPosition(editor, position) ? true : isBlock,
                {
                  x: drag.event.clientX,
                  y: drag.event.clientY
                }
              )
              drag.continue()
              return
            }
          } else {
            log.debug('Creating resource from tab', tab)
            toast = toasts.loading('Processing Tab…')
            const { resource } = await tabsManager.createResourceFromTab(tab, { silent: true })
            if (resource) {
              log.debug('Created resource from tab', resource)
              processDropResource(
                position,
                resource,
                isEditorNodeEmptyAtPosition(editor, position) ? true : isBlock,
                {
                  x: drag.event.clientX,
                  y: drag.event.clientY
                }
              )
              toast.success(isBlock ? 'Tab Embedded!' : 'Tab Linked!')
              drag.continue()
              return
            }
          }
        } else if (tab.type === 'space') {
          const space = await oasis.getSpace(tab.spaceId)
          if (space) {
            processDropSpace(position, space)
            drag.continue()
            return
          }
        }

        log.warn('Dropped tab but no resource found! Aborting drop!')
        drag.abort()
      } else if (drag.item!.data.hasData(DragTypeNames.SURF_SPACE)) {
        const space = drag.item!.data.getData(DragTypeNames.SURF_SPACE)

        log.debug('dropped space', space)
        processDropSpace(position, space)
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
        await processDropResource(
          position,
          resource,
          isEditorNodeEmptyAtPosition(editor, position) ? true : isBlock,
          {
            x: drag.event.clientX,
            y: drag.event.clientY
          }
        )

        drag.continue()
      }
    } catch (e) {
      log.error('Error handling drop', e)
      if (toast) {
        toast.error('Failed to handle drop')
      } else {
        toasts.error('Failed to handle drop')
      }
      drag.abort()
    }
  }

  const handleTitleBlur = () => {
    if (title) {
      if (note) {
        note.updateTitle(title)
      } else if (resourceId) {
        resourceManager.updateResourceMetadata(resourceId, { name: title })
      }

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
    log.debug('Resource linked to citation', resource)

    if (
      (!resource ||
        resource.type === ResourceTypes.PDF ||
        resource.type === ResourceTypes.LINK ||
        resource.type === ResourceTypes.ARTICLE ||
        resource.type.startsWith(ResourceTypes.POST)) &&
      !skipHighlight
    ) {
      if (source.metadata?.timestamp !== undefined && source.metadata?.timestamp !== null) {
        const timestamp = source.metadata.timestamp
        dispatch('seekToTimestamp', {
          resourceId: resource?.id,
          timestamp: timestamp,
          sourceUid: source.uid,
          source: source,
          preview: preview ?? false,
          context: EventContext.Note
        })
      } else {
        // TODO: pass correct from and trigger telemetry properties
        dispatch('highlightWebviewText', {
          resourceId: resource?.id,
          answerText: text,
          sourceUid: source.uid,
          source: source,
          preview: preview ?? false,
          context: EventContext.Note
        })
      }
    } else {
      if (preview) {
        if (resource) {
          globalMiniBrowser.openResource(resource.id, {
            from: OpenInMiniBrowserEventFrom.Note
          })
        } else {
          globalMiniBrowser.openWebpage(source.metadata?.url ?? '', {
            from: OpenInMiniBrowserEventFrom.Note
          })
        }
      } else {
        if (resource) {
          tabsManager.openResourcFromContextAsPageTab(resource.id, {
            active: true,
            trigger: CreateTabEventTrigger.NoteCitation
          })
        } else {
          tabsManager.addPageTab(source.metadata?.url ?? '', {
            active: true,
            trigger: CreateTabEventTrigger.NoteCitation
          })
        }
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

  export const submitChatMessage = async () => {
    try {
      if (!note) return

      const editor = editorElem.getEditor()
      const content = editor.getHTML()
      const query = getEditorContentText(content)

      if (!query.trim()) return

      // Submit the message and generate AI output
      await generateAndInsertAIOutput(query)
      return true
    } catch (err) {
      log.error('Error submitting chat message', err)
      return false
    }
  }

  const createNewNoteChat = async (mentions?: MentionItem[]) => {
    if (!contextManager) {
      log.error('No context manager found')
      return null
    }
    const chatContextManager = contextManager.clone()
    if (mentions && mentions.length > 0) {
      log.debug('Adding spaces to context', mentions)
      const contextMentions = mentions.filter((mention) => mention.type !== MentionItemType.MODEL)
      if (contextMentions.length > 0) {
        contextMentions.forEach((mention) => {
          chatContextManager.addMentionItem(mention)
        })
        ai.telemetry.trackPageChatContextUpdate(
          PageChatUpdateContextEventAction.Add,
          contextManager.itemsValue.length,
          mentions.length,
          undefined,
          PageChatUpdateContextEventTrigger.EditorMention
        )
      }
    } else if ($selectedContext) {
      log.debug('Adding selected context to context', $selectedContext)
      chatContextManager.addSpace($selectedContext)
    } else {
      log.debug('Adding active space to context', resourceId)
      chatContextManager.addActiveSpaceContext('resources')
    }
    const chat = await ai.createChat({ contextManager: chatContextManager })
    if (!chat) {
      log.error('Failed to create chat')
      return null
    }
    log.debug('Chat created', chat)
    const modelMention = (mentions ?? [])
      .reverse()
      .find((mention) => mention.type === MentionItemType.MODEL)
    log.debug('Model mention', modelMention)
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
    return chat
  }

  export const generateAndInsertAIOutput = async (
    query: string,
    systemPrompt?: string,
    mentions?: MentionItem[],
    trigger: PageChatMessageSentEventTrigger = PageChatMessageSentEventTrigger.NoteAutocompletion
  ) => {
    // Hide the caret popover when generation starts
    hidePopover()

    // Update both local and global AI generation state
    isGeneratingAI.set(true)
    startAIGeneration('text-resource', `Generating response to: ${query.substring(0, 30)}...`)

    try {
      if (note) {
        chat = await note.getChatWithMentions(mentions)
      } else {
        chat = await createNewNoteChat(mentions)
      }

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

      // Update progress
      updateAIGenerationProgress(25, 'Determining chat mode...')

      // TODO: chatMode is already also figured out in `createChatCompletion` API
      // we need to refactor this to avoid double calls
      const chatMode = await chat.getChatModeForNoteAndTab(query, editor.getText(), null)
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
        const outputContent =
          chatMode === ChatMode.AppCreation
            ? await parseChatOutputToSurfletCode(message)
            : await parseChatOutputToHtml(message)
        let outputNode = getLastNode('output')
        if (!outputNode) {
          log.error('No output node found')
          return
        }

        const tr = editor.view.state.tr
        const json = editorElem.generateJSONFromHTML(outputContent)
        const newOutputNode = editor.view.state.schema.nodeFromJSON({
          type: 'output',
          content: json.content
        })

        tr.replaceRangeWith(outputNode.range.from, outputNode.range.to, newOutputNode)
        editor.view.dispatch(tr)
      }, 15)

      // Use the note resource in the chat if the note is mentioned or automaticall if nothing is mentioned
      const useNoteResource =
        mentions?.some((mention) => mention.id === NOTE_MENTION.id) ||
        !mentions ||
        mentions.filter((mention) => mention.type !== MentionItemType.MODEL).length === 0

      const response = await chat.createChatCompletion(
        `${query} \n ${systemPrompt ?? ''}`,
        {
          trigger,
          onboarding: showOnboarding,
          noteResourceId: useNoteResource ? resourceId : undefined
        },
        renderFunction
      )

      log.debug('autocomplete response', response)

      // Remove wikipedia context if it was added as we might have created temporary resource that we don't want to keep around
      // Ignoring above for now citations to the resources otherwise won't work
      // const wikipediaContext = chat.contextManager.itemsValue.find(
      //   (item) => item.type === ContextItemTypes.WIKIPEDIA
      // )
      // if (wikipediaContext) {
      //   chat.contextManager.removeContextItem(wikipediaContext.id)
      // }

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
        const content =
          chatMode === ChatMode.AppCreation
            ? await parseChatOutputToSurfletCode(response.output)
            : await parseChatOutputToHtml(response.output)

        const loading = getLastNode('loading')
        if (loading) {
          editor.commands.deleteRange(loading.range)
        }

        const outputNode = getLastNode('output')
        if (!outputNode) {
          log.error('No output node found')
          editor.commands.insertContent(content, {
            updateSelection: false
          })
          return
        }

        const range = outputNode.range
        editor.commands.deleteRange(range)
        editor.commands.insertContentAt(range.from, content, {
          updateSelection: false
        })

        log.debug('inserted output', content)

        // insert new line
        // editor.commands.insertContentAt(range.to, '<br>', {
        //   updateSelection: false
        // })
      }
    } catch (err) {
      log.error('Error generating AI output', err)
      toasts.error('Failed to generate AI output')

      const loading = getLastNode('loading')
      if (loading) {
        const editor = editorElem.getEditor()
        editor.commands.deleteRange(loading.range)
      }

      // Update global AI generation state to indicate error
      updateAIGenerationProgress(100, 'Error generating AI output')
    } finally {
      // Reset both local and global generation state
      isGeneratingAI.set(false)
      endAIGeneration()
      autocompleting.set(false)
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
      const { id, type } = item

      telemetry.trackNoteOpenMention(getMentionType(id), action, showOnboarding)

      if (action === 'overlay') {
        if (id === INBOX_MENTION.id) {
          openSpaceInStuff('inbox')
        } else if (id === EVERYTHING_MENTION.id) {
          openSpaceInStuff('all')
        } else if (type === MentionItemType.RESOURCE) {
          oasis.openResourceDetailsSidebar(id, { select: true, selectedSpace: 'auto' })
        } else if (type === MentionItemType.CONTEXT) {
          openSpaceInStuff(id)
        } else {
          toasts.info('This is a built-in mention and cannot be opened')
        }
      } else {
        if (type === MentionItemType.BUILT_IN || type === MentionItemType.MODEL) {
          toasts.info('This is a built-in mention and cannot be opened')
          return
        }

        if (type === MentionItemType.RESOURCE) {
          tabsManager.openResourcFromContextAsPageTab(id, {
            active: action !== 'new-background-tab'
          })
          return
        }

        if (action === 'open') {
          tabsManager.changeScope(
            id === INBOX_MENTION.id || id === EVERYTHING_MENTION.id ? null : id,
            ChangeContextEventTrigger.Note
          )

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
      }
    } catch (e) {
      log.error('Error handling mention click', e)
      toasts.error('Failed to handle mention click')
    }
  }

  const handleMentionInsert = (e: CustomEvent<MentionItem>) => {
    const { id } = e.detail
    log.debug('mention insert', id)

    telemetry.trackNoteCreateMention(getMentionType(id), showOnboarding)
  }

  const handleRewrite = async (e: CustomEvent<EditorRewriteEvent>) => {
    try {
      const { prompt, text, range, mentions } = e.detail

      // const editor = editorElem.getEditor()
      // const tr = editor.view.state.tr
      // tr.delete(range.from, range.to)

      // editor.view.dispatch(tr)

      // await generateAndInsertAIOutput(text, INLINE_TRANSFORM.replace('${INSTRUCTION}', prompt), undefined, PageChatMessageSentEventTrigger.NoteRewrite)

      log.debug('Rewriting', prompt, text, range, mentions)

      hideInfoPopover()

      if (note) {
        chat = await note.getChatWithMentions(mentions)
      } else {
        chat = await createNewNoteChat(mentions)
      }

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
        const html = await parseChatOutputToHtml(response.output)

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

      if (note) {
        chat = await note.getChatWithMentions(mentions)
      } else {
        chat = await createNewNoteChat(mentions)
      }

      if (!chat) {
        log.error('Failed to create chat')
        return
      }

      // check if the active context is included in the chat.contextManager
      const items = chat.contextManager.itemsValue
      if (items.length === 0) {
        chat.contextManager.addActiveSpaceContext('resources')
      }

      const result = await chat.similaritySearch(text, {
        trigger: PageChatMessageSentEventTrigger.NoteSimilaritySearch,
        onboarding: showOnboarding
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

      if ((showOnboarding && $onboardingIndex < 3) || disableSimilaritySearch) {
        log.debug('Onboarding mode, skipping similarity search', $onboardingIndex)
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
          telemetry.trackNoteInsertSimilarSource(resource?.type, summarized, showOnboarding)
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

  const handleCaretPositionUpdate = (position: CaretPosition) => {
    if (position) {
      // Create a new object to ensure reactivity
      caretPosition = { ...position }

      // Don't show popover if AI generation is in progress
      if ($isGeneratingAI) {
        showCaretPopover = false
        return
      }

      // Use our utility to determine whether to show the popover
      if (editorElem) {
        const editor = editorElem.getEditor()
        updateCaretPopoverVisibility(editor, caretPosition, (visible) => {
          showCaretPopover = visible && !$isGeneratingAI
        })
      }
    }
  }

  const handleEditorKeyDown = (e: KeyboardEvent) => {
    // Only prevent propagation when the editor exists AND is focused
    if (editorElem) {
      // Prevent Option+Arrow or Command+Arrow keys from navigating the browser
      if (
        (e.altKey || e.metaKey) &&
        (e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight' ||
          e.key === 'ArrowUp' ||
          e.key === 'ArrowDown')
      ) {
        // Stop propagation to prevent the event from bubbling up
        e.stopPropagation()
      }
    }
  }

  const hidePopover = () => {
    showCaretPopover = false
  }

  const checkIfAlreadyRunning = (kind: string = 'ai generation') => {
    if ($isGeneratingAI) {
      log.debug(`Ignoring ${kind} request - AI generation already in progress`)
      toasts.info('AI generation already running, please wait')
      return true
    }

    return false
  }

  const handleCaretPopoverAutocomplete = () => {
    // Prevent starting a new generation if one is already running
    if (checkIfAlreadyRunning('caret autocomplete')) return

    // Trigger autocomplete like Opt+Enter would do
    if (editorElem) {
      editorElem.triggerAutocomplete()
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

      telemetry.trackNoteChangeContext(getMentionType(e.detail), showOnboarding)
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
        noteOnboarding.start()
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

  const handleSlashCommand = async (e: CustomEvent<SlashCommandPayload>) => {
    const { item, range } = e.detail
    log.debug('Slash command', item)

    if (item.id === 'autocomplete') {
      // Prevent starting a new generation if one is already running
      if (checkIfAlreadyRunning('slash autocomplete')) return

      editorElem.triggerAutocomplete()
    } else if (item.id === 'suggestions') {
      // Prevent starting a new generation if one is already running
      if (checkIfAlreadyRunning('slash suggestions')) return

      generatePrompts()
    } else if (item.id.startsWith('resource-')) {
      const resourceId = item.id.replace('resource-', '')
      const resource = await resourceManager.getResource(resourceId)
      if (!resource) {
        log.error('Resource not found', resourceId)
        return
      }

      const coords = editorElem
        .getEditor()
        .view.coordsAtPos(editorElem.getEditor().view.state.selection.from)

      processDropResource(range.from, resource, true, {
        x: coords.left,
        y: coords.top
      })
    } else {
      log.warn('Unknown slash command', item)
    }
  }

  const slashItemsFetcher: SlashItemsFetcher = async ({ query }) => {
    log.debug('fetching slash items', query)

    if (!query) {
      return BUILT_IN_SLASH_COMMANDS
    }

    const filteredActions = BUILT_IN_SLASH_COMMANDS.filter(
      (item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.keywords.some((keyword) => keyword.includes(query.toLowerCase()))
    )

    let stuffResults: SlashMenuItem[] = []

    if (query.length > 0) {
      const result = await resourceManager.searchResources(
        query,
        [
          ResourceManager.SearchTagDeleted(false),
          ResourceManager.SearchTagResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
          ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.SILENT),
          ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING)
        ],
        {
          semanticEnabled: $userSettings.use_semantic_search
        }
      )

      stuffResults = result
        .filter((item) => item.resource.id !== resourceId)
        .slice(0, 5)
        .map((item) => {
          const resource = item.resource

          log.debug('search result item', resource)

          const canonicalURL =
            (resource.tags ?? []).find((tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL)
              ?.value || resource.metadata?.sourceURI

          return {
            id: `resource-${resource.id}`,
            section: 'My Stuff',
            title:
              resource.metadata?.name ||
              (canonicalURL ? truncateURL(canonicalURL, 15) : getFileType(resource.type)),
            icon: canonicalURL ? `favicon;;${canonicalURL}` : `file;;${getFileKind(resource.type)}`
          } as SlashMenuItem
        })
    }

    return [...filteredActions, ...stuffResults]
  }

  const showOnboardingNote = async () => {
    const newTab = await tabsManager.create<TabResource>(
      {
        title: 'Intro to Surf Notes',
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
    showInfoPopover(
      'output[data-id="basics-query"]',
      `Press ${isMac() ? '⌥' : 'ctrl'} + ↵`,
      'right'
    )
  }

  const showSimilarityPopover = async () => {
    showInfoPopover('output[data-id="similarity-selection"]', `Select Text`, 'left')
  }

  let unsubscribeValue: () => void
  let unsubscribeContent: () => void
  let unsubscribeTitle: () => void

  $: if (!$floatingMenuShown) {
    $showPrompts = false
  }

  const handleAutocomplete = async (e: CustomEvent<EditorAutocompleteEvent>) => {
    try {
      log.debug('autocomplete', e.detail)

      // Prevent starting a new generation if one is already running
      if (checkIfAlreadyRunning('autocomplete')) return

      hideInfoPopover()

      const { query, mentions } = e.detail
      await generateAndInsertAIOutput(
        query,
        'Stay short and use citations!',
        mentions,
        PageChatMessageSentEventTrigger.NoteAutocompletion
      )
    } catch (e) {
      log.error('Error doing magic', e)
      toasts.error('Failed to autocomplete')
    }
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
          context: EventContext.Note,
          onboarding: showOnboarding
        }
      )

      if (!generatedPrompts) {
        log.error('Failed to generate prompts')
        toasts.error('Failed to generate suggestions')
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

  export const runPrompt = async (prompt: ChatPrompt) => {
    try {
      log.debug('Handling prompt submit', prompt)

      // Prevent starting a new generation if one is already running
      if (checkIfAlreadyRunning('run prompt')) return

      const mentions = editorElem.getMentions()

      telemetry.trackUsePrompt(PromptType.Generated, EventContext.Note, undefined, showOnboarding)

      hideInfoPopover()

      await generateAndInsertAIOutput(
        prompt.prompt,
        'Stay short and use citations!',
        mentions,
        PageChatMessageSentEventTrigger.NoteUseSuggestion
      )
    } catch (e) {
      log.error('Error doing magic', e)
      toasts.error('Failed to generate suggestion')
    }
  }

  export const insertText = (text: string, end = false) => {
    const editor = editorElem.getEditor()

    const currentPosition = editor.view.state.selection.from
    const position = end ? editor.view.state.doc.content.size : currentPosition
    editor.commands.insertContentAt(position, text, {
      updateSelection: false
    })

    if (end) {
      editor.commands.focus('end')
    } else {
      editor.commands.focus()
    }
  }

  export const replaceContent = (text: string) => {
    const editor = editorElem.getEditor()

    editorElem.setContent(text)
    editor.commands.focus('end')
  }

  onMount(async () => {
    // @ts-ignore
    window.wikipediaAPI = wikipediaAPI

    if (showOnboarding) {
      initialLoad = false
      title = $onboardingNote?.title ?? 'Onboarding'
      content.set($onboardingNote?.html ?? '')

      let currentIdx = $onboardingIndex

      unsubscribeContent = onboardingNote.subscribe((note) => {
        title = note.title
        content.set(note.html)
        dispatch('change-onboarding-note', note)

        hideInfoPopover()

        if (note.id === 'basics') {
          showBasicsPopover()
        } else if (note.id === 'similarity') {
          showSimilarityPopover()
        }

        const newIdx = $onboardingIndex
        if (newIdx !== currentIdx) {
          autofocus = true
          showPrompts.set(false)
          telemetry.trackNoteOnboardingChangeStep(newIdx, currentIdx)
          currentIdx = newIdx
        }
      })

      contentHash.set(generateContentHash($content))
      contextManager = ai.createContextManager()
      contextManager.clear()

      // await generatePrompts()

      selectedContext.set('everything')
      return
    } else if (showCodegenOnboarding) {
      initialLoad = false
      title = $onboardingNote?.title ?? 'Onboarding'
      content.set($onboardingNote?.html ?? '')

      contentHash.set(generateContentHash($content))
      contextManager = ai.createContextManager()
      contextManager.clear()
      selectedContext.set('everything')
      return
    }

    if (!note) {
      note = await smartNotes.getNote(resourceId)
      if (!note) {
        log.error('Note not found', resourceId)
        return
      }
    }

    const value = note.resource.parsedData
    unsubscribeValue = value.subscribe((value) => {
      if (value) {
        content.set(value)

        if (!editorFocused) {
          editorElem?.setContent(value)
        }
      }
    })

    await note.loadContent()

    initialLoad = false

    unsubscribeContent = content.subscribe((value) => {
      debouncedSaveContent(value ?? '')
    })

    title = note.titleValue ?? 'Untitled'
    unsubscribeTitle = note.title.subscribe((value) => {
      if (value) {
        title = value
      }
    })

    log.debug('text resource', resource, title, $content)

    contentHash.set(generateContentHash($content))

    if (!contextManager) {
      contextManager = note.contextManager
    }
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

    if (unsubscribeTitle) {
      unsubscribeTitle()
    }
  })
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="text-resource-wrapper text-gray-900 dark:text-gray-100"
  bind:clientWidth
  use:HTMLDragZone.action={{
    id: dragZoneId,
    accepts: (drag) => {
      if (drag.from?.id.startsWith(DRAG_ZONE_PREFIX)) return false
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
  on:paste={handlePaste}
>
  <div class="content">
    {#if showTitle}
      <div class="details-wrapper">
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
      </div>
    {/if}

    {#if !initialLoad}
      {#key `${showOnboarding}-${$onboardingNote.id}`}
        <div
          class="notes-editor-wrapper"
          bind:this={editorWrapperElem}
          on:keydown={handleEditorKeyDown}
        >
          <div class="editor-container">
            <Editor
              bind:this={editorElem}
              bind:focus={focusEditor}
              bind:content={$content}
              bind:floatingMenuShown={$floatingMenuShown}
              bind:focused={editorFocused}
              placeholder={emptyPlaceholder}
              placeholderNewLine={$editorPlaceholder}
              citationComponent={CitationItem}
              surfletComponent={Surflet}
              resourceComponent={EmbeddedResource}
              autocomplete
              floatingMenu
              readOnlyMentions={false}
              bubbleMenu={$showBubbleMenu &&
                !minimal &&
                (showOnboarding ? $onboardingIndex > 2 : true)}
              bubbleMenuLoading={$bubbleMenuLoading}
              autoSimilaritySearch={$userSettings.auto_note_similarity_search &&
                !minimal &&
                similaritySearch}
              enableRewrite={$userSettings.experimental_note_inline_rewrite}
              resourceComponentPreview={minimal}
              showDragHandle={!minimal}
              showSlashMenu={!minimal}
              showSimilaritySearch={!minimal && similaritySearch}
              parseMentions
              enableCaretIndicator={true}
              onCaretPositionUpdate={handleCaretPositionUpdate}
              {tabsManager}
              {slashItemsFetcher}
              {mentionItemsFetcher}
              on:blur={hidePopover}
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
              on:slash-command={handleSlashCommand}
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
              <div slot="caret-popover">
                <!-- CaretPopover positioned absolutely over the editor -->
                {#if showCaretPopover && caretPosition}
                  <CaretPopover
                    visible={showCaretPopover}
                    position={caretPosition}
                    on:autocomplete={handleCaretPopoverAutocomplete}
                  />
                {/if}
              </div>
            </Editor>
          </div>
        </div>
      {/key}
    {/if}
  </div>

  {#if showOnboarding}
    <div class="onboarding-wrapper">
      <OnboardingControls
        idx={noteOnboarding.idx}
        total={noteOnboarding.notes.length}
        canGoPrev={noteOnboarding.canGoPrev}
        canGoNext={noteOnboarding.canGoNext}
        title={showTitle ? undefined : title}
        on:prev={noteOnboarding.prev}
        on:next={noteOnboarding.next}
      />
    </div>
  {/if}

  {#if !minimal}
    {#if $similarityResults && similaritySearch}
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
    {/if}

    {#if !hideContextSwitcher}
      <div class="change-context-wrapper">
        <!-- <ModelPicker />

        <ChangeContextBtn
          spaces={oasis.spaces}
          {selectedContext}
          {activeSpace}
          on:select={handleSelectContext}
        /> -->
        {#if note}
          <ChatControls
            chatId={note.id}
            active={note.id === $activeNoteId}
            contextManager={note.contextManager}
            floating={false}
            excludeActiveTab
          />
        {/if}
      </div>
    {/if}

    {#if !showOnboarding && !manualContextControl}
      <button
        on:click={() => showOnboardingNote()}
        class="info-btn"
        use:tooltip={{ text: 'Intro to Surf Notes', position: 'right' }}
      >
        <Icon name="info" />
      </button>
    {/if}
  {/if}
</div>

<style lang="scss">
  .text-resource-wrapper {
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
    height: 100%;
    overflow: hidden;
    position: relative;
    padding-top: 3em;
    padding-bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2em;
  }

  :global([data-origin='homescreen']) {
    .content {
      padding-top: 0em;
    }
    :global(.notes-editor-wrapper .editor-wrapper div.tiptap) {
      padding: 0 !important;
    }
  }
  .details-wrapper {
    max-width: 730px;
    width: 100%;
    margin: auto;
    padding: 0 2em;
    box-sizing: content-box;
  }

  .details {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 1em;
    padding-bottom: 0.25em;
    border-bottom: 1px dashed #ddd;
    width: 100%;

    input {
      font-size: 2.25em;
      font-weight: 600;
      border: none;
      outline: none;
      background: transparent;
      padding: 0;
      margin: 0;
      width: 100%;

      font-family: SN Pro;
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
    gap: 0.5em;
    width: 100%;
    margin-bottom: 0.5em;
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
    // position: absolute;
    // top: 1em;
    // right: 1em;
    // z-index: 100;
    // display: flex;
    // align-items: center;
    // gap: 0.25em;
    position: absolute;
    bottom: 0;
    margin-left: auto;
    margin-right: auto;
    width: 100%;
    max-width: 730px;
  }

  .onboarding-wrapper {
    position: absolute;
    z-index: 100;
    left: 50%;
    bottom: 1.5em;
    transform: translateX(-50%);
  }

  .info-btn {
    position: fixed;
    top: 1em;
    left: 1em;
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
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    overflow: hidden;
    position: relative;
  }

  .editor-container {
    position: relative;
    height: 100%;
    width: 100%;
  }

  :global(.notes-editor-wrapper .editor-wrapper div.tiptap) {
    max-width: 730px;
    margin: auto;
    padding: 0 2em;
    box-sizing: content-box;
    padding-bottom: 12em;
  }

  :global(body.custom .text-resource-wrapper .tiptap ::selection) {
    color: var(--mixed-bg);
    background: var(--contrast-color);
  }
  :global(body.custom.dark .text-resource-wrapper .tiptap ::selection) {
    color: var(--mixed-bg-dark);
    background: var(--contrast-color);
  }

  :global(.tiptap) {
    overscroll-behavior: auto;

    :global(h1) {
      font-size: 1.875em;
      line-height: 1.3;
      font-weight: 600;
      margin-top: 2em;
      margin-bottom: 4px;
    }
    :global(h2) {
      font-size: 1.5em;
      font-weight: 600;
      line-height: 1.3;
      margin-top: 1.4em;
      margin-bottom: 1px;
    }
    :global(h3) {
      font-size: 1.25em;
      font-weight: 600;
      margin-top: 1em;
      margin-bottom: 1px;
      line-height: 1.3;
    }

    :global(h4) {
      font-size: 1.125em;
      font-weight: 600;
      margin-top: 1em;
      margin-bottom: 1px;
      line-height: 1.3;
    }
    :global(h5) {
      font-size: 1em;
      font-weight: 600;
      margin-top: 1em;
      margin-bottom: 1px;
      line-height: 1.3;
    }

    :global(ul li) {
      margin-block: 0.25em;
    }

    :global(input[type='checkbox']) {
      width: 1em;
      accent-color: var(--contrast-color) !important;
    }

    :global(pre) {
      background: #030712;
      margin: 1em 0;
      padding: 1em;
      border-radius: 4px;
      overflow-x: auto;

      :global(code) {
        color: #fff;
        :global(.hljs-*) {
          color: inherit;
        }
      }
    }

    :global(code:not(pre code)) {
      background: #030712;
      padding: 0.2em 0.4em;
      font-size: 0.9em;
    }

    :global(.dark) & {
      :global(*):not(.mention, a) {
        color: var(--text-color-dark) !important;
      }
    }
  }
</style>
