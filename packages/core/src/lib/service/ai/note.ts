import {
  conditionalArrayItem,
  useDebounce,
  useLocalStorageStore,
  useLogScope
} from '@horizon/utils'

import { ResourceManager, ResourceNote, ResourceTag } from '../resources'
import type { AIChat, AIService } from './ai'
import type { ContextManager } from './contextManager'
import {
  EventContext,
  PageChatUpdateContextEventAction,
  PageChatUpdateContextEventTrigger,
  ResourceTagsBuiltInKeys,
  ResourceTypes
} from '@horizon/types'
import { derived, get, writable, type Readable, type Writable } from 'svelte/store'
import type { TabsManager } from '../tabs'
import { CHAT_TITLE_GENERATOR_PROMPT } from '../../constants/prompts'
import { ModelTiers, Provider } from '@horizon/types/src/ai.types'
import { SpaceEntryOrigin } from '@horizon/core/src/lib/types'
import type { Telemetry } from '../telemetry'
import { generateContentHash } from './helpers'
import { MentionItemType, type MentionItem } from '@horizon/editor'
import {
  MODEL_CLAUDE_MENTION,
  MODEL_GPT_MENTION,
  MODEL_GEMINI_MENTION,
  NOTE_MENTION
} from '../../constants/chat'
import { tick } from 'svelte'
import type { OasisService } from '../oasis'
import { EventEmitterBase } from '../events'

export type SmartNotesEvents = {
  'open-sidebar': (id: string) => void
}

export class SmartNote {
  log: ReturnType<typeof useLogScope>
  ai: AIService
  resourceManager: ResourceManager
  tabsManager: TabsManager
  oasis: OasisService
  telemetry: Telemetry

  id: string
  resource: ResourceNote
  contextManager: ContextManager
  chat: AIChat | null = null

  title: Writable<string>
  generatingTitle: Writable<boolean>
  contentHash: Writable<string>
  loadingContent: Writable<boolean>

  constructor(resource: ResourceNote, ai: AIService) {
    this.log = useLogScope(`SmartNote ${resource.id}`)
    this.ai = ai
    this.resourceManager = ai.resourceManager
    this.tabsManager = ai.tabsManager
    this.oasis = ai.oasis
    this.telemetry = ai.telemetry

    this.id = resource.id
    this.resource = resource
    this.contextManager = ai.createContextManager(`note-${resource.id}`) // options.isolatedContext ? ai.createContextManager() : ai.contextManager

    this.contentHash = writable('')
    this.loadingContent = writable(false)

    this.title = writable(resource.metadata?.name ?? '')
    this.generatingTitle = writable(false)
  }

  get contentValue() {
    return this.resource.contentValue
  }

  get contentHashValue() {
    return get(this.contentHash)
  }

  get titleValue() {
    return get(this.title)
  }

  async getChat() {
    // if (this.chat) return this.chat

    // const chatId = this.resource.tags?.find(
    //   (tag) => tag.name === ResourceTagsBuiltInKeys.LINKED_CHAT
    // )?.value
    // if (chatId) {
    //   this.log.debug('Chat already exists, loading chat', chatId)
    //   const chat = await this.ai.getChat(chatId)
    //   if (chat) {
    //     this.chat = chat
    //     this.log.debug('Chat loaded', chat)
    //     return chat
    //   }
    // }

    this.log.debug('Creating new chat')
    const chat = await this.ai.createChat({
      contextManager: this.contextManager
    })

    if (!chat) {
      this.log.error('Failed to create chat')
      return null
    }

    await this.resourceManager.createResourceTag(
      this.resource.id,
      ResourceTagsBuiltInKeys.LINKED_CHAT,
      chat.id
    )

    this.chat = chat
    return this.chat
  }

  async loadContent() {
    try {
      this.loadingContent.set(true)

      this.log.debug('Loading note content')
      await this.resource.getContent()

      await tick()

      const initialHash = generateContentHash(this.resource.contentValue ?? '')
      this.contentHash.set(initialHash)
    } catch (error) {
      this.log.error('Failed to load note content', error)
    } finally {
      this.loadingContent.set(false)
    }
  }

  private trackUpdateContent = useDebounce(() => {
    this.telemetry.trackUpdateNote()
  }, 1000)

