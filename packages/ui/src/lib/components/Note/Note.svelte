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
  import { writable, derived } from 'svelte/store'
  import { createEventDispatcher, onDestroy, onMount, tick } from 'svelte'
  import tippy, { type Instance, type Placement, type Props } from 'tippy.js'
  import type { Editor as TiptapEditor } from '@tiptap/core'

  import {
    Editor,
    getEditorContentText,
    MentionItemType,
    type EditorAutocompleteEvent,
    type MentionItem
  } from '@deta/editor'
  import '@deta/editor/src/editor.scss'

  import { Resource, ResourceNote, useResourceManager } from '@deta/services/resources'
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
    htmlToMarkdown
  } from '@deta/utils'
  import { generateContentHash, parseChatOutputToHtml } from '@deta/services/ai'
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
  } from '@deta/types'
  import {
    type AIChatMessageParsed,
    type AIChatMessageSource,
    type HighlightWebviewTextEvent,
    type JumpToWebviewTimestampEvent
  } from '@deta/types'
  import { provideAI } from '@deta/services/ai'
  import { SMART_NOTES_SUGGESTIONS_GENERATOR_PROMPT } from '@deta/services/constants'
  import type { ChatPrompt, MentionAction } from '@deta/types'
  import { Toast, useToasts } from '@deta/ui'
  import { useConfig } from '@deta/services'
  import { createWikipediaAPI } from '@deta/web-parser'
  import { isGeneratedResource } from '@deta/services/resources'
  import {
    updateCaretPopoverVisibility,
    type CaretPosition
  } from '@deta/editor/extensions/CaretIndicator'
  import { NOTE_MENTION, EVERYTHING_MENTION, INBOX_MENTION } from '@deta/services/constants'
  import {
    BUILT_IN_SLASH_COMMANDS,
    type SlashCommandPayload,
    type SlashMenuItem,
    type SlashItemsFetcher
  } from '@deta/editor/extensions/Slash'
  import CaretPopover from './CaretPopover.svelte'
  // import { openContextMenu } from '@deta/ui'
  import { createResourcesFromMediaItems, processPaste } from '@deta/services'
  import { createMentionsFetcher, createResourcesMentionsFetcher } from '@deta/services/ai'
  import type { LinkClickHandler } from '@deta/editor/extensions/Link'
  import { EditorAIGeneration, NoteEditor } from '@deta/services/ai'
  import { useTabs } from '@deta/services/tabs'
  import { SearchResourceTags, ResourceTag } from '@deta/utils/formatting'

  export let resource: ResourceNote
  export let autofocus: boolean = true
  export let showOnboarding: boolean = false
  export let minimal: boolean = false
  export let similaritySearch: boolean = false
  export let origin: string = ''

  const log = useLogScope('TextCard')
  const resourceManager = useResourceManager()
  const toasts = useToasts()
  const config = useConfig()
  const tabs = useTabs()
  const ai = provideAI(resourceManager, tabs, config, false)
  const wikipediaAPI = createWikipediaAPI()

  const dispatch = createEventDispatcher<{
    'update-title': string
    seekToTimestamp: JumpToWebviewTimestampEvent
    highlightWebviewText: HighlightWebviewTextEvent
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
  // We use these to determine whether to display the big prompt bubbles
  // need to wire thi back when fixing the prompts with the new input bar
  const isEmpty = writable(false)

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
  const isFirstLine = writable<boolean>(true)
  const handleLastLineVisibilityChanged = (e: CustomEvent<boolean>) => {
    lastLineVisible.set(e.detail)
  }
  const handleIsFirstLineChanged = (e: CustomEvent<boolean>) => {
    isFirstLine.set(e.detail)
  }

  // Set up synchronization between local and global state
  onMount(() => {
    // @ts-ignore
    window.wikipediaAPI = wikipediaAPI

    // Add event listener for onboarding mention
    document.addEventListener(
      'insert-onboarding-mention',
      handleInsertOnboardingMention as unknown as EventListener
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
        handleInsertOnboardingFooter as unknown as EventListener
      )

      // Add event listener for button insertion
      document.addEventListener(
        'insert-button-to-note',
        handleInsertButtonToNote as unknown as EventListener
      )

      const value = resource.parsedData
      unsubscribeValue = value.subscribe((value) => {
        if (value) {
          content.set(value)

          if (!editorFocused) {
            editorElem?.setContent(value)
          }
        }
      })

      await resource.getContent()

      initialLoad = false

      unsubscribeContent = content.subscribe((value) => {
        debouncedSaveContent(value ?? '')

        if (editorElem) {
          isEmpty.set(editorElem.isEmptyy())
        }
      })

      title = resource.metadata?.name ?? 'Untitled'
      //   unsubscribeTitle = resource.title.subscribe((value) => {
      //     if (value) {
      //       title = value
      //     }
      //   })

      log.debug('text resource', resource, title, $content)

      contentHash.set(generateContentHash($content))

      await wait(500)

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

      document.addEventListener('create-surflet', handleCreateSurfletEvent as EventListener)
      document.addEventListener('onboarding-open-stuff', handleOpenStuffEvent as EventListener)
      document.addEventListener('update-surflet', handleUpdateSurfletEvent as EventListener)

      return () => {
        document.removeEventListener('create-surflet', handleCreateSurfletEvent as EventListener)
        document.removeEventListener('onboarding-open-stuff', handleOpenStuffEvent as EventListener)
        document.removeEventListener('update-surflet', handleUpdateSurfletEvent as EventListener)
      }
    }

    // Start the async setup without waiting for it
    setupAsync()

    // Return the cleanup function directly (not in a Promise)
    return () => {
      document.removeEventListener(
        'insert-onboarding-mention',
        handleInsertOnboardingMention as unknown as EventListener
      )

      // Remove the UseAsDefaultBrowser event listener
      document.removeEventListener(
        'insert-use-as-default-browser',
        handleInsertUseAsDefaultBrowser as EventListener
      )

      // Remove the onboarding footer event listener
      document.removeEventListener(
        'insert-onboarding-footer',
        handleInsertOnboardingFooter as unknown as EventListener
      )

      // Remove the button insertion event listener
      document.removeEventListener(
        'insert-button-to-note',
        handleInsertButtonToNote as unknown as EventListener
      )
    }
  })

  const collapsedSources = useLocalStorageStore<boolean>('smart-note-collapse-sources', false, true)

  const DRAG_ZONE_PREFIX = 'text-resource/'
  const dragZoneId = DRAG_ZONE_PREFIX + resource.id + Date.now()

  let clientWidth = 0
  let disableSimilaritySearch = false
  let tippyPopover: Instance<Props> | null = null
  let editorFocused = false
  let disableAutoscroll = false
  let focusInlineBar: () => void

  // Caret indicator state
  let caretPosition: CaretPosition | null = null
  let showCaretPopover = false
  let escapeFirstLineChat = false

  let focusInput: () => void

  const emptyPlaceholder = 'Start typing or hit space for suggestions…'

  const editorPlaceholder = derived(
    [floatingMenuShown, showPrompts, generatingPrompts, autocompleting],
    ([$floatingMenuShown, $showPrompts, $generatingPrompts, $autocompleting]) => {
      if ($autocompleting) {
        return ''
      }

      let contextName = 'context'
      //   if ($selectedContext) {
      //     if ($selectedContext === 'everything') {
      //       contextName = 'all your stuff'
      //     } else if ($selectedContext === 'tabs') {
      //       contextName = 'your tabs'
      //     } else if ($selectedContext === 'active-context') {
      //       contextName = 'the active context'
      //     } else if ($selectedContext === NO_CONTEXT_MENTION.id) {
      //       contextName = ''
      //     }
      //   } else if ($activeSpace) {
      //     contextName = `"${$activeSpace?.dataValue.folderName}"`
      //   }

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
          return `Write or type / for commands…`
        }
      }

      return `Write or type / for commands…`
    }
  )

  const mentionItemsFetcher = createMentionsFetcher({ ai, resourceManager }, resource.id)
  const linkItemsFetcher = createResourcesMentionsFetcher(resourceManager, resource.id)

  let initialLoad = true
  let focusEditor: () => void
  let title = ''

  let editorElem: Editor
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
    const blob = new Blob([value], { type: ResourceTypes.DOCUMENT_SPACE_NOTE })
    resource.updateData(blob)

    // if (editorElem && !resource?.metadata?.name && autoGenerateTitle) {
    //   const { text } = editorElem.getParsedEditorContent()
    //   note?.generateTitle(text)
    // }
  }, 500)

  // prevent default drag and drop behavior (i.e. the MediaImporter handling it)
  // const handleDrop = (e: DragEvent) => {
  //   e.preventDefault()
  //   e.stopPropagation()

  //   log.debug('dropped onto text card', e)

  //   // seems like tiptap handles text drag and drop already
  // }

  const insertResourceEmbed = async (resource: Resource, position: number) => {
    await resourceManager.preventHiddenResourceFromAutodeletion(resource)

    const editor = editorElem.getEditor()
    editor.commands.insertContentAt(
      position,
      `<resource id="${resource.id}" data-type="${resource.type}" data-expanded="true" />`
    )
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
        // if ($activeSpace) {
        //   oasis.addResourcesToSpace($activeSpace.id, [resource.id], SpaceEntryOrigin.ManuallyAdded)
        // }
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

  const createNewNote = async (title?: string) => {
    const resource = await resourceManager.createResourceNote(
      '',
      { name: title ?? `Note ${getFormattedDate(Date.now())}` },
      undefined,
      true
    )
    // await tabsManager.openResourceAsTab(resource, { active: true })
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
      })
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
    const chatContextManager = ai.contextManager
    if (mentions && mentions.length > 0) {
      log.debug('Adding spaces to context', mentions)
      const contextMentions = mentions.filter((mention) => mention.type !== MentionItemType.MODEL)
      if (contextMentions.length > 0) {
        contextMentions.forEach((mention) => {
          chatContextManager.addMentionItem(mention)
        })
      }
      // } else if ($selectedContext) {
      //   log.debug('Adding selected context to context', $selectedContext)
      //   chatContextManager.addSpace($selectedContext)
    } else {
      log.debug('Adding active space to context', resource.id)
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
    // if (modelMention) {
    //   if (modelMention.id === MODEL_CLAUDE_MENTION.id) {
    //     chat.selectProviderModel(Provider.Anthropic)
    //   } else if (modelMention.id === MODEL_GPT_MENTION.id) {
    //     chat.selectProviderModel(Provider.OpenAI)
    //   } else {
    //     const modelId = modelMention.id.replace('model-', '')
    //     chat.selectModel(modelId)
    //   }
    // }
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

    // Hide the caret popover when generation starts
    hidePopover()

    // Update both local and global AI generation state
    isGeneratingAI.set(true)
    startAIGeneration('text-resource', `Generating response to: ${query.substring(0, 30)}...`)

    if (options.focusEnd) {
      editorElem.focusEnd()
    }

    if (options.autoScroll) {
      disableAutoscroll = false
    }

    let aiGeneration: EditorAIGeneration | null = null

    try {
      const chat = await createNewNoteChat(mentions)

      if (!query) {
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

      // Use the note resource in the chat if the note is mentioned or automaticall if nothing is mentioned
      const useNoteResource =
        mentions?.some((mention) => mention.id === NOTE_MENTION.id) ||
        !mentions ||
        mentions.filter((mention) => mention.type !== MentionItemType.MODEL).length === 0

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
          noteResourceId: useNoteResource ? resource.id : undefined
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
        } else if (response.error.type === PageChatMessageSentEventError.TooManyRequests) {
          toasts.error('Too many requests, please try again later')
        } else if (response.error.type === PageChatMessageSentEventError.BadRequest) {
          toasts.error(
            'Sorry your query did not pass our content policy, please try again with a different query.'
          )
        } else if (response.error.type === PageChatMessageSentEventError.RAGEmptyContext) {
          toasts.error(
            'No relevant context found. Please add more resources or try a different query.'
          )
        } else {
          toasts.error('Something went wrong generating the AI output. Please try again.')
        }

        aiGeneration.updateStatus('failed')
        cleanupCompletion()
      } else if (!response.output) {
        log.error('No output found')
        toasts.error('Something went wrong generating the AI output. Please try again.')

        aiGeneration.updateStatus('failed')
        cleanupCompletion()
      } else {
        const content = await parseChatOutputToHtml(response.output)

        log.debug('inserted output', content)

        await wait(200)
        aiGeneration.updateStatus('completed')

        // insert new line
        // editor.commands.insertContentAt(range.to, '<br>', {
        //   updateSelection: false
        // })
      }
    } catch (err) {
      log.error('Error generating AI output', err)
      toasts.error('Something went wrong generating the AI output. Please try again.')

      // const loading = getLastNode('loading')
      // if (loading) {
      //   const editor = editorElem.getEditor()
      //   editor.commands.deleteRange(loading.range)
      // }

      aiGeneration?.updateStatus('failed')

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

      if (action === 'overlay') {
        if (id === INBOX_MENTION.id) {
          openSpaceInStuff('inbox')
        } else if (id === EVERYTHING_MENTION.id) {
          openSpaceInStuff('all')
        } else if (type === MentionItemType.RESOURCE) {
          // oasis.openResourceDetailsSidebar(id, { select: true, selectedSpace: 'auto' })
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

        // if (type === MentionItemType.RESOURCE) {
        //   tabsManager.openResourcFromContextAsPageTab(id, {
        //     active: action !== 'new-background-tab'
        //   })
        //   return
        // }

        // if (action === 'open') {
        //   tabsManager.changeScope(
        //     id === INBOX_MENTION.id || id === EVERYTHING_MENTION.id ? null : id,
        //     ChangeContextEventTrigger.Note
        //   )

        //   return
        // }

        // const space = await oasis.getSpace(id)
        // if (!space) {
        //   log.error('Space not found', id)
        //   return
        // }

        // tabsManager.addSpaceTab(space, {
        //   active: action === 'new-tab'
        // })
      }
    } catch (e) {
      log.error('Error handling mention click', e)
      toasts.error('Failed to handle mention click')
    }
  }

  const handleMentionInsert = (e: CustomEvent<MentionItem>) => {
    const { id, type } = e.detail
    log.debug('mention insert', id, type)
  }

  const handleOpenBubbleMenu = () => {
    if (showOnboarding) {
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

  const handleLinkClick: LinkClickHandler = async (e, href) => {
    const target =
      e.shiftKey && !isModKeyPressed(e)
        ? 'preview'
        : e.altKey
          ? 'details'
          : isModKeyPressed(e)
            ? 'new-tab'
            : 'current-tab'
    const activeTab = target === 'current-tab'

    log.debug('Link clicked', href, target)

    const resourceId = parseSurfProtocolURL(href)
    if (resourceId) {
      log.debug('Trying to open resource', resourceId)
      const resource = await resourceManager.getResource(resourceId)
      if (!resource) {
        log.error('Resource not found', resourceId)
        toasts.error('Resource to open not found')
        return
      }

      //   if (target === 'preview') {
      //     globalMiniBrowser.openResource(resource.id, {
      //       from: OpenInMiniBrowserEventFrom.NoteLink
      //     })
      //   } else if (target === 'details') {
      //     oasis.openResourceDetailsSidebar(resource.id, { select: true, selectedSpace: 'auto' })
      //   } else {
      //     tabsManager.openResourcFromContextAsPageTab(resource.id, {
      //       active: activeTab,
      //       trigger: CreateTabEventTrigger.NoteLink
      //     })
      //   }

      return
    }

    // if (target === 'preview') {
    //   globalMiniBrowser.openWebpage(href, {
    //     from: OpenInMiniBrowserEventFrom.NoteLink
    //   })
    // } else {
    //   tabsManager.addPageTab(href, {
    //     active: activeTab,
    //     trigger: CreateTabEventTrigger.NoteLink
    //   })
    // }
  }

  const handleEditorKeyDown = (e: KeyboardEvent) => {
    // Only prevent propagation when the editor exists AND is focused
    if (editorElem) {
      if (e.key === 'Escape') escapeFirstLineChat = true
      if (e.key === 'Backspace' && $isEmpty) escapeFirstLineChat = false
      if (e.key === 'Enter' && $isEmpty) escapeFirstLineChat = true
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
          // focusInput()
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

  const handleRunPrompt = (e: CustomEvent<{ prompt: ChatPrompt; custom: boolean }>) => {
    const { prompt, custom } = e.detail
    log.debug('Handling run prompt', prompt)
    runProoompt(prompt, custom)
  }

  const handleCloseBubbleMenu = () => {
    const editor = editorElem.getEditor()
    const currentSelection = editor.view.state.selection
    // if (currentSelection.from === currentSelection.to) {
    //   closeSimilarities()
    // }

    // if (showOnboarding && $onboardingNote.id === 'similarity') {
    //   hideInfoPopover()
    // }
  }

  //   const handleSelectContext = (e: CustomEvent<string>) => {
  //     try {
  //       log.debug('Selected context', e.detail)
  //       selectedContext.set(e.detail)

  //       if ($similarityResults) {
  //         runSimilaritySearch($similarityResults.text, $similarityResults.range, false)
  //       }

  //     } catch (e) {
  //       log.error('Error selecting context', e)
  //       toasts.error('Failed to select context')
  //     }
  //   }

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
    // if (!contextManager) {
    //   log.error('No context manager found for web search completion handle')
    //   return
    // }

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
      // await contextManager.addWebSearchContext(results)

      await generateAndInsertAIOutput(
        webSearchQuery,
        mentions,
        PageChatMessageSentEventTrigger.NoteWebSearch,
        undefined,
        'Processing the results to answer your question...'
      )

      // TODO: decide whether we should remove or keep the web search context after processing
      // TODO: also use an enum for the context id
      // contextManager.removeContextItem('web_search')
    } catch (e) {
      log.error('Error handling web search completed', e)
      toasts.error('Failed to handle web search results')
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
      toasts.error('Failed to handle note button click')
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

    const { state } = editorElem.getEditor()
    const { selection } = state
    const { $from } = selection

    const node = $from.node()
    if (node && node.isTextblock) {
      displayAutocomplete = node.textContent.replaceAll('/', '').length > 0
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
        .filter((item) => item.resource.id !== resource.id)
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

      // setTimeout(() => focusInput(), 150)
      const { query, mentions } = e.detail
      await generateAndInsertAIOutput(
        query,
        mentions,
        PageChatMessageSentEventTrigger.NoteAutocompletion,
        { focusEnd: true, autoScroll: false, showPrompt: false }
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
          contexts: [...contextNames]
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

  const runProoompt = async (prompt: ChatPrompt, custom: boolean = false) => {
    try {
      log.debug('Handling prompt submit', prompt)

      let promptType = PromptType.BuiltIn
      if (custom) {
        promptType = PromptType.Custom
      } else {
        //const builtIn = BUILT_IN_PAGE_PROMPTS.find((p) => p.prompt === prompt.prompt)
        //promptType = builtIn ? PromptType.BuiltIn : PromptType.Generated
      }

      runPrompt(prompt, { focusEnd: true, autoScroll: true, showPrompt: true })
    } catch (e) {
      log.error('Error doing magic', e)
    }
  }

  export const runPrompt = async (prompt: ChatPrompt, opts?: Partial<ChatSubmitOptions>) => {
    try {
      log.debug('Handling prompt submit', prompt)

      // Prevent starting a new generation if one is already running
      if (checkIfAlreadyRunning('run prompt')) return

      const mentions = editorElem.getMentions()

      hideInfoPopover()

      await generateAndInsertAIOutput(
        prompt.prompt,
        mentions,
        PageChatMessageSentEventTrigger.NoteUseSuggestion,
        { ...opts, focusInput: true }
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

  export const setChatInputContent = (content: string, focus = false) => {
    // if (!chatInputComp) {
    //   log.error('Chat input component not initialized')
    //   return
    // }
    // chatInputComp.setContent(content, focus)
  }

  export const replaceContent = (text: string) => {
    const editor = editorElem.getEditor()

    editorElem.setContent(text)
    editor.commands.focus('end')
  }

  export const focusChatInput = () => {
    // if (!chatInputEditorElem) {
    //   log.error('Could not get chat input editor instance')
    //   return
    // }
    // const chatInputEditor = chatInputEditorElem.getEditor()
    // chatInputEditor.commands.focus()
  }

  export const handleCreateSurflet = (code?: string) => {
    try {
      const editor = editorElem.getEditor()

      // Get the current position
      const currentPosition = editor.view.state.selection.from

      // Use the provided code or fall back to predefined code
      const surfletCode = code // || predefinedSurfletCode

      // Remove markdown code block markers if present
      // const cleanCode = surfletCode.replace(/```javascript|```/g, '')

      // Create a surflet node with the code
      const surfletNode = editor.view.state.schema.nodes.surflet?.create({ codeContent: '' }, null)

      if (!surfletNode) {
        log.error('Surflet node type not found in schema')
        return
      }

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

      if (!lastSurflet) {
        log.error('Last surflet node not found')
        return
      }

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

      // if (needsFocusChatBar) setTimeout(() => focusInput(), 150)

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
    // if (chat) {
    //   chat.stopGeneration(chatInputGenerationID ?? undefined)
    // }
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

      // if (!chatInputEditorElem) {
      //   log.error('Could not get chat input editor instance')
      //   return
      // }

      // const chatInputEditor = chatInputEditorElem.getEditor()
      // if (!chatInputEditor) {
      //   log.error('Chat input editor instance is not available')
      //   return
      // }

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
      // chatInputEditor
      //   .chain()
      //   .focus('end')
      //   .insertContent([
      //     {
      //       type: 'mention',
      //       attrs: {
      //         id: mentionItem.id,
      //         label: mentionItem.label,
      //         mentionType: mentionItem.type,
      //         icon: mentionItem.icon
      //       }
      //     },
      //     {
      //       type: 'text',
      //       text: ' '
      //     }
      //   ])
      //   .run()

      // // If there's a query, insert it after the mention
      // if (mentionItem.query) {
      //   chatInputEditor.chain().insertContent(mentionItem.query).run()
      // }

      // chatInputEditor.commands.focus('end')

      // Dispatch the mention-insert event to handle any side effects
      // dispatch('mention-insert', mentionItem)

      log.debug('Inserted onboarding mention into editor', mentionItem)
    } catch (error) {
      log.error('Error inserting onboarding mention', error)
      toasts.error('Failed to insert mention')
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
      toasts.error('Failed to insert default browser prompt')
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
      toasts.error('Failed to insert content')
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
      toasts.error('Failed to insert resource links')
    }
  }

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

    // if (unsubscribeTitle) {
    //   unsubscribeTitle()
    // }

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
      handleInsertOnboardingFooter as unknown as EventListener
    )

    // Remove the button insertion event listener
    document.removeEventListener(
      'insert-button-to-note',
      handleInsertButtonToNote as unknown as EventListener
    )
  })
</script>

<div class="text-resource-wrapper text-gray-900 dark:text-gray-100">
  <div class="content">
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
          placeholder={escapeFirstLineChat
            ? 'Start writing a note…'
            : `Ask Surf or start writing a note (esc) …`}
          placeholderNewLine={$editorPlaceholder}
          autocomplete={!($isFirstLine && escapeFirstLineChat)}
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
          enableCaretIndicator={origin !== 'homescreen'}
          onCaretPositionUpdate={handleCaretPositionUpdate}
          onLinkClick={handleLinkClick}
          {slashItemsFetcher}
          {mentionItemsFetcher}
          {linkItemsFetcher}
          on:blur={hidePopover}
          on:click
          on:dragstart
          on:autocomplete={handleAutocomplete}
          on:mention-click={handleMentionClick}
          on:mention-insert={handleMentionInsert}
          on:close-bubble-menu={handleCloseBubbleMenu}
          on:open-bubble-menu={handleOpenBubbleMenu}
          on:button-click={handleNoteButtonClick}
          on:slash-command={handleSlashCommand}
          on:floaty-input-state-update={handleFloatyInputStateUpdate}
          on:last-line-visbility-changed={handleLastLineVisibilityChanged}
          on:is-first-line-changed={handleIsFirstLineChanged}
          on:web-search-completed={debouncedHandleWebSearchCompleted}
          {autofocus}
        >
          <!-- <div slot="floating-menu">
                <FloatingMenu
                  bind:showPrompts={$showPrompts}
                  {prompts}
                  {generatingPrompts}
                  on:generatePrompts={() => generatePrompts()}
                  on:runPrompt={(e) => runPrompt(e.detail)}
                />
              </div> -->
          <div slot="caret-popover">
            <!-- CaretPopover positioned absolutely over the editor -->
            {#if showCaretPopover && caretPosition && !$isFirstLine}
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
  </div>

  <!-- {#if !minimal}
    {#if !manualContextControl}
      <div class="note-settings">
        {#if resource}
          <NoteSettingsMenu {resource} showOnboarding={!manualContextControl} />
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
    background: light-dark(#fff, #181818);
    display: flex;
    justify-content: center;
    align-items: center;

    --text-color: light-dark(#1f163c, #fff);
  }

  .content {
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
    //padding-top: 3em;
    padding-bottom: 0;
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
  }

  :global(
      .notes-editor-wrapper > .editor-container > .editor > .editor-wrapper > div > div.tiptap
    ) {
    max-width: 730px;
    margin: auto;
    padding: 2em 2em;
    box-sizing: content-box;
  }

  :global(body .text-resource-wrapper .tiptap ::selection) {
    color: light-dark(#222, var(--mixed-bg-dark));
    background: light-dark(rgba(204, 229, 255, 1), var(--contrast-color));
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

    :global(code:not(pre code)) {
      background: light-dark(#030712, rgba(255, 255, 255, 0.1));
      padding: 0.2em 0.4em;
      font-size: 0.9em;
    }

    :global(*):not(.mention, a, span) {
      color: inherit !important;
    }
  }
</style>
