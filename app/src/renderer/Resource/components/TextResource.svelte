<script lang="ts" context="module">
  // prettier-ignore
  export type ChatSubmitOptions = {
    focusEnd: boolean
    focusInput: boolean
    autoScroll: boolean
    showPrompt: boolean
    clearContextOnMention?: boolean
    generationID?: string
    screenshot?: Blob
    addActiveTab?: boolean
  };
</script>

<script lang="ts">
  import { writable, derived, type Writable, get } from 'svelte/store'
  import { createEventDispatcher, onDestroy, onMount, tick } from 'svelte'
  import tippy, { type Instance, type Placement, type Props } from 'tippy.js'
  import type { Editor as TiptapEditor } from '@tiptap/core'

  import {
    Editor,
    getEditorContentText,
    MentionItemType,
    type EditorAutocompleteEvent,
    type EditorRewriteEvent,
    type MentionItem,
    type Range
  } from '@deta/editor'
  import '@deta/editor/src/editor.scss'

  import { Resource, useResourceManager } from '@deta/services/resources'
  import {
    generateID,
    getFileKind,
    getFileType,
    getFormattedDate,
    isMac,
    isModKeyPressed,
    parseSurfProtocolURL,
    truncateURL,
    useDebounce,
    useLocalStorageStore,
    useLogScope,
    useThrottle,
    wait,
    htmlToMarkdown,
    isDev,
    conditionalArrayItem,
    markdownToHtml
  } from '@deta/utils'
  import CitationItem from './CitationItem.svelte'
  import { generateContentHash, mapCitationsToText, parseChatOutputToHtml } from '@deta/services/ai'
  import {
    startAIGeneration,
    endAIGeneration,
    updateAIGenerationProgress,
    isGeneratingAI as globalIsGeneratingAI
  } from '@deta/services/ai'
  import {
    EventContext,
    GeneratePromptsEventTrigger,
    isWebResourceType,
    MentionEventType,
    NoteCreateCitationEventTrigger,
    PageChatMessageSentEventError,
    PageChatMessageSentEventTrigger,
    PageChatUpdateContextEventAction,
    PageChatUpdateContextEventTrigger,
    PromptType,
    ResourceTagsBuiltInKeys,
    ResourceTypes,
    ViewLocation,
    type CitationClickData,
    type CitationInfo
  } from '@deta/types'
  import {
    DragTypeNames,
    type AIChatMessageParsed,
    type AIChatMessageSource,
    type DragTypes,
    type CitationClickEvent
  } from '@deta/types'
  import { AIChat, useAI, type ChatPrompt } from '@deta/services/ai'
  import { type ContextManager } from '@deta/services/ai'
  import {
    INLINE_TRANSFORM,
    SMART_NOTES_SUGGESTIONS_GENERATOR_PROMPT
  } from '@deta/services/constants'
  import type { MentionAction } from '@deta/editor/src/lib/extensions/Mention'
  import { type AITool, ModelTiers, Provider } from '@deta/types/src/ai.types'
  import { useConfig } from '@deta/services'
  import { createWikipediaAPI, WebParser } from '@deta/web-parser'
  import EmbeddedResource from './EmbeddedResource.svelte'
  import { isGeneratedResource } from '@deta/services/resources'
  import {
    MODEL_CLAUDE_MENTION,
    MODEL_GPT_MENTION,
    NO_CONTEXT_MENTION,
    NOTE_MENTION,
    EVERYTHING_MENTION,
    INBOX_MENTION
  } from '@deta/services/constants'
  import type {
    SlashCommandPayload,
    SlashMenuItem
  } from '@deta/editor/src/lib/extensions/Slash/index'
  import type { SlashItemsFetcher } from '@deta/editor/src/lib/extensions/Slash/suggestion'
  import { BUILT_IN_SLASH_COMMANDS } from '@deta/editor/src/lib/extensions/Slash/actions'
  import Surflet from './Surflet.svelte'
  import WebSearch from './WebSearch.svelte'
  import { createResourcesFromMediaItems, processPaste } from '@deta/services'
  import { predefinedSurfletCode } from './predefinedSurflets'
  import { createRemoteMentionsFetcher, createResourcesMentionsFetcher } from '@deta/services/ai'
  import type { LinkClickHandler } from '@deta/editor/src/lib/extensions/Link/helpers/clickHandler'
  import { EditorAIGeneration, NoteEditor } from '@deta/services/ai'
  import { CHAT_TITLE_GENERATOR_PROMPT, AI_TOOLS } from '@deta/services/constants'
  import ChatInput from './ChatInput.svelte'
  import { SearchResourceTags, ResourceTag } from '@deta/utils/formatting'
  import type { ResourceNote, ResourceJSON } from '@deta/services/resources'
  import { type MessagePortClient, type AIQueryPayload } from '@deta/services/messagePort'
  import { promptForFilesAndTurnIntoResourceMentions } from '@deta/services'

  export let resourceId: string
  export let autofocus: boolean = true
  export let showTitle: boolean = true
  export let showOnboarding: boolean = false
  export let minimal: boolean = false
  export let similaritySearch: boolean = false
  export let contextManager: ContextManager | undefined = undefined
  export let messagePort: MessagePortClient
  export let resource: ResourceNote | ResourceJSON
  export let origin: string = ''
  export let onCitationClick: (event: CitationClickEvent) => void

  const log = useLogScope('TextCard')
  const resourceManager = useResourceManager()
  const ai = useAI()
  const config = useConfig()
  const wikipediaAPI = createWikipediaAPI()

  const dispatch = createEventDispatcher<{
    'update-title': string
    changed: void
  }>()

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
  // Local store that syncs with the global AI generation state
  const isGeneratingAI = writable(false)
  // State for tracking title generation specifically
  const isGeneratingTitle = writable(false)
  // We use these to determine whether to display the big prompt bubbles
  // need to wire thi back when fixing the prompts with the new input bar
  const isEmpty = writable(false)

  const tools = writable<AITool[]>(AI_TOOLS)

  const floatyBarState = writable<'inline' | 'floaty' | 'bottom'>('inline')
  const inlineBarStyle = derived(
    [floatyBarState, isGeneratingAI],
    ([$floatyBarState, $isGeneratingAI]) => {
      // TODO: @maxu / maxi): Ideally we keep it in the floaty state and let it figure out its position
      // by itself, but due to the way we insert text into the editor rn this looks reeeealy janky
      // fixed it to bottom for now
      //if ($isGeneratingAI) return $floatyBarState !== 'inline' ? $floatyBarState : 'bottom'
      if ($isGeneratingAI) return 'bottom'
      else return $floatyBarState
    }
  )
  const handleFloatyInputStateUpdate = (e: CustomEvent<'inline' | 'floaty' | 'bottom'>) => {
    floatyBarState.set(e.detail)
  }
  const lastLineVisible = writable<boolean>(true)
  const isTitleFocused = writable<boolean>(false)

  let viewLocation: ViewLocation

  const handleLastLineVisibilityChanged = (e: CustomEvent<boolean>) => {
    lastLineVisible.set(e.detail)
  }

  // Handler to detect when cursor is in TitleNode
  const handleEditorSelectionUpdate = () => {
    const editor = editorElem?.getEditor()
    if (!editor || !showTitle) {
      isTitleFocused.set(false)
      return
    }

    const { state } = editor
    const { selection } = state
    const { $from, $to } = selection

    // Check if cursor is in titleNode
    const isInTitle = $from.parent.type.name === 'titleNode' && $to.parent.type.name === 'titleNode'
    isTitleFocused.set(isInTitle)
  }

  const generateTitle = async (query: string) => {
    try {
      log.debug('Generating note title', query)

      // Set loading state for title generation
      isGeneratingTitle.set(true)

      // Update TitleNode loading state if it's enabled
      if (showTitle && !readOnlyMode && editorElem) {
        const editor = editorElem.getEditor()
        if (editor && editor.commands.setTitleLoading) {
          editor.commands.setTitleLoading(true)
        }
      }

      const completion = await ai.createChatCompletion(
        JSON.stringify({ message: query }),
        CHAT_TITLE_GENERATOR_PROMPT,
        { tier: ModelTiers.Standard }
      )

      log.debug('title completion', completion)

      if (completion.error) {
        log.error('Failed to generate title', completion.error)
        return null
      }

      if (!completion.output) {
        log.error('Failed to generate title, no output')
        return null
      }

      const generatedTitle = completion.output.trim() ?? query
      title = generatedTitle

      // Update TitleNode if it's enabled
      if (showTitle && !readOnlyMode && editorElem) {
        const editor = editorElem.getEditor()
        if (editor && editor.commands.setTitle) {
          editor.commands.setTitle(generatedTitle)
        }
      }

      await resourceManager.updateResourceMetadata(resourceId, { name: generatedTitle })

      return generatedTitle
    } catch (err) {
      log.error('Error generating title:', err)
      return null
    } finally {
      // Reset loading state
      isGeneratingTitle.set(false)

      // Update TitleNode loading state if it's enabled
      if (showTitle && !readOnlyMode && editorElem) {
        const editor = editorElem.getEditor()
        if (editor && editor.commands.setTitleLoading) {
          editor.commands.setTitleLoading(false)
        }
      }
    }
  }

  const handleNoteRunQuery = async (payload: AIQueryPayload) => {
    try {
      if (payload.query) {
        log.debug('Found ask query param:', payload)

        generateTitle(payload.query)

        if (contextManager) {
          await contextManager.clear()
        }

        if (payload.mentions.length > 0) {
          log.debug(`Inserting ${payload.mentions.length} mentions from query:`, payload.mentions)
          for (const mentionItem of payload.mentions) {
            insertMention(mentionItem)
          }
        }

        if (payload.queryLabel) {
          insertMention(undefined, payload.queryLabel)
        }

        tools.update((tools) =>
          tools.map((tool) => ({ ...tool, active: payload.tools[tool.id] ?? tool.active }))
        ) // make sure we have the latest state

        await generateAndInsertAIOutput(
          payload.query,
          payload.mentions,
          PageChatMessageSentEventTrigger.NoteUseSuggestion,
          { focusEnd: true, autoScroll: false, showPrompt: !payload.queryLabel, focusInput: true }
        )
      }
    } catch (err) {
      log.error('Error checking for ask query param:', err)
    }
  }

  const refreshContent = async () => {
    if (resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE) {
      await resource.getContent(true)

      log.debug('Refreshed note content', resource, resource.contentValue)
    } else {
      const data = await resource.getParsedData()
      const parsedContent = WebParser.getResourceContent(resource.type, data)

      const text = parsedContent.html || parsedContent.plain || ''
      const html = await markdownToHtml(text)
      content.set(html)
    }

    await tick()

    if (editorElem) {
      editorElem.setContent(get(content) || '')
    }
  }

  // Set up synchronization between local and global state
  onMount(() => {
    // @ts-ignore
    window.wikipediaAPI = wikipediaAPI

    // Add event listener for onboarding mention
    document.addEventListener(
      'insert-onboarding-mention',
      handleInsertOnboardingMention as EventListener
    )

    // Setup async operations separately from onMount's return
    const setupAsync = async () => {
      // Subscribe to global state and update local state
      const unsubscribeGlobal = globalIsGeneratingAI.subscribe((isGenerating) => {
        isGeneratingAI.set(isGenerating)
      })

      // Add event listener for UseAsDefaultBrowser extension
      document.addEventListener(
        'insert-use-as-default-browser',
        handleInsertUseAsDefaultBrowser as EventListener
      )

      // Add event listener for onboarding footer with links
      document.addEventListener(
        'insert-onboarding-footer',
        handleInsertOnboardingFooter as EventListener
      )

      // Add event listener for button insertion
      document.addEventListener('insert-button-to-note', handleInsertButtonToNote as EventListener)

      // if (!note) {
      //   note = await smartNotes.getNote(resourceId)
      //   if (!note) {
      //     log.error('Note not found', resourceId)
      //     return
      //   }
      // }

      let value: Writable<string>

      if (resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE) {
        value = resource.parsedData
        await resource.getContent()
      } else {
        const data = await resource.getParsedData()
        const content = WebParser.getResourceContent(resource.type, data)

        const text = content.html || content.plain || ''
        const html = await markdownToHtml(text)
        value = writable(html)
      }

      title = resource.metadata.name ?? 'Untitled'

      unsubs.push(
        value.subscribe((value) => {
          if (value) {
            content.set(value)

            if (!editorFocused) {
              editorElem?.setContent(value)
            }
          }
        }),

        content.subscribe((value) => {
          debouncedSaveContent(value ?? '')

          if (editorElem) {
            isEmpty.set(editorElem.isEmptyy())
          }
        })

        // note.title.subscribe((value) => {
        //   if (value) {
        //     title = value
        //   }
        // })
      )

      initialLoad = false

      log.debug('text resource', resource, title, $content)

      contentHash.set(generateContentHash($content))

      // if (!contextManager) {
      //   contextManager = note.contextManager
      // }

      await wait(50)

      // Scroll to top after DOM has updated and Editor is mounted
      await tick()

      // Add event listeners for surflet events
      const handleCreateSurfletEvent = (e: CustomEvent) => {
        log.debug('Received create-surflet event', e.detail)
        handleCreateSurflet(e.detail?.code)
      }

      const handleUpdateSurfletEvent = (e: CustomEvent) => {
        log.debug('Received update-surflet event', e.detail)
        updateSurfletContent(e.detail?.code)
      }

      const handleOpenStuffEvent = () => {
        log.debug('Received onboarding-open-stuff event')
        // tabsManager.showNewTabOverlay.set(2)
      }

      if (editorElem) {
        isEmpty.set(editorElem.isEmptyy())
      }

      if (editorElement) {
        editorElement.addEventListener('scroll', handleScroll)
      }

      if (editorElem && editorElement) {
        const editor = editorElem.getEditor()
        const noteEditor = NoteEditor.create(editor, editorElem, editorElement)
      }

      document.addEventListener('create-surflet', handleCreateSurfletEvent as EventListener)
      document.addEventListener('onboarding-open-stuff', handleOpenStuffEvent as EventListener)
      document.addEventListener('update-surflet', handleUpdateSurfletEvent as EventListener)

      log.debug('Text resource setup complete')
      messagePort.noteReady.send()

      return () => {
        document.removeEventListener('create-surflet', handleCreateSurfletEvent as EventListener)
        document.removeEventListener('onboarding-open-stuff', handleOpenStuffEvent as EventListener)
        document.removeEventListener('update-surflet', handleUpdateSurfletEvent as EventListener)
      }
    }

    unsubs.push(
      messagePort.noteRunQuery.handle((payload) => {
        log.debug('Received note-run-query event', payload)
        handleNoteRunQuery(payload)
      }),

      messagePort.noteInsertMentionQuery.handle((payload) => {
        log.debug('Received note-insert-mention-query event', payload)
        insertMention(payload.mention, payload.query)
      }),

      messagePort.noteRefreshContent.handle(() => {
        log.debug('Received note-refresh-content event')
        refreshContent()
      }),

      messagePort.viewMounted.handle(({ location }) => {
        log.debug('Received view-mounted event', location)
        viewLocation = location

        if (viewLocation === ViewLocation.Sidebar && contextManager) {
          const mentions = editorElem.getMentions()
          contextManager.getPrompts({ mentions })
        }
      }),

      messagePort.activeTabChanged.handle(() => {
        log.debug('Received active-tab-changed event', viewLocation, contextManager)
        if (viewLocation === ViewLocation.Sidebar && contextManager) {
          const mentions = editorElem.getMentions()
          contextManager.getPrompts({ mentions })
        }
      })
    )

    // Start the async setup without waiting for it
    setupAsync()

    // Return the cleanup function directly (not in a Promise)
    return () => {
      document.removeEventListener(
        'insert-onboarding-mention',
        handleInsertOnboardingMention as EventListener
      )

      // Remove the UseAsDefaultBrowser event listener
      document.removeEventListener(
        'insert-use-as-default-browser',
        handleInsertUseAsDefaultBrowser as EventListener
      )

      // Remove the onboarding footer event listener
      document.removeEventListener(
        'insert-onboarding-footer',
        handleInsertOnboardingFooter as EventListener
      )

      // Remove the button insertion event listener
      document.removeEventListener(
        'insert-button-to-note',
        handleInsertButtonToNote as EventListener
      )
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
  let disableAutoscroll = false
  let focusInlineBar: () => void

  let focusInput: () => void

  const editorPlaceholder = writable<string>(`Write or type / for commands…`)
  const mentionItemsFetcher = createRemoteMentionsFetcher(resourceId) // createMentionsFetcher({ ai, resourceManager }, resourceId)
  const linkItemsFetcher = createResourcesMentionsFetcher(resourceManager, resourceId)

  let initialLoad = true
  let focusEditor: () => void
  let title = ''
  let chat: AIChat | null = null

  let editorElem: Editor
  let chatInputComp: ChatInput
  let chatInputEditorElem: Editor
  let editorElement: HTMLElement
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
    resource.updateContent(value)

    if (value && !editorElem?.isEmptyy()) {
      resourceManager.unmarkResourceAsEmpty(resourceId)
    }

    // if (editorElem && !resource?.metadata?.name && autoGenerateTitle) {
    //   const { text } = editorElem.getParsedEditorContent()
    //   resource.generateTitle(text)
    // }
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

  const insertResourceEmbed = async (resource: Resource, position: number) => {
    await resourceManager.preventHiddenResourceFromAutodeletion(resource)

    const editor = editorElem.getEditor()
    const html = `<resource id="${resource.id}" data-type="${resource.type}" data-expanded="true" />`
    editor.commands.insertContentAt(position, html)
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
    const canBeEmbedded = isWebResourceType(resource.type) && canonicalUrl

    if (resource.type.startsWith('image/')) {
      insertResourceEmbed(resource, position)
    } else if (isGeneratedResource(resource) || canBeEmbedded) {
      insertResourceEmbed(resource, position)
      // openContextMenu({
      //   x: coords.x,
      //   y: coords.y,
      //   items: [
      //     {
      //       type: 'action',
      //       text: 'Insert as Embed',
      //       icon: 'world',
      //       action: () => {
      //         insertResourceEmbed(resource, position)
      //       }
      //     },
      //     {
      //       type: 'action',
      //       text: 'Insert as Citation',
      //       icon: 'link',
      //       action: () => {
      //         const citationElem = createCitationHTML({
      //           id: resource.id,
      //           metadata: {
      //             url: resource.url
      //           },
      //           resource_id: resource.id,
      //           all_chunk_ids: [resource.id],
      //           render_id: resource.id,
      //           content: ''
      //         })

      //         editor.commands.insertContentAt(position, citationElem)
      //       }
      //     }
      //   ],
      //   key: Math.random().toString()
      // })
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
  }

  const handleEditorFilePaste = async (e: CustomEvent<{ files: File[]; htmlData?: string }>) => {
    try {
      const { files, htmlData } = e.detail

      let parsed: any[] = []

      // If we have direct files, use them
      if (files.length > 0) {
        parsed = files.map((file) => ({
          data: file as Blob,
          type: 'file' as const,
          metadata: {
            name: file.name || 'pasted-image',
            alt: '',
            sourceURI: (file as any)?.path
          }
        }))
      }
      // Otherwise, if we have HTML with images, extract them and preserve text
      else if (htmlData) {
        const div = document.createElement('div')
        div.innerHTML = htmlData
        const images = Array.from(div.querySelectorAll('img'))

        // If there are images, we need to handle mixed content
        if (images.length > 0) {
          const editor = editorElem.getEditor()
          const startPosition = editor.view.state.selection.from

          // Create a map of image elements to their resource data
          const imageMap = new Map<HTMLImageElement, string>()
          images.forEach((img, index) => {
            const placeholder = `__IMAGE_PLACEHOLDER_${index}__`
            imageMap.set(img, placeholder)
          })

          // Replace images with placeholders to preserve structure
          images.forEach((img) => {
            const placeholder = imageMap.get(img)!
            const span = document.createElement('span')
            span.setAttribute('data-image-placeholder', placeholder)
            span.textContent = placeholder
            img.replaceWith(span)
          })

          // Get the HTML with placeholders
          let htmlWithPlaceholders = div.innerHTML

          // Check if there's meaningful text content
          const textOnly = div.textContent?.replace(/__IMAGE_PLACEHOLDER_\d+__/g, '').trim()
          const hasText = textOnly && textOnly.length > 0

          if (hasText) {
            // Insert the HTML content with placeholders
            editor.commands.insertContentAt(startPosition, htmlWithPlaceholders)

            // Now replace each placeholder with the actual image resource
            for (const [img, placeholder] of imageMap.entries()) {
              try {
                // Find the placeholder in the document
                const { state } = editor.view
                let placeholderPos = -1

                state.doc.descendants((node, pos) => {
                  if (node.isText && node.text?.includes(placeholder)) {
                    placeholderPos = pos + (node.text.indexOf(placeholder) || 0)
                    return false
                  }
                })

                if (placeholderPos === -1) continue

                // Fetch the image
                const response = await fetch(img.src)
                const blob = await response.blob()
                const file = new File([blob], 'pasted-image.png', {
                  type: blob.type || 'image/png'
                })

                const imageResources = await createResourcesFromMediaItems(
                  resourceManager,
                  [
                    {
                      data: file,
                      type: 'file' as const,
                      metadata: {
                        name: file.name,
                        alt: img.alt || '',
                        sourceURI: img.src
                      }
                    }
                  ],
                  '',
                  [ResourceTag.paste(), ResourceTag.silent()]
                )

                if (imageResources[0]) {
                  // Delete the placeholder text
                  editor.commands.deleteRange({
                    from: placeholderPos,
                    to: placeholderPos + placeholder.length
                  })
                  // Insert the resource at that position
                  await processDropResource(placeholderPos, imageResources[0], true, { x: 0, y: 0 })
                }
              } catch (err) {
                log.error('Failed to fetch image:', img.src, err)
              }
            }

            return
          }
        }

        // If no text or only images, just extract images
        for (const img of images) {
          try {
            const response = await fetch(img.src)
            const blob = await response.blob()
            const file = new File([blob], 'pasted-image.png', { type: blob.type || 'image/png' })

            parsed.push({
              data: file,
              type: 'file' as const,
              metadata: {
                name: file.name,
                alt: img.alt || '',
                sourceURI: img.src
              }
            })
          } catch (err) {
            log.error('Failed to fetch image:', img.src, err)
          }
        }
      }

      if (parsed.length === 0) return

      const newResources = await createResourcesFromMediaItems(resourceManager, parsed, '', [
        ResourceTag.paste(),
        ResourceTag.silent()
      ])

      for (const resource of newResources) {
        const editor = editorElem.getEditor()
        const position = editor.view.state.selection.from

        await processDropResource(position, resource, true, { x: 0, y: 0 })
      }
    } catch (err) {
      log.error(err)
    }
  }

  const handlePaste = async (e: ClipboardEvent) => {
    e.preventDefault()
    try {
      var parsed = await processPaste(e)

      // NOTE: We only process files as other types are already handled by tiptap
      parsed = parsed.filter((e) => e.type === 'file')
      if (parsed.length <= 0) return

      const newResources = await createResourcesFromMediaItems(resourceManager, parsed, '', [
        ResourceTag.paste(),
        ResourceTag.silent()
      ])

      for (const resource of newResources) {
        // if ($activeSpace) {
        //   oasis.addResourcesToSpace($activeSpace.id, [resource.id], SpaceEntryOrigin.ManuallyAdded)
        // }
        const editor = editorElem.getEditor()
        const position = editor.view.state.selection.from

        await processDropResource(position, resource, true, { x: 0, y: 0 })
      }
    } catch (e) {
      log.error(e)
    }
  }

  const handleDrop = async (drag) => {
    try {
      const editor = editorElem.getEditor()
      const position = dragPosition ?? editor.view.state.selection.from
      const resolvedPos = editor.view.state.doc.resolve(position)
      const isBlock = !resolvedPos.parent.inlineContent

      log.debug('dropped something at', position, 'is block', isBlock)

      if (drag.isNative) {
        if (drag.dataTransfer?.getData('text/html')?.includes('<img ')) {
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

            // if ($activeSpace) {
            //   oasis.addResourcesToSpace(
            //     $activeSpace.id,
            //     [resource.id],
            //     SpaceEntryOrigin.ManuallyAdded
            //   )
            // }

            await processDropResource(position, resource, isBlock)
          } catch (error) {
            log.error('Failed to embedd image: ', error)
            drag.abort()
            return
          }

          drag.continue()
          return
        }
        // } else if (drag.item!.data.hasData(DragTypeNames.SURF_TAB)) {
        //   const tabId = drag.item!.data.getData(DragTypeNames.SURF_TAB).id
        //   const tab = await tabsManager.get(tabId)
        //   if (!tab) {
        //     log.error('Tab not found', tabId)
        //     drag.abort()
        //     return
        //   }

        //   log.debug('dropped tab', tab)

        //   if (tab.type === 'page') {
        //     if (tab.resourceBookmark && tab.resourceBookmarkedManually) {
        //       log.debug('Tab already bookmarked', tab.resourceBookmark)
        //       const resource = await resourceManager.getResource(tab.resourceBookmark)
        //       if (resource) {
        //         processDropResource(
        //           position,
        //           resource,
        //           isEditorNodeEmptyAtPosition(editor, position) ? true : isBlock,
        //           {
        //             x: drag.event.clientX,
        //             y: drag.event.clientY
        //           }
        //         )
        //         drag.continue()
        //         return
        //       }
        //     } else {
        //       log.debug('Creating resource from tab', tab)
        //       const { resource } = await tabsManager.createResourceFromTab(tab, { silent: true })
        //       if (resource) {
        //         log.debug('Created resource from tab', resource)
        //         processDropResource(
        //           position,
        //           resource,
        //           isEditorNodeEmptyAtPosition(editor, position) ? true : isBlock,
        //           {
        //             x: drag.event.clientX,
        //             y: drag.event.clientY
        //           }
        //         )
        //         drag.continue()
        //         return
        //       }
        //     }
        //   } else if (tab.type === 'space') {
        //     const space = await oasis.getSpace(tab.spaceId)
        //     if (space) {
        //       processDropSpace(position, space)
        //       drag.continue()
        //       return
        //     }
        //   }

        //   log.warn('Dropped tab but no resource found! Aborting drop!')
        //   drag.abort()
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
      drag.abort()
    }
  }

  const handleTitleChange = (newTitle: string) => {
    title = newTitle
    if (resourceId) {
      resourceManager.updateResourceMetadata(resourceId, { name: title })
    }

    document.title = title

    dispatch('update-title', title)
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

    onCitationClick?.({
      resourceId: resource?.id || source?.resource_id,
      url: source?.metadata?.url,
      preview: preview ?? false,
      skipHighlight: skipHighlight,
      selection: {
        source,
        sourceUid: source?.uid,
        text: text,
        timestamp: source?.metadata?.timestamp
      }
    })
  }

  const createNewNote = async (title?: string) => {
    const resource = await resourceManager.createResourceNote(
      '',
      { name: title ?? `Note ${getFormattedDate(Date.now())}` },
      undefined,
      true
    )
    // await tabsManager.openResourceAsTab(resource, { active: true })
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

  export const submitChatMessage = async () => {
    try {
      const editor = editorElem.getEditor()
      const content = editor.getHTML()
      const query = getEditorContentText(content)

      if (!query.trim()) return

      if (contextManager) {
        await contextManager.clear()
      }

      // Submit the message and generate AI output
      await generateAndInsertAIOutput(query)
      return true
    } catch (err) {
      log.error('Error submitting chat message', err)
      return false
    }
  }

  const createNewNoteChat = async (mentions?: MentionItem[]) => {
    const chatContextManager = ai.contextManager
    if (mentions && mentions.length > 0) {
      log.debug('Adding spaces to context', mentions)
      const contextMentions = mentions.filter((mention) => mention.type !== MentionItemType.MODEL)
      if (contextMentions.length > 0) {
        contextMentions.forEach((mention) => {
          chatContextManager.addMentionItem(mention)
        })
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
    mentions?: MentionItem[],
    trigger: PageChatMessageSentEventTrigger = PageChatMessageSentEventTrigger.NoteAutocompletion,
    opts?: Partial<ChatSubmitOptions>,
    loadingMessage?: string
  ) => {
    const options = {
      focusEnd: opts?.focusEnd ?? false,
      focusInput: opts?.focusInput ?? false,
      autoScroll: opts?.autoScroll ?? false,
      showPrompt: opts?.showPrompt ?? false,
      clearContextOnMention: opts?.clearContextOnMention ?? false,
      generationID: opts?.generationID
    } as ChatSubmitOptions

    const editor = editorElem.getEditor()
    const noteEditor = NoteEditor.create(editor, editorElem, editorElement)

    const enabledTools = get(tools).filter((tool) => tool.active)
    const toolsConfiguration = {
      websearch: enabledTools.some((tool) => tool.id === 'websearch'),
      surflet: enabledTools.some((tool) => tool.id === 'surflet')
    }

    // Update both local and global AI generation state
    isGeneratingAI.set(true)
    startAIGeneration('text-resource', `Generating response to: ${query.substring(0, 30)}...`)
    chatInputComp?.showStatus({
      type: 'status',
      value: loadingMessage || 'Thinking...'
    })

    if (options.focusEnd) {
      editorElem.focusEnd()
    }

    if (options.autoScroll) {
      disableAutoscroll = false
    }

    let aiGeneration: EditorAIGeneration | null = null

    try {
      chat = await createNewNoteChat(mentions)

      if (!chat || !query) {
        log.error('Failed to create chat')
        updateAIGenerationProgress(100, 'Error generating AI output')
        return
      }

      const currentPosition = editor.view.state.selection.from

      autocompleting.set(true)

      // TODO: handle rewriting again to skip the output block
      // const replace = trigger === PageChatMessageSentEventTrigger.NoteRewrite

      let createdLoading = false

      // Update progress
      updateAIGenerationProgress(25, 'Determining chat mode...')

      const textQuery = getEditorContentText(query)

      aiGeneration = noteEditor.createAIGeneration(currentPosition, {
        id: options.generationID,
        textQuery: textQuery,
        autoScroll: options.autoScroll,
        showPrompt: options.showPrompt,
        loadingMessage: loadingMessage
      })

      if (options.focusInput) {
        focusChatInput()
      }

      // TODO: chatMode is already also figured out in `createChatCompletion` API
      // we need to refactor this to avoid double calls
      const renderFunction = useThrottle(async (message: AIChatMessageParsed) => {
        if (!createdLoading) {
          createdLoading = true

          aiGeneration?.updateStatus('generating')
          chatInputComp?.showStatus({
            type: 'status',
            value: 'Answering...'
          })

          // Update progress
          updateAIGenerationProgress(50, 'Generating response...')

          await tick()

          if (options.autoScroll) {
            disableAutoscroll = false
          }
        }

        await tick()

        //log.debug('chat message', message)
        const outputContent = await parseChatOutputToHtml(message)

        if (aiGeneration && outputContent) {
          aiGeneration.updateOutput(outputContent)
        }

        if (disableAutoscroll && aiGeneration) {
          aiGeneration.autoScroll = false
        }
      }, 15)

      let markdownQuery = await htmlToMarkdown(query)
      if (!markdownQuery) {
        markdownQuery = query
      }

      const response = await chat.createChatCompletion(
        markdownQuery,
        {
          trigger,
          generationID: options.generationID,
          onboarding: showOnboarding,
          noteResourceId: resourceId,
          websearch: toolsConfiguration.websearch,
          surflet: toolsConfiguration.surflet
        },
        renderFunction
      )

      log.debug('autocomplete response', response)
      if (response.error) {
        log.error('Error generating AI output', response.error)
        let errorMsg = response.error.message || 'An unknown error occurred'
        aiGeneration.updateStatus('failed')
        chatInputComp?.showStatus({
          type: 'error',
          value: errorMsg
        })
      } else if (!response.output) {
        log.error('No output found')

        aiGeneration.updateStatus('failed')
        chatInputComp?.showStatus({
          type: 'error',
          value: 'Sorry, no response was generated for an unknown reason.'
        })
      } else {
        const content = await parseChatOutputToHtml(response.output)

        log.debug('inserted output', content)

        await wait(200)
        aiGeneration.updateStatus('completed')
        chatInputComp?.dismissStatus()

        // Generate title if needed (empty/default title and any AI generation)
        const shouldGenerateTitle =
          (!title || title.trim() === '' || title.startsWith('Untitled')) &&
          showTitle &&
          !readOnlyMode

        if (shouldGenerateTitle) {
          try {
            log.debug('Generating title for AI generation')
            const textQuery = getEditorContentText(query)
            await generateTitle(textQuery)
          } catch (err) {
            log.error('Error generating title after AI generation:', err)
            // Don't fail the whole operation if title generation fails
          }
        }

        // insert new line
        // editor.commands.insertContentAt(range.to, '<br>', {
        //   updateSelection: false
        // })
      }
    } catch (err) {
      log.error('Error generating AI output', err)
      aiGeneration?.updateStatus('failed')
      chatInputComp?.showStatus({
        type: 'error',
        value: String(err)
      })

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
    // oasis.changeSelectedSpace(id)
    // tabsManager.showNewTabOverlay.set(2)
  }

  const getMentionType = (id: string, type?: MentionEventType) => {
    if (id === 'everything') {
      return MentionEventType.Everything
    } else if (id === 'active-context') {
      return MentionEventType.ActiveContext
    } else {
      return type ?? MentionEventType.Context
    }
  }

  const handleMentionClick = async (
    e: CustomEvent<{ item: MentionItem; action: MentionAction }>
  ) => {
    try {
      log.debug('mention click', e.detail)
      const { item, action } = e.detail
      const { id, type } = item

      if (type === MentionItemType.BUILT_IN || type === MentionItemType.MODEL) {
        log.debug('Built-in or model mention clicked, cannot be opened')
        return
      }

      const target =
        action === 'new-tab'
          ? 'tab'
          : action === 'new-background-tab'
            ? 'background_tab'
            : action === 'open'
              ? 'auto'
              : 'sidebar'

      if (type === MentionItemType.RESOURCE) {
        messagePort.openResource.send({
          resourceId: id,
          target
        })
        return
      } else if (type === MentionItemType.NOTEBOOK) {
        messagePort.navigateURL.send({
          url: `surf://surf/notebook/${id}`,
          target
        })
        return
      } else {
        log.debug('Cannot open mention', item, action)
        return
      }
    } catch (e) {
      log.error('Error handling mention click', e)
    }
  }

  const handleMentionInsert = (e: CustomEvent<MentionItem>) => {
    const { id, type } = e.detail
    log.debug('mention insert', id, type)
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

      chat = await createNewNoteChat(mentions)

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
      showBubbleMenu.set(false)
    }
  }

  const handleOpenBubbleMenu = () => {
    // if (showOnboarding && $onboardingNote.id === 'similarity') {
    //   showInfoPopover('#editor-bubble-similarity-btn', `Click to search`, 'right')
    // }
  }

  const handleLinkClick: LinkClickHandler = async (e, href) => {
    const backgroundTab =
      (isModKeyPressed(e) && !e.shiftKey) || (e.type === 'auxclick' && e.button === 1)
    const target = backgroundTab
      ? 'background_tab'
      : isModKeyPressed(e)
        ? 'tab'
        : e.shiftKey
          ? 'sidebar'
          : 'auto'

    log.debug('Link clicked', href, target)

    const resourceId = parseSurfProtocolURL(href)
    if (resourceId) {
      log.debug('Opening resource', resourceId)

      messagePort.openResource.send({
        resourceId: resourceId,
        target
      })

      return
    }

    messagePort.navigateURL.send({
      url: href,
      target
    })
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

        if (e.key === 'ArrowDown') {
          focusInput()
          e.preventDefault()
          // Focus inline bar if floaty or bottom
          //if (['floaty', 'bottom'].includes($floatyBarState)) {
          //  focusInlineBar()
          //  e.preventDefault()
          //} else {
          //  // TODO: Switch to floaty if floaty in view, othweise bottom
          //  //floatyBarState.set('bottom')
          //  tick().then(() => {
          //    focusInlineBar()
          //  })
          //  e.preventDefault()
          //}
        }
      }
    }
  }

  const checkIfAlreadyRunning = (kind: string = 'ai generation') => {
    if ($isGeneratingAI) {
      log.debug(`Ignoring ${kind} request - AI generation already in progress`)
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

  const handleRunPrompt = (e: CustomEvent<{ prompt: ChatPrompt; custom: boolean }>) => {
    const { prompt, custom } = e.detail
    log.debug('Handling run prompt', prompt)
    runProoompt(prompt, custom)
  }

  const handleCloseBubbleMenu = () => {
    // const editor = editorElem.getEditor()
    // const currentSelection = editor.view.state.selection
    // if (currentSelection.from === currentSelection.to) {
    //   closeSimilarities()
    // }
    // if (showOnboarding && $onboardingNote.id === 'similarity') {
    //   hideInfoPopover()
    // }
  }

  const handleSelectContext = (e: CustomEvent<string>) => {
    try {
      log.debug('Selected context', e.detail)
      selectedContext.set(e.detail)
    } catch (e) {
      log.error('Error selecting context', e)
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

  const handleWebSearchCompleted = async (e: CustomEvent) => {
    log.debug('Handling web search completed', e.detail)
    if (!contextManager) {
      log.error('No context manager found for web search completion handle')
      return
    }

    // TODO: we should wait on this to finish instead of outright ignoring it?
    if ($isGeneratingAI) {
      log.debug('Ignoring web search completion - AI generation already in progress')
      return
    }

    try {
      const { results, query } = e.detail
      const mentions = editorElem.getMentions()

      const webSearchQuery =
        'Please complete my original query now that I have the web search results. The results are part of the context documents. My original query:' +
        query

      // TODO: indicate to the AI that the results are from web search
      await contextManager.addWebSearchContext(results)

      await generateAndInsertAIOutput(
        webSearchQuery,
        mentions,
        PageChatMessageSentEventTrigger.NoteWebSearch,
        undefined,
        'Processing the results to answer your question...'
      )
    } catch (e) {
      log.error('Error handling web search completed', e)
    } finally {
      // TODO: decide whether we should remove or keep the web search context after processing
      // TODO: also use an enum for the context id
      contextManager?.removeContextItem('web_search')
    }
  }

  const debouncedHandleWebSearchCompleted = useDebounce(handleWebSearchCompleted, 200)

  const handleNoteButtonClick = async (e: CustomEvent<string>) => {
    try {
      const action = e.detail

      log.debug('Note button click', action)

      if (action === 'onboarding-create-note') {
        createNewNote()
      } else if (action === 'onboarding-open-stuff') {
        openSpaceInStuff('all')
        document.dispatchEvent(new CustomEvent('onboarding-open-stuff', { bubbles: true }))
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
    }
  }

  const handleSlashCommand = async (e: CustomEvent<SlashCommandPayload>) => {
    const { item, range } = e.detail
    log.debug('Slash command', item)

    if (item.id === 'autocomplete') {
      if (checkIfAlreadyRunning('slash autocomplete')) return

      editorElem.triggerAutocomplete()
    } else if (item.id === 'suggestions') {
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

    let displayAutocomplete = false
    {
      const { state } = editorElem.getEditor()
      const { selection } = state
      const { $from } = selection

      const node = $from.node()
      if (node && node.isTextblock) {
        displayAutocomplete = node.textContent.replaceAll('/', '').length > 0
      }
    }

    if (!query) {
      return BUILT_IN_SLASH_COMMANDS.filter((e) => {
        if (e.id !== 'autocomplete') return true
        else return displayAutocomplete
      })
    }

    const filteredActions = BUILT_IN_SLASH_COMMANDS.filter((e) => {
      if (e.id !== 'autocomplete') return true
      else return displayAutocomplete
    }).filter(
      (item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.keywords.some((keyword) => keyword.includes(query.toLowerCase()))
    )

    let stuffResults: SlashMenuItem[] = []

    if (query.length > 0) {
      const result = await resourceManager.searchResources(
        query,
        [...SearchResourceTags.NonHiddenDefaultTags({ excludeAnnotations: false })],
        {
          semanticEnabled: $userSettings.use_semantic_search
        }
      )

      stuffResults = result.resources
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

  const showBasicsTimeline = async () => {
    await wait(1000)
    // launchTimeline(OnboardingFeature.SmartNotesOnboarding)
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

  let unsubs: Array<() => void> = []

  $: if (!$floatingMenuShown) {
    $showPrompts = false
  }

  $: readOnlyMode = resource.type !== ResourceTypes.DOCUMENT_SPACE_NOTE

  const handleAutocomplete = async (e: CustomEvent<EditorAutocompleteEvent>) => {
    try {
      log.debug('autocomplete', e.detail)

      console.trace('xxx-autocomplete')

      // Prevent starting a new generation if one is already running
      if (checkIfAlreadyRunning('autocomplete')) return

      hideInfoPopover()

      setTimeout(() => focusInput(), 150)

      contextManager?.clear()

      const { query, mentions } = e.detail
      await generateAndInsertAIOutput(
        query,
        mentions,
        PageChatMessageSentEventTrigger.NoteAutocompletion,
        { focusEnd: true, autoScroll: false, showPrompt: false }
      )
    } catch (e) {
      log.error('Error doing magic', e)
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
          contexts: contextNames // [$activeSpace?.dataValue.folderName ?? '', ...contextNames]
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
        generatingPrompts.set(false)
        return
      }

      log.debug('prompts', generatedPrompts)
      prompts.set(generatedPrompts)
    } catch (e) {
      log.error('Error generating prompts', e)
    } finally {
      generatingPrompts.set(false)
    }
  }, 500)

  const runProoompt = async (prompt: ChatPrompt, _custom: boolean = false) => {
    try {
      log.debug('Handling prompt submit', prompt)
      runPrompt(prompt, { focusEnd: true, autoScroll: true, showPrompt: false })
    } catch (e) {
      log.error('Error doing magic', e)
    }
  }

  export const runPrompt = async (prompt: ChatPrompt, opts?: Partial<ChatSubmitOptions>) => {
    try {
      const mentions = editorElem.getMentions()
      log.debug('Handling prompt submit', prompt, mentions)

      // Prevent starting a new generation if one is already running
      if (checkIfAlreadyRunning('run prompt')) return

      hideInfoPopover()

      await generateAndInsertAIOutput(
        prompt.prompt,
        mentions,
        PageChatMessageSentEventTrigger.NoteUseSuggestion,
        { ...opts, focusInput: true }
      )
    } catch (e) {
      log.error('Error doing magic', e)
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

  export const setChatInputContent = (content: string, focus = false) => {
    if (!chatInputComp) {
      log.error('Chat input component not initialized')
      return
    }

    chatInputComp.setContent(content, focus)
  }

  export const replaceContent = (text: string) => {
    const editor = editorElem.getEditor()

    editorElem.setContent(text)
    editor.commands.focus('end')
  }

  export const focusChatInput = () => {
    if (!chatInputEditorElem) {
      log.error('Could not get chat input editor instance')
      return
    }

    const chatInputEditor = chatInputEditorElem.getEditor()
    chatInputEditor.commands.focus()
  }

  export const handleCreateSurflet = (code?: string) => {
    try {
      const editor = editorElem.getEditor()

      // Get the current position
      const currentPosition = editor.view.state.selection.from

      // Use the provided code or fall back to predefined code
      const surfletCode = code || predefinedSurfletCode

      // Remove markdown code block markers if present
      const cleanCode = surfletCode.replace(/```javascript|```/g, '')

      // Create a surflet node with the code
      const surfletNode = editor.view.state.schema.nodes.surflet.create(
        { codeContent: cleanCode },
        null
      )

      // Insert the surflet node at the current position
      const tr = editor.view.state.tr
      tr.insert(currentPosition, surfletNode)
      editor.view.dispatch(tr)

      // Focus the editor after insertion
      editor.commands.focus()

      log.debug('Surflet inserted successfully')
    } catch (err) {
      log.error('Error inserting surflet', err)
    }
  }

  /**
   * Update the content of the most recently created surflet
   * @param code The new code to set for the surflet
   */
  const updateSurfletContent = (code?: string) => {
    if (!code) {
      log.debug('No code provided to update surflet')
      return
    }

    // Check if editorElem exists and is initialized
    if (!editorElem) {
      log.debug('Editor element not available for surflet update')
      return
    }

    try {
      // Get the editor and check if it's available
      const editor = editorElem.getEditor()
      if (!editor || !editor.state || !editor.view) {
        log.debug('Editor not fully initialized for surflet update')
        return
      }

      // Find the surflet node in the document
      const surfletNodes: { pos: number; node: any }[] = []
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'surflet') {
          surfletNodes.push({ pos, node })
        }
        return true
      })

      // If no surflet nodes found, log debug and return
      if (surfletNodes.length === 0) {
        log.debug('No surflet node found to update')
        return
      }

      // Get the last surflet node (most recently created)
      const lastSurflet = surfletNodes[surfletNodes.length - 1]

      // Create a transaction to update the node's attributes
      const tr = editor.state.tr
      tr.setNodeMarkup(lastSurflet.pos, undefined, {
        ...lastSurflet.node.attrs,
        codeContent: code
      })

      // Dispatch the transaction to update the editor
      editor.view.dispatch(tr)

      log.debug('Surflet content updated successfully')
    } catch (err) {
      // Use debug level instead of error to avoid spamming console
      log.debug('Could not update surflet content', err)
    }
  }

  let chatInputGenerationID: string | null = null

  const handleChatSubmit = async (e: CustomEvent<{ query: string; mentions: MentionItem[] }>) => {
    try {
      let query = ''
      let mentions: MentionItem[]
      let needsFocusChatBar = false
      let showPromptAndScroll = false

      if (e.detail === null) {
        const { html: text, mentions: editorMentions } = editorElem.getParsedEditorContent()
        query = text
        mentions = editorMentions
        needsFocusChatBar = true
      } else {
        query = e.detail.query
        mentions = e.detail.mentions
        showPromptAndScroll = true
      }

      chatInputGenerationID = generateID()

      log.debug('Handling submit', chatInputGenerationID, query, mentions)

      // document.dispatchEvent(
      //   new CustomEvent(CompletionEventID.AIGenerationStarted, { bubbles: true })
      // )

      if (!chat) {
        chat = await createNewNoteChat(mentions)
      }

      if (needsFocusChatBar) setTimeout(() => focusInput(), 150)

      if (contextManager) {
        await contextManager.clear()
      }

      await generateAndInsertAIOutput(
        query,
        mentions,
        PageChatMessageSentEventTrigger.NoteChatInput,
        {
          focusEnd: true,
          autoScroll: showPromptAndScroll,
          showPrompt: showPromptAndScroll,
          generationID: chatInputGenerationID
        }
      )
    } catch (e) {
      log.error('Error doing magic', e)
    } finally {
      chatInputGenerationID = null
    }
  }

  const handleChatInputBlur = () => {
    editorElem.focus()
  }

  const handleStopGeneration = () => {
    log.debug('Stopping generation')
    if (chat) {
      chat.stopGeneration(chatInputGenerationID ?? undefined)
    }
    chatInputComp?.dismissStatus()
  }

  const handleScroll = () => {
    disableAutoscroll = true
  }

  // Function to handle inserting an onboarding mention into the editor
  const handleInsertOnboardingMention = async (
    event: CustomEvent<MentionItem & { query?: string }>
  ) => {
    await wait(100)
    try {
      const mentionItem = event.detail
      if (!mentionItem || !mentionItem.id || !mentionItem.label) {
        log.error('Invalid mention data provided')
        return
      }

      if (!editorElem) {
        log.error('Editor element not initialized')
        return
      }

      const noteEditor = editorElem.getEditor()
      if (!noteEditor) {
        log.error('Editor instance is not available')
        return
      }

      if (!chatInputEditorElem) {
        log.error('Could not get chat input editor instance')
        return
      }

      const chatInputEditor = chatInputEditorElem.getEditor()
      if (!chatInputEditor) {
        log.error('Chat input editor instance is not available')
        return
      }

      noteEditor
        .chain()
        .focus('end')
        .insertContent([
          {
            type: 'paragraph'
          },
          {
            type: 'paragraph'
          }
        ])
        .run()

      // Insert two line breaks followed by the mention
      chatInputEditor
        .chain()
        .focus('end')
        .insertContent([
          {
            type: 'mention',
            attrs: {
              id: mentionItem.id,
              label: mentionItem.label,
              mentionType: mentionItem.type,
              icon: mentionItem.icon
            }
          },
          {
            type: 'text',
            text: ' '
          }
        ])
        .run()

      // If there's a query, insert it after the mention
      if (mentionItem.query) {
        chatInputEditor.chain().insertContent(mentionItem.query).run()
      }

      chatInputEditor.commands.focus('end')

      // Dispatch the mention-insert event to handle any side effects
      dispatch('mention-insert', mentionItem)

      log.debug('Inserted onboarding mention into editor', mentionItem)
    } catch (error) {
      log.error('Error inserting onboarding mention', error)
    }
  }

  // Function to handle inserting the UseAsDefaultBrowser extension into the editor
  const handleInsertUseAsDefaultBrowser = async () => {
    await wait(100)
    try {
      const editor = editorElem.getEditor()

      // Get the end position - insert at the end of the document
      const position = editor.view.state.doc.content.size

      // Create a transaction to insert the UseAsDefaultBrowser node
      const tr = editor.view.state.tr

      // Insert a blank line first
      editor.commands.insertContentAt(position, [
        { type: 'paragraph', content: [{ type: 'text', text: ' ' }] }, // Add a blank line
        { type: 'useAsDefaultBrowser' } // Then add the UseAsDefaultBrowser node
      ])

      await tick()
      // Focus the editor after insertion
      editor.commands.focus()

      const element = document.querySelector('.default-browser-container')
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }

      log.debug('UseAsDefaultBrowser extension inserted successfully at the end of the document')
    } catch (err) {
      log.error('Error inserting UseAsDefaultBrowser extension', err)
    }
  }

  // Function to handle inserting a Button extension into the editor
  const handleInsertButtonToNote = async (event: CustomEvent<{ text: string; action: string }>) => {
    await wait(100)
    try {
      const editor = editorElem.getEditor()
      const { action } = event.detail

      // Get the end position - insert at the end of the document
      const position = editor.view.state.doc.content.size

      // Check if this is the onboarding-open-stuff action
      if (action === 'onboarding-open-stuff') {
        // Insert a blank line followed by the OpenStuff node
        editor.commands.insertContentAt(position, [
          { type: 'paragraph', content: [{ type: 'text', text: ' ' }] }, // Add a blank line
          { type: 'openStuff' }, // Then add the OpenStuff node
          { type: 'paragraph', content: [{ type: 'text', text: ' ' }] } // Add another blank line after
        ])

        log.debug('OpenStuff extension inserted successfully at the end of the document')
      } else {
        // Original button behavior for other actions
        const { text } = event.detail

        // Insert a blank line followed by the Button node
        editor.commands.insertContentAt(position, [
          { type: 'paragraph', content: [{ type: 'text', text: ' ' }] }, // Add a blank line
          {
            type: 'button',
            attrs: {
              text: { text: text }, // Properly structure the text attribute as an object with a text property
              action: action
            }
          },
          { type: 'paragraph', content: [{ type: 'text', text: ' ' }] } // Add another blank line after the button
        ])

        log.debug('Button extension inserted successfully at the end of the document', text, action)
      }

      await tick()

      // Focus the editor after insertion
      // editor.commands.focus()
    } catch (err) {
      log.error('Error inserting extension', err)
    }
  }

  // Function to handle inserting the onboarding footer with links into the editor
  const handleInsertOnboardingFooter = async (
    event: CustomEvent<{ links: Array<{ url: string; title: string }> }>
  ) => {
    await wait(100)
    try {
      const editor = editorElem.getEditor()
      const links = event.detail.links || []

      if (!links.length) {
        log.warn('No links provided for onboarding footer')
        return
      }

      // Get the end position - insert at the end of the document
      const position = editor.view.state.doc.content.size

      // Create content for the footer
      let content = [
        { type: 'paragraph', content: [{ type: 'text', text: ' ' }] }, // Use a space instead of empty string
        { type: 'paragraph', content: [{ type: 'text', text: 'Useful resources:' }] },
        {
          type: 'bulletList',
          content: links.map((link) => ({
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    marks: [
                      {
                        type: 'link',
                        attrs: {
                          href: link.url,
                          target: '_blank'
                        }
                      }
                    ],
                    text: link.title || link.url
                  }
                ]
              }
            ]
          }))
        }
      ]

      // Insert the footer content
      editor.commands.insertContentAt(position, content)

      await tick()

      // Focus the editor after insertion
      //editor.commands.focus()

      log.debug('Onboarding footer with links inserted successfully')
    } catch (err) {
      log.error('Error inserting onboarding footer', err)
    }
  }

  const insertMention = (mentionItem?: MentionItem, query?: string, editor?: Editor) => {
    try {
      let focusedEditor = editor || editorElem
      if (!focusedEditor) {
        log.error('no focused editor found to insert mention into')
        return
      }
      focusedEditor.insertMention(mentionItem, query)
    } catch (error) {
      log.error('Error inserting mention', error)
    }
  }

  const onFileSelect = async () => {
    log.debug('File select triggered')
    const mentions = await promptForFilesAndTurnIntoResourceMentions(resourceManager)
    if (!mentions || mentions.length === 0) {
      log.debug('No files selected or no mentions created')
      return
    }

    for (const mentionItem of mentions) {
      insertMention(mentionItem, undefined, chatInputEditorElem)
    }
  }

  const onMentionSelect = async () => {
    log.debug('Mention select triggered')
    insertMention(undefined, '@', chatInputEditorElem)
  }

  $: if (editorElem && isDev) {
    // @ts-ignore
    window.editor = editorElem
  }

  const handleContentUpdated = useDebounce(() => {
    if (
      get(isGeneratingAI) ||
      !(editorElement === document.activeElement || editorElement.contains(document.activeElement))
    )
      return

    const mentions = editorElem.getMentions()
    if (mentions.length > 0) {
      contextManager.getPrompts({ mentions })
    } else {
      contextManager.resetPrompts()
    }
  }, 500)

  const handleChatInputContentUpdated = useDebounce(() => {
    if (get(isGeneratingAI)) return
    const mentions = chatInputEditorElem.getMentions()
    if (mentions.length > 0) {
      contextManager.getPrompts({ mentions })
    } else {
      contextManager.resetPrompts()
    }
  }, 500)

  onDestroy(() => {
    if (resource) {
      resource.releaseData()
    }

    unsubs.forEach((unsub) => unsub())

    if (editorElement) {
      editorElement.removeEventListener('scroll', handleScroll)
    }

    // Remove the UseAsDefaultBrowser event listener
    document.removeEventListener(
      'insert-use-as-default-browser',
      handleInsertUseAsDefaultBrowser as EventListener
    )

    // Remove the onboarding footer event listener
    document.removeEventListener(
      'insert-onboarding-footer',
      handleInsertOnboardingFooter as EventListener
    )

    // Remove the button insertion event listener
    document.removeEventListener('insert-button-to-note', handleInsertButtonToNote as EventListener)
  })
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="text-resource-wrapper text-gray-900 dark:text-gray-100"
  bind:clientWidth
  on:paste={handlePaste}
  on:editor-file-paste={handleEditorFilePaste}
>
  <div class="content">
    {#if !initialLoad && origin !== 'homescreen' && !readOnlyMode}
      <ChatInput
        {contextManager}
        bind:this={chatInputComp}
        bind:editor={chatInputEditorElem}
        bind:focus={focusInput}
        hideEmptyPrompts={viewLocation !== ViewLocation.Sidebar}
        {mentionItemsFetcher}
        {onFileSelect}
        {onMentionSelect}
        {tools}
        on:run-prompt={handleRunPrompt}
        on:submit={handleChatSubmit}
        on:cancel-completion={handleStopGeneration}
        on:blur={handleChatInputBlur}
        on:autocomplete={handleCaretPopoverAutocomplete}
        on:update={handleChatInputContentUpdated}
      />
    {/if}

    {#if !initialLoad}
      <div
        class="notes-editor-wrapper"
        class:autocompleting={$autocompleting}
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
            bind:editorElement
            placeholderNewLine={$editorPlaceholder}
            citationComponent={CitationItem}
            surfletComponent={Surflet}
            webSearchComponent={WebSearch}
            resourceComponent={EmbeddedResource}
            floatingMenu
            readOnlyMentions={false}
            bubbleMenu={$showBubbleMenu && !minimal}
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
            enableCaretIndicator={origin !== 'homescreen' || !readOnlyMode}
            onLinkClick={handleLinkClick}
            readOnly={readOnlyMode}
            enableTitleNode={showTitle && !readOnlyMode}
            titlePlaceholder="Untitled"
            initialTitle={title}
            onTitleChange={handleTitleChange}
            {slashItemsFetcher}
            {mentionItemsFetcher}
            {linkItemsFetcher}
            on:click
            on:dragstart
            on:update={handleContentUpdated}
            on:caret-position-update={handleEditorSelectionUpdate}
            on:citation-click={handleCitationClick}
            on:autocomplete={handleAutocomplete}
            on:suggestions={() => generatePrompts()}
            on:mention-click={handleMentionClick}
            on:mention-insert={handleMentionInsert}
            on:rewrite={handleRewrite}
            on:close-bubble-menu={handleCloseBubbleMenu}
            on:open-bubble-menu={handleOpenBubbleMenu}
            on:button-click={handleNoteButtonClick}
            on:slash-command={handleSlashCommand}
            on:floaty-input-state-update={handleFloatyInputStateUpdate}
            on:last-line-visbility-changed={handleLastLineVisibilityChanged}
            on:web-search-completed={debouncedHandleWebSearchCompleted}
            {autofocus}
          ></Editor>
        </div>
      </div>
    {/if}
  </div>

  <!-- {#if showOnboarding}
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
  {/if} -->

  <!-- {#if !minimal}
    {#if !showOnboarding && !manualContextControl}
      <div class="note-settings">
        <ModelPicker />

        {#if resource}
          <NoteSettingsMenu {resource} showOnboarding={!showOnboarding && !manualContextControl} />
        {/if}
      </div>
    {/if}
  {/if} -->
</div>

<style lang="scss">
  .text-resource-wrapper {
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
    padding-bottom: 0;
    background: light-dark(oklch(99.1% 0 0), oklch(20% 0 0));
    display: flex;
    justify-content: center;
    align-items: center;

    :global(.dark) & {
      background: #181818;
    }

    --text-color: light-dark(oklch(38.7% 0 0), oklch(92.9% 0 0));
  }

  .content {
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
    //padding-top: 3em;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  :global([data-origin='homescreen']) {
    .content {
      padding-top: 0em;
    }
    :global(
        .notes-editor-wrapper > .editor-container > .editor > .editor-wrapper > div > div.tiptap
      ) {
      padding: 0 !important;
    }
  }

  .onboarding-wrapper {
    position: absolute;
    z-index: 100;
    left: 50%;
    bottom: 1.5em;
    transform: translateX(-50%);
  }

  .note-settings {
    position: fixed;
    top: 1em;
    right: 1em;
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 0.25rem;
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
    padding-bottom: 4rem;
  }

  :global(
      .notes-editor-wrapper > .editor-container > .editor > .editor-wrapper > div > div.tiptap
    ) {
    max-width: 730px;
    margin: auto;
    padding: 2em 2em;
    box-sizing: content-box;
  }

  :global(#app > .wrapper > .text-resource-wrapper > .content > .notes-editor-wrapper .tiptap) {
    padding-bottom: 180px;
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

    :global(.title-node) {
      max-width: 730px;
      width: 100%;
      margin: auto;
      margin-top: 4rem;
      margin-bottom: 0rem;
      font-size: 2.1rem;
      font-weight: 600;
      box-sizing: content-box;
      color: var(--on-surface-heavy);
      background: light-dark(var(--app-background-light), rgba(24, 24, 24, 1));
      border: none;
      outline: none;

      &::before {
        content: attr(data-placeholder);
        color: #9ca3af;
        pointer-events: none;
        position: absolute;
        opacity: 1;
      }

      &:not(:empty)::before {
        opacity: 0;
      }
    }

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

    :global(code:not(pre code)) {
      background: #030712;
      padding: 0.2em 0.4em;
      font-size: 0.9em;
    }

    :global(.dark) & {
      :global(*):not(.mention, a, span) {
        color: inherit !important;
      }
    }

    // added from task list extension
    :global(.extension-task-list label) {
      padding-top: 0.3rem !important;
    }
  }
</style>