  /**
   * Makes sure the note is visible in stuff if it was previously empty
   * Also adds it to the active context if it's enabled
   */
  private async checkAndSurfaceEmptyNote(newData: { title?: string; content?: string } = {}) {
    const hasContent = newData.content || this.contentValue
    const hasTitle = newData.title || this.titleValue

    if (!hasContent && !hasTitle) {
      this.log.debug('Note is still empty, not surfacing')
      return
    }

    this.log.debug('Note has content, surfacing in stuff')
    await this.resourceManager.deleteResourceTag(
      this.id,
      ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING
    )
  }

  async saveContent(value: string) {
    const newHash = generateContentHash(value)

    if (newHash === this.contentHashValue) {
      this.log.debug('content hash has not changed, skipping save')
      return
    }

    if (value) {
      await this.checkAndSurfaceEmptyNote({ content: value })
    }

    this.log.debug('saving content', value.length)
    await this.resource.updateContent(value)

    this.contentHash.set(newHash)

    this.trackUpdateContent()
  }

  async updateTitle(name: string) {
    this.log.debug('Updating title', name)

    if (name) {
      await this.checkAndSurfaceEmptyNote({ title: name })
    }

    this.title.set(name)
    await this.resourceManager.updateResourceMetadata(this.resource.id, { name })
  }

  async generateTitle(newContent?: string) {
    try {
      this.generatingTitle.set(true)
      const content = newContent || this.resource.contentValue

      if (!content || content.length < 15) {
        this.log.error('No or not enough content found to generate title')
        return
      }

      const activeTab = this.tabsManager.activeTabValue
      const tabInContext = this.contextManager.tabsInContextValue.find(
        (item) => item.id === activeTab?.id
      )

      let context = ''
      if (tabInContext) {
        context = tabInContext.title
      }

      this.log.debug('Generating title from', content, context)

      const completion = await this.ai.createChatCompletion(
        JSON.stringify({ message: content, context: context }),
        CHAT_TITLE_GENERATOR_PROMPT,
        { tier: ModelTiers.Standard }
      )

      this.log.debug('title completion', completion)

      if (completion.error) {
        this.log.error('Failed to generate title', completion.error)
        return null
      }

      if (!completion.output) {
        this.log.error('Failed to generate title, no output')
        return null
      }

      const title = completion.output.trim()

      this.log.debug('Generated title', title)
      await this.updateTitle(title)

      return title
    } catch (error) {
      this.log.error('Failed to generate title', error)
      return null
    } finally {
      this.generatingTitle.set(false)
    }
  }

  async getChatWithMentions(mentions?: MentionItem[], clearContextOnMention = true) {
    const chatContextManager = this.contextManager.clone()

    if (mentions && mentions.length > 0) {
      if (clearContextOnMention) {
        this.log.debug('Replacing context with mentions', mentions)
        chatContextManager.clear()
      } else {
        this.log.debug('Adding mentions to context', mentions)
      }

      const contextMentions = mentions.filter(
        (mention) => mention.type !== MentionItemType.MODEL && mention.id !== NOTE_MENTION.id
      )
      if (contextMentions.length > 0) {
        contextMentions.forEach((mention) => {
          chatContextManager.addMentionItem(mention)
        })

        this.telemetry.trackPageChatContextUpdate(
          PageChatUpdateContextEventAction.Add,
          this.contextManager.itemsValue.length,
          mentions.length,
          undefined,
          PageChatUpdateContextEventTrigger.EditorMention
        )
      }
    }

    // } else if (manualContextControl) {
    //     this.log.debug('manual context control, skipping adding context')
    // // } else if ($selectedContext) {
    // //     this.log.debug('Adding selected context to context', $selectedContext)
    // //     chatContextManager.addMentionItem($selectedContext)
    // } else {
    //     this.log.debug('Adding active space to context', this.resource.id)
    //     chatContextManager.addActiveSpaceContext('resources')
    // }

    const chat = await this.getChat()
    if (!chat) {
      this.log.error('Failed to create chat')
      return null
    }

    this.log.debug('Got chat', chat)

    const modelMention = (mentions ?? [])
      .reverse()
      .find((mention) => mention.type === MentionItemType.MODEL)

    this.log.debug('Model mention', modelMention)

    if (modelMention) {
      if (modelMention.id === MODEL_CLAUDE_MENTION.id) {
        chat.selectProviderModel(Provider.Anthropic)
      } else if (modelMention.id === MODEL_GPT_MENTION.id) {
        chat.selectProviderModel(Provider.OpenAI)
      } else if (modelMention.id === MODEL_GEMINI_MENTION.id) {
        chat.selectProviderModel(Provider.Google)
      } else {
        const modelId = modelMention.id.replace('model-', '')
        chat.selectModel(modelId)
      }
    }

    chat.contextManager = chatContextManager

    return chat
  }

  async generatePrompts() {
    return get(this.contextManager.generatedPrompts)
  }
}

export class SmartNoteManager extends EventEmitterBase<SmartNotesEvents> {
  static self: SmartNoteManager

  log: ReturnType<typeof useLogScope>
  ai!: AIService
  resourceManager: ResourceManager

  rawNotes: Writable<ResourceNote[]>
  notes: Writable<SmartNote[]>
  activeNoteId: Writable<string>
  activeNote: Readable<SmartNote | null>

  constructor(resourceManager: ResourceManager) {
    super()

    this.log = useLogScope(`SmartNoteManager`)
    this.resourceManager = resourceManager

    this.rawNotes = writable([])
    this.notes = writable([])

    this.activeNoteId = useLocalStorageStore<string>('activeNoteId', '')

    this.activeNote = derived([this.activeNoteId, this.notes], ([activeNoteId, notes]) => {
      const note = notes.find((note) => note.id === activeNoteId)
      if (note) {
        return note
      }

      return null
    })
  }

  get notesValue() {
    return get(this.notes)
  }

  get activeNoteIdValue() {
    return get(this.activeNoteId)
  }

  get activeNoteValue() {
    return get(this.activeNote)
  }

  get rawNotesValue() {
    return get(this.rawNotes)
  }

  attachAIService(ai: AIService) {
    this.ai = ai
  }

  private convertResourceToNote(resource: ResourceNote): SmartNote {
    return new SmartNote(resource, this.ai)
  }

  handleDeletedResources(ids: string[]) {
    if (ids.includes(this.activeNoteIdValue)) {
      this.log.debug('Active note was deleted creating new one')
      this.createNote(undefined, undefined, { switch: true })
    }

    this.notes.update((notes) => notes.filter((note) => !ids.includes(note.id)))
  }

  triggerReactiveUpdate() {
    this.notes.update((notes) => [...notes])
  }

  /**
   * Get the selected note for the currently active space
   */
  getActiveSpaceNote() {
    const space = this.ai.oasis.getActiveSpace()

    this.log.debug('Getting active note', space)

    if (space?.dataValue.selectedNoteResource) {
      const note = this.notesValue.find(
        (note) => note.resource.id === space.dataValue.selectedNoteResource
      )

      if (note) {
        this.log.debug('Found active note', note)
        return note
      }
    }

    return null
  }

  /**
   * Change the active note in the sidebar and store it in the active space
   */
  async changeActiveNote(note: SmartNote, reuseContext = true) {
    this.log.debug('changing active sidebar note', note)

    const oldNote = this.activeNoteValue

    // If the note has no context, we need to fill it with either the previous note's context or the fallback context
    if (note.contextManager.itemsValue.length === 0 && reuseContext) {
      if (this.activeNoteValue && this.activeNoteValue.contextManager.itemsValue.length > 0) {
        this.log.debug('previous note has context,  using it as fallback')
        note.contextManager.replaceWith(this.activeNoteValue.contextManager)
      } else {
        this.log.debug('note has empty context, replacing with fallback context manager')
        note.contextManager.replaceWith(this.ai.fallbackContextManager)
      }
    }

    // TODO: allow setting to null to show the root view (requires view state outside of the sidebar state)
    this.activeNoteId.set(note.id)

    const space = this.ai.oasis.getActiveSpace()
    if (space) {
      await space.updateData({ selectedNoteResource: note.id })
    }

    if (oldNote && oldNote.id !== note.id) {
      // if the note is empty we delete it
      const content = (oldNote.contentValue ?? '').trim()
      const emptyContent = content.length === 0 || content === '<p></p>'
      const isEmptyNote =
        !oldNote.resource.metadata?.name || oldNote.resource.metadata?.name === 'New Note'

      if (emptyContent && isEmptyNote) {
        this.log.debug('previous note is empty, deleting it')
        await this.deleteNote(oldNote.id)
      }
    }
  }

  async loadNotes() {
    const resources = await this.resourceManager.listResourcesByTags([
      ResourceManager.SearchTagDeleted(false),
      ResourceManager.SearchTagResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE)
    ])

    this.log.debug('Fetched note resources', resources)

    if (resources.length === 0) {
      this.log.debug('No notes found')
      return []
    }

    const noteResources = resources.filter((resource) => resource instanceof ResourceNote)
    this.rawNotes.set(noteResources)

    // const notes = resources
    //   noteResources
    //   .map((resource) => {
    //     return this.convertResourceToNote(resource)
    //   })

    // this.notes.set(notes)

    await tick()

    return noteResources
  }

  async getNote(id: string) {
    const existingNote = this.notesValue.find((note) => note.resource.id === id)
    if (existingNote) {
      this.log.debug('Note already loaded, returning existing note')

      // await existingNote.loadContent()
      return existingNote
    }

    const rawNote = this.rawNotesValue.find((note) => note.id === id)
    if (rawNote) {
      this.log.debug('Raw note already loaded, returning existing note')
      const note = this.convertResourceToNote(rawNote)
      // await note.loadContent()
      this.notes.update((notes) => [...notes, note])
      return note
    }

    this.log.debug('Fetching note resource', id)
    const resource = await this.resourceManager.getResource(id)
    if (resource instanceof ResourceNote) {
      this.log.debug('Note resource found', resource)
      const note = this.convertResourceToNote(resource)
      // await note.loadContent()

      this.rawNotes.update((notes) => [...notes, resource])
      this.notes.update((notes) => [...notes, note])

      return note
    }

    this.log.debug('Note resource not found', id)
    return null
  }

  async createNote(
    name?: string,
    content?: string,
    opts?: { switch?: boolean; reuseContext?: boolean; eventContext?: EventContext }
  ) {
    const options = {
      switch: opts?.switch ?? false,
      reuseContext: opts?.reuseContext ?? true,
      eventContext: opts?.eventContext ?? null
    }

    const isEmpty = !name && !content

    const resource = await this.resourceManager.createResourceNote(
      content ?? '',
      {
        name: name
      },
      [ResourceTag.chat(), ...conditionalArrayItem(isEmpty, ResourceTag.hideInEverything())]
    )

    const note = this.convertResourceToNote(resource)
    //await note.loadContent()

    /*
    const currentSpaceId = this.ai.tabsManager.activeScopeIdValue
    const saveToActiveContext = this.ai.config.settingsValue.save_to_active_context

    if (currentSpaceId && saveToActiveContext && !isEmpty) {
      await this.ai.oasis.addResourcesToSpace(
        currentSpaceId,
        [resource.id],
        SpaceEntryOrigin.ManuallyAdded
      )
    }
    */

    this.rawNotes.update((notes) => [...notes, resource])
    this.notes.update((notes) => [...notes, note])

    this.log.debug('Created note', note)

    if (options.switch) {
      await this.changeActiveNote(note, options.reuseContext)
    }

    if (options.eventContext) {
      this.resourceManager.telemetry.trackCreateNote(options.eventContext)
    }

    return note
  }

  async deleteNote(noteId: string) {
    this.log.debug('Deleting note', noteId)

    await this.resourceManager.deleteResource(noteId)

    this.rawNotes.update((notes) => notes.filter((n) => n.id !== noteId))
    this.notes.update((notes) => notes.filter((n) => n.id !== noteId))
  }

  async openNoteInSidebar(noteId: string) {
    const note = await this.getNote(noteId)
    if (!note) return

    this.log.debug('Switching note:', note.id)

    this.changeActiveNote(note)

    this.emit('open-sidebar', note.id)
  }

  static provide(resourceManager: ResourceManager) {
    const service = new SmartNoteManager(resourceManager)

    if (!SmartNoteManager.self) SmartNoteManager.self = service

    return service
  }

  static use() {
    return SmartNoteManager.self
  }
}

export const useSmartNotes = SmartNoteManager.use
export const provideSmartNotes = SmartNoteManager.provide
