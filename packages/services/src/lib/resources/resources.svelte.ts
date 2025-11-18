import { derived, get, writable, type Readable, type Writable } from 'svelte/store'

import {
  useLogScope,
  type ScopedLogger,
  generateID,
  getFormattedDate,
  parseUrlIntoCanonical,
  isDev,
  parseStringIntoUrl,
  generateHash,
  codeLanguageToMimeType,
  conditionalArrayItem,
  getNormalizedHostname,
  isMainRenderer,
  isMac,
  copyToClipboard,
  htmlToMarkdown,
  optimisticParseJSON
} from '@deta/utils'
import {
  generateMarkdownWithFrontmatter,
  parseMarkdownWithFrontmatter
} from '@deta/utils/src/formatting/markdown-extended'
import { SFFS } from '../sffs'
import {
  type AiSFFSQueryResponse,
  type SFFSResourceMetadata,
  type SFFSResourceTag,
  type SFFSPaginationParams,
  type SFFSPaginatedResult,
  ResourceTypes,
  type SFFSResource,
  type ResourceDataLink,
  type ResourceDataPost,
  type ResourceDataArticle,
  type ResourceDataChatMessage,
  type ResourceDataChatThread,
  type SFFSSearchResultEngine,
  ResourceTagsBuiltInKeys,
  type ResourceDataDocument,
  type SFFSSearchParameters,
  type SpaceEntry,
  type Space,
  type SpaceData,
  SpaceEntryOrigin,
  type SFFSRawResource,
  type SpaceEntrySearchOptions,
  type NotebookData,
  type OpenTarget,
  MARKDOWN_RESOURCE_TYPES,
  isMarkdownResourceType,
  isWebResourceType
} from '@deta/types'
import {
  EventBusMessageType,
  EventContext,
  ResourceProcessingStateType,
  ResourceTagDataStateValue,
  NotebookDefaults,
  type DetectedResource,
  type EventBusMessage,
  type ResourceData,
  type ResourceDataAnnotation,
  type ResourceDataHistoryEntry,
  type ResourceState,
  type ResourceStateCombined
} from '@deta/types'
import { getContext, onDestroy, setContext, tick } from 'svelte'
import type { Model } from '@deta/backend/types'
import { WebParser } from '@deta/web-parser'
import type { ConfigService } from '../config'
import { EventEmitterBase, ResourceTag, SearchResourceTags } from '@deta/utils'
import { type CtxItem } from '@deta/ui'
import { Notebook } from '../notebooks'
import { SvelteMap } from 'svelte/reactivity'

export const getPrimaryResourceType = (type: string) => {
  if (type.startsWith(ResourceTypes.DOCUMENT)) {
    return 'document'
  } else if (type.startsWith(ResourceTypes.POST)) {
    return 'post'
  } else if (type.startsWith(ResourceTypes.CHAT_MESSAGE)) {
    return 'chatMessage'
  } else if (type.startsWith(ResourceTypes.CHAT_THREAD)) {
    return 'chatThread'
  } else if (type === ResourceTypes.LINK) {
    return 'link'
  } else if (type === ResourceTypes.ARTICLE) {
    return 'article'
  } else if (type.startsWith('image/')) {
    return 'image'
  } else if (type.startsWith('audio/')) {
    return 'audio'
  } else if (type.startsWith('video/')) {
    return 'video'
  } else {
    return 'file'
  }
}

const DUMMY_PATH = '__dummy'

export const getResourceCtxItems = ({
  resource,
  sortedNotebooks,
  onPin,
  onUnPin,
  onOpen,
  onOpenAsFile,
  onExport,
  onAddToNotebook,
  onOpenOffline,
  onDeleteResource,
  onRemove
}: {
  resource: Resource
  sortedNotebooks: Notebook[]
  onPin?: () => void
  onUnPin?: () => void
  onOpen?: (target: OpenTarget) => void
  onOpenAsFile?: (resourceId: string) => void
  onExport?: (resourceId: string) => void
  onAddToNotebook: (notebookId: string) => void
  onOpenOffline: (resourceId: string) => void
  onDeleteResource: (resourceId: string) => void
  onRemove: (resourceId: string) => void
}): CtxItem[] => {
  return [
    ...conditionalArrayItem<CtxItem>(!!onPin, {
      type: 'action',
      text: 'Pin',
      icon: 'pin',
      action: () => {}
    }),

    ...conditionalArrayItem<CtxItem>(!!onOpen, [
      {
        type: 'action',
        icon: 'eye',
        text: 'Open in Tab',
        tagIcon: 'cursor-arrow-rays',
        action: () => onOpen?.('active_tab')
      },
      {
        type: 'action',
        icon: 'arrow.up.right',
        text: 'Open in Background',
        tagIcon: 'cursor-arrow-rays',
        tagText: isMac() ? '⌘ + ' : 'Ctrl + ',
        action: () => onOpen?.('background_tab')
      },
      {
        type: 'action',
        icon: 'sidebar.right',
        text: 'Open in Sidebar',
        tagIcon: 'cursor-arrow-rays',
        tagText: 'shift + ',
        action: () => onOpen?.('sidebar')
      },
      { type: 'separator' }
    ]),

    {
      type: 'sub-menu',
      icon: 'add',
      text: 'Add to Notebook',
      search: true,
      items: sortedNotebooks
        .filter((e) => e.data?.name?.toLowerCase() !== '.tempspace')
        .filter((e) => e !== undefined)
        .map((notebook) => ({
          type: 'action',
          //icon: space.iconString, // TODO: FIX for ntoebooks
          text: notebook.nameValue,
          action: () => onAddToNotebook(notebook.id)
        }))
    },

    ...conditionalArrayItem<CtxItem>(!!resource.url, {
      type: 'action',
      icon: 'copy',
      text: 'Copy URL',
      action: () => copyToClipboard(resource.url)
    }),

    ...conditionalArrayItem<CtxItem>(isDev || (window as any).LOG_LEVEL === 'debug', {
      type: 'action',
      icon: 'code',
      text: 'Copy Resource ID',
      action: () => copyToClipboard(resource.id)
    }),

    { type: 'separator' },

    ...conditionalArrayItem<CtxItem>(onOpenOffline !== undefined, [
      {
        type: 'action',
        text: 'View Offline Version',
        icon: 'save',
        action: () => onOpenOffline(resource.id)
      }
    ]),

    ...conditionalArrayItem<CtxItem>(onOpenAsFile !== undefined, {
      type: 'action',
      text: isMac() ? 'Reveal in Finder' : 'Show in Explorer',
      icon: 'folder.open',
      action: () => onOpenAsFile?.(resource.id)
    }),

    ...conditionalArrayItem<CtxItem>(
      onExport !== undefined && resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE,
      {
        type: 'action',
        text: 'Export as Markdown',
        icon: 'save',
        action: () => onExport?.(resource.id)
      }
    ),

    ...conditionalArrayItem<CtxItem>(resource.canBeRefreshed.value, {
      type: 'action',
      disabled: resource.stateValue === 'extracting',
      icon: 'reload',
      text: resource.canBeRefreshed.type === 'refresh' ? 'Refresh Content' : 'Reprocess Content',
      action: () => {
        try {
          resource.refreshExtractedData()
        } catch (error) {
          // no-op
        }
      }
    }),

    { type: 'separator' },

    ...(onRemove
      ? [
          {
            type: 'sub-menu',
            icon: 'trash',
            text: 'Remove',
            kind: 'danger',
            items: [
              {
                type: 'action',
                icon: 'close',
                text: 'Remove from Notebook',
                kind: 'danger',
                action: () => onRemove(resource.id)
              },
              {
                type: 'action',
                icon: 'trash',
                text: 'Delete from Surf',
                kind: 'danger',
                action: () => onDeleteResource(resource.id)
              }
            ]
          }
        ]
      : [
          {
            type: 'action',
            kind: 'danger',
            text: 'Delete',
            icon: 'trash',
            action: () => onDeleteResource(resource.id)
          }
        ])
  ] as CtxItem[]
}

export enum ResourceManagerEvents {
  Created = 'created',
  Deleted = 'deleted',
  Updated = 'updated',
  Recovered = 'recovered',

  NotebookAddResources = 'notebookAddResources',
  NotebookRemoveResources = 'notebookRemoveResources'
}
export type ResourceManagerEventHandlers = {
  [ResourceManagerEvents.Created]: (resource: ResourceObject) => void
  [ResourceManagerEvents.Deleted]: (resourceId: string) => void
  [ResourceManagerEvents.Updated]: (resource: ResourceObject) => void
  [ResourceManagerEvents.Recovered]: (resourceId: string) => void

  [ResourceManagerEvents.NotebookAddResources]: (notebookId: string, resourceIds: string[]) => void
  [ResourceManagerEvents.NotebookRemoveResources]: (
    notebookId: string,
    resourceIds: string[]
  ) => void
}

export enum ResourceEvents {
  UpdatedMetadata = 'updated-metadata',
  UpdatedTags = 'updated-tags',
  UpdatedData = 'updated-data',

  Extern_UpdatedMetadata = 'extern_updated-metadata',
  Extern_UpdatedTags = 'extern_updated-tags',
  Extern_UpdatedData = 'extern_updated-data'
}
export type ResourceEventHandlers = {
  [ResourceEvents.UpdatedMetadata]: (metadata: SFFSResourceMetadata) => void
  [ResourceEvents.UpdatedTags]: (tags: SFFSResourceTag[]) => void
  [ResourceEvents.UpdatedData]: (data: Blob) => void

  // Extern state updates
  [ResourceEvents.Extern_UpdatedMetadata]: (resourceId: string) => void
  [ResourceEvents.Extern_UpdatedTags]: (resourceId: string) => void
  [ResourceEvents.Extern_UpdatedData]: (resourceId: string) => void
}

export class Resource extends EventEmitterBase<ResourceEventHandlers> {
  private sffs: SFFS
  resourceManager: ResourceManager
  log: ScopedLogger

  id: string
  type: string
  path: string
  createdAt: string
  updatedAt: string
  deleted: boolean
  dummy: boolean

  metadata = $state<SFFSResourceMetadata>()
  tags?: SFFSResourceTag[]
  annotations?: ResourceAnnotation[]

  rawData: Blob | null
  readDataPromise: Promise<Blob> | null // used to avoid duplicate reads
  dataUsed: number // number of times the data is being used

  spaceIds: Writable<string[]>
  extractionState: Writable<ResourceState>
  postProcessingState: Writable<ResourceState>
  state: Readable<ResourceStateCombined>

  constructor(sffs: SFFS, resourceManager: ResourceManager, data: SFFSResource) {
    super()
    this.log = useLogScope(`SFFSResource ${data.id}`)
    this.sffs = sffs
    this.resourceManager = resourceManager

    this.id = data.id
    this.type = data.type
    this.path = data.path
    this.createdAt = data.createdAt
    this.updatedAt = data.updatedAt
    this.deleted = data.deleted
    this.dummy = data.path === DUMMY_PATH
    this.metadata = data.metadata
    this.tags = data.tags
    this.annotations = data.annotations?.map(
      (a) => new ResourceAnnotation(sffs, this.resourceManager, a)
    )

    this.rawData = null
    this.readDataPromise = null
    this.dataUsed = 0

    this.spaceIds = writable(data.spaceIds ?? [])

    const stateMap = {
      [ResourceProcessingStateType.Pending]: 'running',
      [ResourceProcessingStateType.Started]: 'running',
      [ResourceProcessingStateType.Failed]: 'error',
      [ResourceProcessingStateType.Finished]: 'idle'
    }
    this.extractionState = writable('idle')
    this.postProcessingState = writable(
      (data.postProcessingState
        ? stateMap[data.postProcessingState.type] || 'idle'
        : 'idle') as ResourceState
    )
    this.state = derived(
      [this.extractionState, this.postProcessingState],
      ([extractionState, postProcessingState]) => {
        if (extractionState === 'idle' && postProcessingState === 'idle') {
          return 'idle'
        } else if (extractionState === 'error' || postProcessingState === 'error') {
          return 'error'
        } else if (extractionState === 'running') {
          return 'extracting'
        } else if (postProcessingState === 'running') {
          return 'post-processing'
        } else {
          return 'idle'
        }
      }
    )
  }

  get stateValue() {
    return get(this.state)
  }

  get url() {
    return parseStringIntoUrl(
      this.tags?.find((x) => x.name === ResourceTagsBuiltInKeys.CANONICAL_URL)?.value ||
        this.metadata?.sourceURI ||
        ''
    )?.href
  }

  get spaceIdsValue() {
    return get(this.spaceIds)
  }

  get canBeRefreshed() {
    const canBeRefreshed = isWebResourceType(this.type)
    const canBeReprocessed = this.type === ResourceTypes.PDF || this.type.startsWith('image/')

    return {
      value: canBeRefreshed || canBeReprocessed,
      type: canBeRefreshed ? 'refresh' : canBeReprocessed ? 'reprocess' : null
    }
  }

  private async readDataAsBlob() {
    const buffer = (await this.sffs.readDataFile(this.id, this.type, this.path)) as any

    return new Blob([buffer], { type: this.type })
  }

  private async readData() {
    // this.log.debug('reading resource data from', this.path)

    if (this.readDataPromise !== null) {
      return this.readDataPromise
    }

    // store promise to avoid duplicate reads
    this.readDataPromise = this.readDataAsBlob()
    this.readDataPromise.then((data) => {
      this.rawData = data
      this.readDataPromise = null
    })

    return this.readDataPromise
  }

  async writeData() {
    if (this.dummy) {
      this.log.debug('skipping writing resource data for dummy resource')
      return
    }

    this.log.debug('writing resource data to', this.path)

    if (!this.rawData) {
      this.log.warn('no data to write')
      return
    }

    await this.sffs.writeDataFile(this.id, this.type, this.path, this.rawData)
  }

  updateData(data: Blob, write = true) {
    this.log.debug('updating resource data with', data)

    this.rawData = data
    this.updatedAt = new Date().toISOString()

    this.emit(ResourceEvents.UpdatedData, data)
    this.resourceManager.emit(ResourceManagerEvents.Updated, this)
    if (write) {
      return this.writeData()
    } else {
      return Promise.resolve()
    }
  }

  updateMetadata(updates: Partial<SFFSResourceMetadata>) {
    this.log.debug('updating resource metadata with', updates)

    this.metadata = {
      ...(this.metadata ?? {}),
      ...updates
    } as SFFSResourceMetadata
    this.updatedAt = new Date().toISOString()
    this.emit(ResourceEvents.UpdatedMetadata, this.metadata)
  }

  updateTags(updates: SFFSResourceTag[]) {
    this.log.debug('updating resource tags with', updates)

    this.tags = [...(this.tags ?? []), ...updates]
    this.updatedAt = new Date().toISOString()
    this.emit(ResourceEvents.UpdatedTags, this.tags ?? [])
  }

  updateTag(name: string, value: string) {
    this.log.debug('updating resource tag', name, value)

    const existingTag = this.tags?.find((t) => t.name === name)
    if (existingTag) {
      existingTag.value = value
    } else {
      this.tags = [...(this.tags ?? []), { name, value }]
    }

    this.updatedAt = new Date().toISOString()
    this.emit(ResourceEvents.UpdatedTags, this.tags ?? [])
  }

  addTag(tag: SFFSResourceTag) {
    this.log.debug('adding resource tag', tag)

    this.tags = [...(this.tags ?? []), tag]
    this.updatedAt = new Date().toISOString()
    this.emit(ResourceEvents.UpdatedTags, this.tags ?? [])
  }

  removeTag(name: string) {
    this.log.debug('removing resource tag', name)

    this.tags = this.tags?.filter((t) => t.name !== name)
    this.updatedAt = new Date().toISOString()
    this.emit(ResourceEvents.UpdatedTags, this.tags ?? [])
  }

  removeTagByID(id: string) {
    this.log.debug('removing resource tag by id', id)

    this.tags = this.tags?.filter((t) => t?.id !== id)
    this.updatedAt = new Date().toISOString()
    this.emit(ResourceEvents.UpdatedTags, this.tags ?? [])
  }

  getData(fresh = false) {
    this.dataUsed += 1

    if (this.rawData && !fresh) {
      return Promise.resolve(this.rawData)
    }

    return this.readData()
  }

  releaseData() {
    this.dataUsed -= 1

    if (this.dataUsed <= 0) {
      this.dataUsed = 0
      this.rawData = null
    }
  }

  updateExtractionState(state: ResourceState) {
    this.extractionState.set(state)
  }

  updatePostProcessingState(state: ResourceState) {
    this.log.debug('updating post processing state', state)
    this.postProcessingState.set(state)
  }

  /** Returns a raw resource object which can be serialized (sent through IPC)
   * without any references to services and other non-serializable properties
   */
  getTransferableObject(): Record<string, unknown> {
    return [
      'id',
      'createdAt',
      'updatedAt',
      'dummy',
      'deleted',
      'path',
      'type',
      'tags',
      'annotations',
      'parsedData',
      'metadata'
    ].reduce<Record<string, unknown>>((filtered, prop) => {
      if (prop in this) filtered[prop] = this[prop as keyof this]
      return filtered
    }, {})
  }

  async refreshExtractedData() {
    try {
      this.log.debug('Refreshing resource for context', this.id)
      await this.resourceManager.refreshResourceData(this)
    } catch (error) {
      this.log.error('Failed to refresh resource', this.id, error)
    }
  }
}

// TODO: adapt to new resource data
export class ResourceNote extends Resource {
  // data: Writable<SFFSResourceDataNote | null>

  parsedData: Writable<string | null>

  get contentValue() {
    return get(this.parsedData)
  }

  constructor(sffs: SFFS, resourceManager: ResourceManager, data: SFFSResource) {
    super(sffs, resourceManager, data)
    // this.data = writable(null)
    this.parsedData = writable(null)
  }

  async getContent(fresh = false) {
    const content = get(this.parsedData)
    if (content && !fresh) {
      return this.parsedData
    }

    const data = await this.getData(fresh)
    const text = await data.text()

    this.parsedData.set(text)
    return this.parsedData
  }

  async updateContent(content: string) {
    this.parsedData.set(content)

    this.log.debug('updating note content with', { content })
    const markdown = await htmlToMarkdown(content)
    this.log.debug('updating note content with markdown', { markdown })

    const blob = new Blob([content], { type: this.type })
    return this.updateData(blob, true)
  }
}

export class ResourceJSON<T> extends Resource {
  // data: Writable<SFFSResourceDataBookmark | null>

  parsedData: T | null

  constructor(sffs: SFFS, resourceManager: ResourceManager, data: SFFSResource) {
    super(sffs, resourceManager, data)
    this.parsedData = null
    // this.data = writable(null)
  }

  async updateData(data: Blob, write?: boolean): Promise<void> {
    this.parsedData = null

    await super.updateData(data, write)

    await this.getParsedData(true)
  }

  async getParsedData(fresh = false) {
    if (this.parsedData && !fresh) {
      return this.parsedData
    }

    const data = await this.getData()
    const text = await data.text()

    if (isMarkdownResourceType(this.type) && this.path.endsWith('.md')) {
      const parsed = await parseMarkdownWithFrontmatter<T>(text)

      // if no frontmatter found fallback to try parsing as JSON
      if (!parsed.matter || Object.keys(parsed.matter as any).length === 0) {
        this.log.warn('no frontmatter found in markdown, trying to parse as JSON instead', this.id)
        const parsedJSON = optimisticParseJSON<T>(text)
        if (parsedJSON && Object.keys(parsedJSON).length > 0) {
          this.parsedData = parsedJSON

          // write as proper markdown with frontmatter
          try {
            await this.updateParsedData(parsedJSON)
          } catch (error) {
            this.log.error('failed to update resource data with parsed JSON', error)
          }

          return parsedJSON
        }
      }

      this.parsedData = {
        ...parsed.matter,
        content_plain: parsed.content
      }

      return this.parsedData
    }

    const parsed = JSON.parse(text) as T

    this.parsedData = parsed
    return parsed
  }

  async updateParsedData(data: T) {
    this.parsedData = data

    const blob = await this.resourceManager.createFormattedResourceBlob(
      this.type,
      data as ResourceData
    )
    return this.updateData(blob, true)
  }
}

export class ResourcePost extends ResourceJSON<ResourceDataPost> {}
export class ResourceArticle extends ResourceJSON<ResourceDataArticle> {}
export class ResourceLink extends ResourceJSON<ResourceDataLink> {}
export class ResourceChatMessage extends ResourceJSON<ResourceDataChatMessage> {}
export class ResourceChatThread extends ResourceJSON<ResourceDataChatThread> {}
export class ResourceDocument extends ResourceJSON<ResourceDataDocument> {}
export class ResourceAnnotation extends ResourceJSON<ResourceDataAnnotation> {}
export class ResourceHistoryEntry extends ResourceJSON<ResourceDataHistoryEntry> {}

export type ResourceObject =
  | Resource
  | ResourceArticle
  | ResourceLink
  | ResourcePost
  | ResourceChatMessage
  | ResourceChatThread
  | ResourceNote
  | ResourceAnnotation
  | ResourceHistoryEntry

export type ResourceSearchResultItem = {
  id: string // resource id
  resource: ResourceObject
  annotations?: ResourceAnnotation[]
  engine: SFFSSearchResultEngine
}

export type SpaceSearchResultItem = {
  id: string
  space: Space
  engine: SFFSSearchResultEngine
}

export interface ResourceSearchResult {
  resources: ResourceSearchResultItem[]
  spaces: SpaceSearchResultItem[]
  space_entries: any[]
}

export class ResourceManager extends EventEmitterBase<ResourceManagerEventHandlers> {
  private log: ScopedLogger
  sffs: SFFS
  config: ConfigService

  resources = $state() as SvelteMap<string, ResourceObject>

  static self: ResourceManager

  constructor(config: ConfigService) {
    super()
    this.log = useLogScope('SFFSResourceManager')
    this.sffs = new SFFS()
    this.config = config
    this.resources = new SvelteMap()

    if (isDev) {
      // @ts-ignore
      window.resourceManager = this
    }

    const unregister = this.sffs.registerEventBustHandler((event) =>
      this.handleEventBusMessage(event)
    )
    onDestroy(() => {
      this.log.debug('unregistering event bus handler')
      unregister()
    })
  }

  // attachAIService(ai: AIService) {
  //   this.ai = ai
  // }

  private createResourceObject(data: SFFSResource): ResourceObject {
    if (data.type === ResourceTypes.DOCUMENT_SPACE_NOTE) {
      return new ResourceNote(this.sffs, this, data)
    } else if (data.type === ResourceTypes.LINK) {
      return new ResourceLink(this.sffs, this, data)
    } else if (data.type.startsWith(ResourceTypes.ARTICLE)) {
      return new ResourceArticle(this.sffs, this, data)
    } else if (data.type.startsWith(ResourceTypes.POST)) {
      return new ResourcePost(this.sffs, this, data)
    } else if (data.type.startsWith(ResourceTypes.CHAT_MESSAGE)) {
      return new ResourceChatMessage(this.sffs, this, data)
    } else if (data.type.startsWith(ResourceTypes.CHAT_THREAD)) {
      return new ResourceChatThread(this.sffs, this, data)
    } else if (data.type.startsWith(ResourceTypes.DOCUMENT)) {
      return new ResourceDocument(this.sffs, this, data)
    } else if (data.type.startsWith(ResourceTypes.ANNOTATION)) {
      return new ResourceAnnotation(this.sffs, this, data)
    } else if (data.type.startsWith(ResourceTypes.HISTORY_ENTRY)) {
      return new ResourceHistoryEntry(this.sffs, this, data)
    } else {
      return new Resource(this.sffs, this, data)
    }
  }

  private findOrCreateResourceObject(resource: SFFSResource) {
    // TODO: Id should match right? :thinking:
    const existingResource = this.resources.get(resource.id)
    if (existingResource) {
      return existingResource
    }

    let res = this.createResourceObject(resource)
    this.emit(ResourceManagerEvents.Created, res)
    return res
  }

  private findOrGetResourceObject(id: string, opts: { includeAnnotations?: boolean } = {}) {
    const existingResource = this.resources.get(id)
    if (existingResource) {
      return Promise.resolve(existingResource)
    }

    return this.getResource(id, opts)
  }

  private handleEventBusMessage(event: EventBusMessage) {
    if (event.type === EventBusMessageType.ResourceProcessingMessage) {
      this.handleResourceProcessingMessage(event.resource_id, event.status.type)
    }
  }

  private async handleResourceProcessingMessage(id: string, status: ResourceProcessingStateType) {
    this.log.debug('handling resource processing message', id, status)

    const resource = this.resources.get(id)
    if (!resource) {
      this.log.debug('resource not used, ignoring event', id)
      return
    }

    if (status === ResourceProcessingStateType.Pending) {
      resource.updatePostProcessingState('running')
    } else if (status === ResourceProcessingStateType.Started) {
      resource.updatePostProcessingState('running')
    } else if (status === ResourceProcessingStateType.Finished) {
      resource.updatePostProcessingState('idle')
    } else if (status === ResourceProcessingStateType.Failed) {
      resource.updatePostProcessingState('error')
    }
  }

  async createDummyResource(
    type: string,
    data: Blob,
    metadata?: Partial<SFFSResourceMetadata>,
    tags?: SFFSResourceTag[]
  ) {
    this.log.debug('creating dummy resource', type, data, metadata, tags)
    const parsedMetadata = Object.assign(
      {
        name: '',
        alt: '',
        sourceURI: '',
        userContext: ''
      },
      metadata
    )

    const resource = this.createResourceObject({
      id: generateID(),
      type: type,
      path: DUMMY_PATH,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deleted: false,
      metadata: parsedMetadata,
      tags: tags,
      annotations: []
    })

    resource.rawData = data
    resource.getData = () => Promise.resolve(data)

    const text = await data.text()

    if (resource instanceof ResourceNote) {
      resource.parsedData.set(text)
      resource.getContent = () => Promise.resolve(resource.parsedData)
    } else if (resource instanceof ResourceJSON) {
      const parsed = JSON.parse(text)
      resource.parsedData = parsed
      resource.getParsedData = () => Promise.resolve(parsed)
    }

    this.log.debug('created dummy resource', resource)

    this.resources.set(resource.id, resource)

    this.emit(ResourceManagerEvents.Created, resource)
    return resource as ResourceObject
  }

  async createResource(
    type: string,
    data?: Blob,
    metadata?: Partial<SFFSResourceMetadata>,
    tags?: SFFSResourceTag[]
  ) {
    this.log.debug('creating resource', type, data, metadata, tags)
    const parsedMetadata = Object.assign(
      {
        name: '',
        alt: '',
        sourceURI: '',
        userContext: ''
      },
      metadata
    )

    // Make sure we normalize the canonical URL to prevent broken links between resource and pages
    const canonicalUrlTag = tags?.find((t) => t.name === ResourceTagsBuiltInKeys.CANONICAL_URL)
    if (canonicalUrlTag) {
      const canonicalURL = parseUrlIntoCanonical(canonicalUrlTag.value)
      if (canonicalURL) {
        canonicalUrlTag.value = canonicalURL
      }
    }

    // We only want to cleanup traditional file types, not web resources or PDFs (which are already handled in BrowserTab)
    // const typeSupportsCleanup =
    //   !WEB_RESOURCE_TYPES.some((x) => type.startsWith(x)) &&
    //   type !== ResourceTypes.PDF &&
    //   type !== ResourceTypes.DOCUMENT_SPACE_NOTE
    // if (typeSupportsCleanup && this.config.settingsValue.cleanup_filenames) {
    //   const filename = metadata?.name
    //   if (filename) {
    //     const context = canonicalUrlTag?.value || metadata?.sourceURI || ''
    //     this.log.debug('cleaning up filename', filename, context)
    //     const completion = await this.ai.cleanupTitle(filename, context)
    //     if (!completion.error && completion.output) {
    //       this.log.debug('cleaned up filename', filename, completion.output)
    //       parsedMetadata.name = completion.output
    //     }
    //   }
    // }

    const sffsItem = await this.sffs.createResource(type, parsedMetadata, tags)
    const resource = this.createResourceObject(sffsItem)

    this.log.debug('created resource', resource)
    this.resources.set(resource.id, resource)

    // store the data in the resource and write it to sffs
    if (data) {
      resource.rawData = data
      await resource.writeData()
    }

    this.emit(ResourceManagerEvents.Created, resource)
    return resource
  }

  async readResources() {
    const resourceItems = await this.sffs.readResources()
    const resources = resourceItems
      .map((item) => new Resource(this.sffs, this, item))
      .map((e) => [e.id, e])
    this.resources = new SvelteMap<string, ResourceObject>(resources)
  }

  async listResourceIDsByTags(
    tags: SFFSResourceTag[],
    paginationParams: SFFSPaginationParams,
    // undefined = all spaces
    // empty string = does not belong to any space
    // non empty string = specific space
    spaceId?: string
  ) {
    const results = await this.sffs.listResourceIDsByTags(tags, paginationParams, spaceId)
    return results
  }

  // TODO: why leak SFFS types and still have this abstractions?
  async listResourcesByTags(
    tags: SFFSResourceTag[],
    paginationParams: SFFSPaginationParams,
    opts: {
      includeAnnotations?: boolean
      // undefined = all spaces
      // empty string = does not belong to any space
      // non empty string = specific space
      spaceId?: string
    } = {}
  ) {
    const result = await this.sffs.listResourceIDsByTags(tags, paginationParams, opts?.spaceId)
    // TODO: is this the right behavior?
    if (!result) {
      return []
    }
    this.log.debug('found resource ids', result.items)
    const resources = (await Promise.all(
      result.items.map((id) => this.findOrGetResourceObject(id, opts))
    )) as Resource[]
    return {
      items: resources.filter((r) => r !== null),
      next_cursor: result.next_cursor,
      has_more: result.has_more
    } as SFFSPaginatedResult<Resource>
  }

  async listAllResourcesByTags(
    tags: SFFSResourceTag[],
    opts: { includeAnnotations?: boolean; excludeWithinSpaces?: boolean } = {}
  ) {
    const result = await this.sffs.listAllResourceIDsByTags(
      tags,
      opts?.excludeWithinSpaces ?? false
    )
    // TODO: is this the right behavior?
    if (!result) {
      return []
    }
    this.log.debug('found resource ids', result)
    const resources = (await Promise.all(
      result.map((id) => this.findOrGetResourceObject(id, opts))
    )) as Resource[]
    return resources.filter((r) => r !== null)
  }

  async listAllResourcesAndSpaces(tags: SFFSResourceTag[]) {
    const result = await this.sffs.listAllResourcesAndSpaces(tags)
    this.log.debug('all resources and spaces', result)
    if (!result) {
      return []
    }
    let mapped = await Promise.all(
      result.map(async (item) => {
        if (item.item_type === 'resource') {
          const resource = await this.findOrGetResourceObject(item.id)
          if (resource) {
            return {
              id: item.id,
              type: 'resource',
              data: resource
            }
          }
        } else if (item.item_type === 'space') {
          const space = this.sffs.convertRawSpaceToSpace(item)
          return {
            id: item.id,
            type: 'space',
            data: space
          }
        }
      })
    )
    return mapped.filter((item) => item !== undefined)
  }

  // NOTE: if no `keyword_limit` is provided, the backend uses 100 as the default value
  async searchResources(
    query: string,
    tags?: SFFSResourceTag[],
    parameters?: SFFSSearchParameters
  ): Promise<ResourceSearchResult> {
    const rawResults = await this.sffs.searchResources(query, tags, parameters)
    const resources = rawResults.items.map(
      (item) =>
        ({
          id: item.resource.id,
          engine: item.engine,
          resource: this.findOrCreateResourceObject(item.resource),
          annotations: item.resource.annotations?.map((a) => this.findOrCreateResourceObject(a))
        }) as ResourceSearchResultItem
    )
    const spaces = rawResults.spaces.map(
      (item) =>
        ({
          id: item.space.id,
          engine: item.engine,
          space: this.sffs.convertRawSpaceToSpace(item.space)
        }) as SpaceSearchResultItem
    )
    return {
      resources,
      spaces,
      space_entries: rawResults.space_entries
    }
  }

  async getResourcesFromSourceURL(url: string, tags?: SFFSResourceTag[]) {
    const surfUrlMatch = url.match(/surf:\/\/resource\/([^\/]+)/)
    if (surfUrlMatch) {
      const resource = await this.getResource(surfUrlMatch[1])
      return resource ? [resource] : []
    }

    const canonicalURL = parseUrlIntoCanonical(url)
    if (!canonicalURL) {
      return []
    }

    const resources = await this.listAllResourcesByTags([
      SearchResourceTags.CanonicalURL(canonicalURL),
      SearchResourceTags.Deleted(false),
      ...(tags ?? [])
    ])

    // if the canonical URL is different, we should also search for the original URL
    if (canonicalURL !== url) {
      const additionalResources = await this.listAllResourcesByTags([
        SearchResourceTags.CanonicalURL(url),
        SearchResourceTags.Deleted(false),
        ...(tags ?? [])
      ])

      resources.push(...additionalResources)
    }

    return resources
  }

  async getResourcesFromSourceHostname(url: string, tags?: SFFSResourceTag[]) {
    const hostname = getNormalizedHostname(url)
    this.log.debug('searching for resources from hostname', hostname, url)
    const protocol = url.startsWith('http://') ? 'http' : 'https'
    const prefixedHostname = `${protocol}://${hostname}`

    const resources = await this.listAllResourcesByTags([
      SearchResourceTags.CanonicalURL(prefixedHostname, 'prefix'),
      SearchResourceTags.Deleted(false),
      ...(tags ?? [])
    ])

    return resources
  }

  async getAnnotationsForResource(id: string) {
    const resources = await this.listAllResourcesByTags([
      SearchResourceTags.ResourceType(ResourceTypes.ANNOTATION),
      SearchResourceTags.Annotates(id),
      SearchResourceTags.Deleted(false)
    ])

    return resources as ResourceAnnotation[]
  }

  async getRemoteResource(id: string, remoteURL: string) {
    const res = await fetch(`${remoteURL}/resources/${id}`)
    if (!res.ok) {
      if (res.status === 404) {
        return null
      }
      throw new Error('failed to fetch resource')
    }
    const obj = await res.json()
    return this.findOrCreateResourceObject(obj)
  }

  async getResourceWithAnnotations(id: string) {
    const loadedResource = this.resources.get(id)
    if (loadedResource) {
      return loadedResource
    }

    // read resource from sffs
    const resourceItem = await this.sffs.readResource(id, {
      includeAnnotations: true
    })
    if (!resourceItem) {
      return null
    }

    const resource = this.findOrCreateResourceObject(resourceItem)
    this.resources.set(resource.id, resource)

    // const annotations = (resourceItem.annotations ?? []).map((a) =>
    //   this.findOrCreateResourceObject(a)
    // ) as ResourceAnnotation[]

    return resource
  }

  async getHistoryEntries(limit?: number) {
    return this.sffs.getHistoryEntries(limit)
  }

  async findHistoryEntriesByHostname(url: string) {
    const result = await this.sffs.searchHistoryEntriesByHostname(url)
    return result
  }

  addAnnotationToLoadedResource(resourceId: string, annotation: ResourceAnnotation) {
    const loadedResource = this.resources.get(resourceId)
    if (loadedResource) {
      this.log.debug('adding annotation to loaded resource', resourceId, annotation)
      loadedResource.annotations = [...(loadedResource.annotations ?? []), annotation]
    } else {
      this.log.debug('resource not loaded, skipping adding annotation', resourceId)
    }
  }

  async getResource(id: string, opts: { includeAnnotations?: boolean } = {}) {
    // check if resource is already loaded
    const loadedResource = this.resources.get(id)
    if (loadedResource) {
      return loadedResource
    }

    // read resource from sffs
    const resourceItem = await this.sffs.readResource(id, opts)
    if (!resourceItem) {
      return null
    }

    const resource = this.findOrCreateResourceObject(resourceItem)
    this.resources.set(resource.id, resource)

    return resource
  }

  async getAIChatDataSource(hash: string) {
    return this.sffs.getAIChatDataSource(hash)
  }

  async deleteResource(id: string) {
    const resource = await this.getResource(id)
    if (!resource) {
      throw new Error('resource not found')
    }

    if (!resource.dummy) {
      await this.cleanupResourceTags([id])

      // delete resource from sffs
      await this.sffs.deleteResource(id)
      // better to handle in user land
    }

    this.resources.delete(resource.id)
    this.emit(ResourceManagerEvents.Deleted, id)
  }

  async cleanupResourceTags(ids: string[]) {
    const previewResourceIds: string[] = []

    for (const id of ids) {
      const rootResource = await this.getResource(id)
      if (!rootResource) continue

      const previewResourceId = rootResource.tags?.find(
        (x) => x.name === ResourceTagsBuiltInKeys.PREVIEW_IMAGE_RESOURCE
      )?.value

      if (previewResourceId) {
        previewResourceIds.push(previewResourceId)
      }
    }

    if (previewResourceIds.length > 0) {
      await this.sffs.deleteResources(previewResourceIds)
    }
  }

  async deleteResources(ids: string[]) {
    if (!ids.length) return

    await this.cleanupResourceTags(ids)

    await this.sffs.deleteResources(ids)
    ids.forEach((id) => this.resources.delete(id))

    ids.forEach((id) => {
      this.emit(ResourceManagerEvents.Deleted, id)
    })
  }

  async deleteResourcesByTags(tags: SFFSResourceTag[]) {
    const resourceIds = await this.sffs.listAllResourceIDsByTags(tags)
    this.log.debug('deleting resources by tags', tags, resourceIds)
    if (!resourceIds.length) return
    await this.deleteResources(resourceIds)
  }

  async deleteHistoryEntry(id: string) {
    await this.sffs.deleteHistoryEntry(id)
  }

  async deleteAllHistoryEntries() {
    await this.sffs.deleteAllHistoryEntries()
  }

  // returns only a list of hostnames
  async searchHistoryEntriesByHostnamePrefix(prefix: string, since?: Date) {
    return this.sffs.searchHistoryEntriesByHostnamePrefix(prefix, since)
  }

  async searchHistoryEntriesByUrlAndTitle(query: string, since?: Date) {
    return this.sffs.searchHistoryEntriesByUrlAndTitle(query, since)
  }

  async reloadResource(id: string, external = false) {
    if (external) {
      const resource = this.resources.get(id)
      if (resource) {
        const freshResourceData = await this.sffs.readResource(id)
        if (freshResourceData?.metadata) {
          resource.metadata = freshResourceData.metadata
        }
      }
      return resource
    }

    const resourceItem = await this.sffs.readResource(id)
    if (!resourceItem) {
      return null
    }
    const resource = this.createResourceObject(resourceItem)
    this.resources.set(resource.id, resource)

    this.emit(ResourceManagerEvents.Updated, resource)
    return resource
  }

  async updateResource(
    id: string,
    data: Pick<Partial<SFFSRawResource>, 'created_at' | 'updated_at' | 'deleted'>
  ) {
    const resource = await this.getResource(id)
    if (!resource) {
      throw new Error('resource not found')
    }

    this.log.debug('updating resource', id, data)

    if (data.created_at) {
      resource.createdAt = data.created_at
    }

    if (data.updated_at) {
      resource.updatedAt = data.updated_at
    }

    if (data.deleted) {
      resource.deleted = data.deleted === 1
    }

    const fullData = {
      id: id,
      resource_path: resource.path,
      resource_type: resource.type,
      created_at: resource.createdAt,
      updated_at: resource.updatedAt,
      deleted: resource.deleted ? 1 : 0,
      ...data
    } as SFFSRawResource

    await this.sffs.updateResource(fullData)
  }

  async updateResourceData(id: string, data: Blob, write = true) {
    const resource = await this.getResource(id)
    if (!resource) {
      throw new Error('resource not found')
    }

    return resource.updateData(data, write)
  }

  async updateResourceParsedData(id: string, data: ResourceData, write = true) {
    const resource = await this.getResource(id)
    if (!resource) {
      throw new Error('resource not found')
    }

    const blob = new Blob([JSON.stringify(data)], { type: resource.type })

    return resource.updateData(blob, write)
  }

  async updateResourceMetadata(id: string, updates: Partial<SFFSResourceMetadata>) {
    const resource = await this.getResource(id)
    if (!resource) {
      throw new Error('resource not found')
    }

    const fullMetadata = Object.assign(resource.metadata ?? {}, updates) as SFFSResourceMetadata

    this.log.debug('updating resource metadata', id, fullMetadata)

    await this.sffs.updateResourceMetadata(id, fullMetadata)

    resource.updateMetadata(updates)

    // Emit ResourceManagerEvents.Updated to notify listeners (like NotebookManager)
    this.emit(ResourceManagerEvents.Updated, resource)

    if (
      updates.name &&
      updates.name.trim().length > 0 &&
      updates.name !== NotebookDefaults.NOTE_DEFAULT_NAME &&
      !updates.name.startsWith('Note - ')
    ) {
      await this.unmarkResourceAsEmpty(id)
    }
  }

  async updateResourceTag(resourceId: string, tagName: string, tagValue: string) {
    const resource = await this.getResource(resourceId)
    if (!resource) {
      throw new Error('resource not found')
    }

    this.log.debug('updating resource tags', resourceId, tagName, tagValue)

    await this.sffs.updateResourceTag(resourceId, tagName, tagValue)

    resource.updateTag(tagName, tagValue)
  }

  async createResourceTag(resourceId: string, tagName: string, tagValue: string) {
    const resource = await this.getResource(resourceId)
    if (!resource) {
      throw new Error('resource not found')
    }

    this.log.debug('creating resource tag', resourceId, tagName, tagValue)

    const tag = await this.sffs.createResourceTag(resourceId, tagName, tagValue)
    this.log.warn('created resource tag', tag)

    resource.addTag(tag ? tag : { name: tagName, value: tagValue })
  }

  async deleteResourceTag(resourceId: string, tagName: string) {
    const resource = await this.getResource(resourceId)
    if (!resource) {
      throw new Error('resource not found')
    }

    this.log.debug('deleting resource tag', resourceId, tagName)

    await this.sffs.deleteResourceTag(resourceId, tagName)

    resource.removeTag(tagName)
  }

  async deleteResourceTagByID(resourceId: string, id: string) {
    const resource = await this.getResource(resourceId)
    if (!resource) {
      throw new Error('resource not found')
    }

    this.log.debug('deleting resource tag', resourceId, id)

    await this.sffs.deleteResourceTagByID(id)

    resource.removeTagByID(id)
  }

  async unmarkResourceAsEmpty(resourceId: string) {
    try {
      this.log.debug('Unmarking resource as empty', resourceId)
      await this.deleteResourceTag(resourceId, ResourceTagsBuiltInKeys.EMPTY_RESOURCE)
    } catch (error) {
      this.log.error('failed to unmark resource as empty', resourceId, error)
      // ignore
    }
  }

  async markResourceAsSavedByUser(resourceId: string) {
    await this.deleteResourceTag(resourceId, ResourceTagsBuiltInKeys.SILENT)

    await this.deleteResourceTag(resourceId, ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING)

    await this.deleteResourceTag(resourceId, ResourceTagsBuiltInKeys.CREATED_FOR_CHAT)

    // Note: we update the created timestamp to make sure the date (and order) is what the user expects
    await this.updateResource(resourceId, {
      created_at: new Date().toISOString()
    })
  }

  async preventHiddenResourceFromAutodeletion(resourceOrId: ResourceObject | string) {
    const resource =
      typeof resourceOrId === 'string' ? await this.getResource(resourceOrId) : resourceOrId
    if (!resource) {
      throw new Error('resource not found')
    }

    const isSilent =
      (resource.tags ?? []).find((tag) => tag.name === ResourceTagsBuiltInKeys.SILENT)?.value ===
      'true'
    const isHideInEverything =
      (resource.tags ?? []).find((tag) => tag.name === ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING)
        ?.value === 'true'

    this.log.debug('preventing resource from autodeletion', resource, {
      isSilent,
      isHideInEverything
    })

    if (isSilent) {
      this.log.debug('Removing silent tag from resource')
      await this.deleteResourceTag(resource.id, ResourceTagsBuiltInKeys.SILENT)

      if (!isHideInEverything) {
        this.log.debug('Adding hide in everything tag to resource')
        await this.createResourceTag(
          resource.id,
          ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING,
          'true'
        )
      }
    }
  }

  async createFormattedResourceBlob<T extends ResourceData>(type: string, data: T) {
    if (typeof data === 'string') {
      return new Blob([data], { type })
    }

    if (isMarkdownResourceType(type)) {
      const content = WebParser.getResourceContent(type, data)
      const { content_html, content_plain, ...frontmatter } = data as any
      const blobData = await generateMarkdownWithFrontmatter(
        content.html || content.plain || '',
        frontmatter
      )

      return new Blob([blobData], { type })
    }

    const blobData = JSON.stringify(data)
    return new Blob([blobData], { type })
  }

  /**
   * @param userAction - if true will track event for this created note, should be set whenever
   * user interaction creates the note.
   */
  async createResourceNote(
    content: string,
    metadata?: Partial<SFFSResourceMetadata>,
    tags?: SFFSResourceTag[],
    isUserAction: boolean = false
    /** @deprecated */
    //eventContext?: EventContext,
  ) {
    const defaultMetadata = {
      name: `Note - ${getFormattedDate(Date.now())}`
    }

    const fullMetadata = Object.assign(defaultMetadata, metadata)
    const blob = new Blob([content], {
      type: ResourceTypes.DOCUMENT_SPACE_NOTE
    })

    const isEmptyNote =
      (!content || content.trim().length === 0) &&
      (fullMetadata.name.startsWith('Untitled') || fullMetadata.name.startsWith('Note - '))
    const existingTags = tags ?? []
    if (
      isEmptyNote &&
      !existingTags.find((t) => t.name === ResourceTagsBuiltInKeys.EMPTY_RESOURCE)
    ) {
      tags = [...existingTags, ResourceTag.emptyResource()]
    }

    const resource = await this.createResource(
      ResourceTypes.DOCUMENT_SPACE_NOTE,
      blob,
      fullMetadata,
      tags
    )

    return resource as ResourceNote
  }

  async createResourceLink(
    data: Partial<ResourceDataLink>,
    metadata?: Partial<SFFSResourceMetadata>,
    tags?: SFFSResourceTag[]
  ) {
    const blob = await this.createFormattedResourceBlob(ResourceTypes.LINK, data as ResourceData)

    const additionalTags: SFFSResourceTag[] = []

    const sourcePublishedAt = data.date_published
    if (sourcePublishedAt) {
      additionalTags.push(ResourceTag.sourcePublishedAt(sourcePublishedAt))
    }

    const existingCanoncialUrlTag = tags?.find(
      (t) => t.name === ResourceTagsBuiltInKeys.CANONICAL_URL
    )
    if (!existingCanoncialUrlTag && data.url) {
      additionalTags.push(ResourceTag.canonicalURL(data.url))
    }

    const allTags = [...(tags ?? []), ...additionalTags]

    const fullMetadata = {
      name: data.title,
      sourceURI: data.url,
      ...metadata
    }

    return this.createResource(
      ResourceTypes.LINK,
      blob,
      fullMetadata,
      allTags
    ) as Promise<ResourceLink>
  }

  async createResourceAnnotation(
    data: ResourceDataAnnotation,
    metadata?: Partial<SFFSResourceMetadata>,
    tags?: SFFSResourceTag[]
  ) {
    const blobData = JSON.stringify(data)
    const blob = new Blob([blobData], { type: ResourceTypes.ANNOTATION })
    return this.createResource(
      ResourceTypes.ANNOTATION,
      blob,
      metadata,
      tags
    ) as Promise<ResourceAnnotation>
  }

  async createDetectedResource<T = ResourceData>(
    detectedResource: DetectedResource<T>,
    metadata?: Partial<SFFSResourceMetadata>,
    tags?: SFFSResourceTag[]
  ) {
    const { data, type } = detectedResource

    const blob = await this.createFormattedResourceBlob(type, data as ResourceData)

    const sourcePublishedAt = (data as any).date_published as string | undefined
    const additionalTags =
      sourcePublishedAt &&
      tags?.findIndex((t) => t.name === ResourceTagsBuiltInKeys.SOURCE_PUBLISHED_AT) === -1
        ? [ResourceTag.sourcePublishedAt(sourcePublishedAt)]
        : []
    const allTags = [...(tags ?? []), ...additionalTags]

    return this.createResource(type, blob, metadata, allTags) as Promise<ResourceJSON<T>>
  }

  async createResourceOther(
    blob: Blob,
    metadata?: Partial<SFFSResourceMetadata>,
    tags?: SFFSResourceTag[]
  ) {
    return this.createResource(blob.type, blob, metadata, tags)
  }

  async createCodeResource(
    data: { code: string; language: string; name?: string; url?: string },
    metadata?: Partial<SFFSResourceMetadata>,
    tags?: SFFSResourceTag[]
  ) {
    const { code, language, name, url } = data
    const codeHash = await generateHash(code)
    const type = codeLanguageToMimeType(language)

    this.log.debug('Saving app', type, url, { code })

    const blob = new Blob([code], { type })
    return this.createResource(
      type,
      blob,
      {
        name: name,
        sourceURI: url,
        ...metadata
      },
      [
        ResourceTag.generated(),
        ResourceTag.contentHash(codeHash),
        ...conditionalArrayItem(!!url, ResourceTag.canonicalURL(url!)),
        ...(tags ?? [])
      ]
    )
  }

  async findOrCreateCodeResource(
    data: { code: string; language: string; name?: string; url?: string },
    metadata?: Partial<SFFSResourceMetadata>,
    tags?: SFFSResourceTag[]
  ) {
    const { code, language } = data
    const codeHash = await generateHash(code)
    const type = codeLanguageToMimeType(language)

    this.log.debug('Looking for existing code resource', type, codeHash)
    const resources = await this.listAllResourcesByTags([
      SearchResourceTags.Deleted(false),
      SearchResourceTags.ResourceType(type),
      SearchResourceTags.ContentHash(codeHash),
      SearchResourceTags.SavedWithAction('generated')
    ])

    if (resources.length) {
      this.log.debug('Found existing code resource', resources[0].id)
      return resources[0]
    }

    return this.createCodeResource(data, metadata, tags)
  }

  async searchChatResourcesAI(
    query: string,
    model: Model,
    opts?: {
      customKey?: string
      limit?: number
      resourceIds?: string[]
    }
  ) {
    const rawResources = await this.sffs.searchChatResourcesAI(query, model, opts)
    const resources = rawResources.map((r) => this.findOrCreateResourceObject(r))
    return resources
  }

  async createSpace(name: NotebookData) {
    return await this.sffs.createSpace(name as unknown as SpaceData)
  }

  async getSpace(id: string) {
    return await this.sffs.getSpace(id)
  }

  async listSpaces() {
    const spaces = await this.sffs.listSpaces()

    return spaces // [inboxSpace, everythingSpace, ...spaces] as Space[]
  }

  async updateSpace(spaceId: string, name: NotebookData) {
    return await this.sffs.updateSpace(spaceId, name as unknown as SpaceData)
  }

  async deleteSpace(spaceId: string) {
    return await this.sffs.deleteSpace(spaceId)
  }

  async addItemsToSpace(space_id: string, resourceIds: string[], origin: SpaceEntryOrigin) {
    // TODO: is addItemsToSpace not idempotent? is this check needed?
    const existingItems = await this.getSpaceContents(space_id)
    const newItems = resourceIds.filter(
      (id) =>
        existingItems.findIndex(
          (item) => item.entry_id === id && item.manually_added === origin
        ) === -1
    )

    const res = await this.sffs.addItemsToSpace(space_id, newItems, origin)

    // update the spaceIds of the resources if we have them loaded
    if (origin === SpaceEntryOrigin.ManuallyAdded) {
      for (const [id, resource] of this.resources) {
        if (resourceIds.includes(id)) {
          resource.spaceIds.update((ids) => [...ids, space_id])
        }
      }
    }

    await tick()

    this.emit(ResourceManagerEvents.NotebookAddResources, space_id, resourceIds)
    return res
  }

  async removeItemsFromSpace(space_id: string, resourceIds: string[]) {
    for (const resourceId of resourceIds) {
      const resource = this.resources.get(resourceId)
      if (!resource) continue

      resource.spaceIds.update((v) => {
        return v.filter((e) => e !== space_id)
      })
    }

    await this.sffs.deleteEntriesInSpaceByEntryIds(space_id, resourceIds)

    this.emit(ResourceManagerEvents.NotebookRemoveResources, space_id, resourceIds)
  }

  async getSpaceContents(space_id: string, opts?: SpaceEntrySearchOptions): Promise<SpaceEntry[]> {
    if (!opts?.search_query) {
      return await this.sffs.getSpaceContents(space_id, opts)
    }
    const results = await this.searchResources(
      opts.search_query,
      [
        SearchResourceTags.Deleted(false),
        SearchResourceTags.ResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
        SearchResourceTags.NotExists(ResourceTagsBuiltInKeys.SILENT),
        SearchResourceTags.NotExists(ResourceTagsBuiltInKeys.EMPTY_RESOURCE)
      ],
      {
        spaceId: space_id,
        keywordLimit: opts.limit,
        semanticLimit: opts.limit
      }
    )
    return results.space_entries || []
  }

  async deleteSpaceEntries(entries: SpaceEntry[]) {
    const entry_ids = entries.map((e) => e.id)

    await this.sffs.deleteSpaceEntries(entry_ids)

    // update the spaceIds of the resources if we have them loaded
    entries.map(async (entry) => {
      const resource = this.resources.get(entry.entry_id)
      this.log.debug('deleting space entry', entry, resource)
      if (resource) {
        this.log.debug('updating resource spaceIds', resource.id, resource.spaceIdsValue)
        resource.spaceIds.update((ids) => ids.filter((id) => id !== entry.space_id))
        await tick()
        this.log.debug('updated resource spaceIds', resource.id, resource.spaceIdsValue)
      }
    })
  }

  async deleteSubSpaceEntries(ids: string[]) {
    await this.sffs.deleteSpaceEntries(ids, false)
  }

  async getNumberOfReferencesInSpaces(resourceId: string): Promise<number> {
    const allFolders = await this.sffs.listSpaces()

    let count = 0
    for (const folder of allFolders) {
      const folderContents = await this.sffs.getSpaceContents(folder.id)
      const references = folderContents.filter((content) => content.entry_id === resourceId)

      count += references.length
    }

    return count
  }

  async getAllReferences(
    resourceId: string,
    preFetchedSpaces?: Space[]
  ): Promise<{ folderId: string; resourceId: string; entryId: string }[]> {
    const allFolders = preFetchedSpaces ?? (await this.sffs.listSpaces())

    const references: {
      folderId: string
      resourceId: string
      entryId: string
    }[] = []

    for (const folder of allFolders) {
      const folderContents = await this.sffs.getSpaceContents(folder.id)
      const folderReferences = folderContents
        .filter((content) => content.entry_id === resourceId)
        .map((content) => ({
          folderId: folder.id,
          resourceId: content.entry_id,
          entryId: content.id
        }))

      references.push(...folderReferences)
    }

    return references
  }

  async getResourcesViaPrompt(
    query: string,
    model: Model,
    opts?: {
      customKey?: string
      sqlQuery?: string
      embeddingQuery?: string
      embeddingDistanceThreshold?: number
    }
  ): Promise<AiSFFSQueryResponse> {
    return await this.sffs.getResourcesViaPrompt(query, model, opts)
  }

  async getResourceData(resourceId: string) {
    const resource = await this.getResource(resourceId)
    if (!resource) {
      return null
    }

    if (resource instanceof ResourceJSON) {
      return resource.getParsedData(true)
    } else {
      return resource.getData()
    }
  }

  async refreshResourceData(resourceOrId: ResourceObject | string) {
    const resource =
      typeof resourceOrId === 'string' ? await this.getResource(resourceOrId) : resourceOrId
    if (!resource) {
      throw new Error('resource not found')
    }

    if (!resource.canBeRefreshed.value) {
      this.log.debug('skipping refresh for non-refreshable resource', resource.id)
      return
    }

    if (resource.stateValue === 'extracting') {
      this.log.debug('skipping refresh as resource is already refreshing', resource.id)
      return
    }

    try {
      if (resource.type === ResourceTypes.PDF || resource.type.startsWith('image/')) {
        this.log.debug(
          'refreshing resource by only re-running post processing',
          resource.id,
          resource.type
        )
        await this.sffs.backend.js__store_resource_post_process(resource.id)

        if ((resource.tags ?? []).find((x) => x.name === ResourceTagsBuiltInKeys.DATA_STATE)) {
          await this.updateResourceTag(
            resource.id,
            ResourceTagsBuiltInKeys.DATA_STATE,
            ResourceTagDataStateValue.COMPLETE
          )
        }

        return
      }

      const canonicalUrl = parseStringIntoUrl(
        resource.tags?.find((x) => x.name === ResourceTagsBuiltInKeys.CANONICAL_URL)?.value ||
          resource.metadata?.sourceURI ||
          ''
      )?.href

      if (!canonicalUrl) {
        this.log.debug('skipping refresh as resource has no canonical URL', resource.id)
        return
      }

      this.log.debug('refreshing resource', resource.id, resource.type)

      resource.updateExtractionState('running')

      // TODO: add support for refreshing PDFs, currently not possible without the full BrowserTab logic
      const webParser = new WebParser(canonicalUrl)
      const detectedResource = await webParser.extractResourceUsingWebview(document)

      this.log.debug('extracted resource data', detectedResource)

      if (detectedResource) {
        this.log.debug('updating resource with fresh data', detectedResource.data)
        await this.updateResourceParsedData(resource.id, detectedResource.data)

        if ((detectedResource.data as any)?.title) {
          await this.updateResourceMetadata(resource.id, {
            name: (detectedResource.data as any).title
          })
        }
      }

      if ((resource.tags ?? []).find((x) => x.name === ResourceTagsBuiltInKeys.DATA_STATE)) {
        await this.updateResourceTag(
          resource.id,
          ResourceTagsBuiltInKeys.DATA_STATE,
          ResourceTagDataStateValue.COMPLETE
        )
      }

      resource.updateExtractionState('idle')
    } catch (e) {
      this.log.error('error refreshing resource', e)
      resource.updateExtractionState('idle') // TODO: support error state

      throw e
    }
  }

  static provide(config: ConfigService) {
    const resourceManager = new ResourceManager(config)

    setContext('resourceManager', resourceManager)

    if (!ResourceManager.self) ResourceManager.self = resourceManager

    return resourceManager
  }

  static use() {
    if (!ResourceManager.self) return getContext<ResourceManager>('resourceManager')
    return ResourceManager.self
  }
}

type ResourceSnapshot = {
  timestamp: string
  resources: Array<{
    id: string
    type: string
    name?: string
    sourceURI?: string
  }>
}

class ResourceDebugger {
  private snapshots: ResourceSnapshot[] = []
  private intervalId: number | null = null
  private rm: ResourceManager
  private static STORAGE_KEY = 'resource_debugger_snapshots'
  private static MAX_STORAGE_SIZE = 3 * 1024 * 1024

  constructor(resourceManager: ResourceManager) {
    this.rm = resourceManager
    this.loadFromStorage()
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(ResourceDebugger.STORAGE_KEY)
      if (stored) {
        this.snapshots = JSON.parse(stored)
        console.log(`loaded ${this.snapshots.length} snapshots from storage`)
      }
    } catch (e) {
      console.error('failed to load snapshots from storage:', e)
      this.snapshots = []
    }
  }

  private saveToStorage() {
    try {
      let data = JSON.stringify(this.snapshots)

      while (data.length > ResourceDebugger.MAX_STORAGE_SIZE && this.snapshots.length > 1) {
        this.snapshots.shift()
        data = JSON.stringify(this.snapshots)
      }

      localStorage.setItem(ResourceDebugger.STORAGE_KEY, data)
    } catch (e) {
      console.error('failed to save snapshots to storage:', e)
    }
  }

  private printResource(r: ResourceSnapshot['resources'][0]) {
    return `${r.id} | ${r.type} | ${r.name || '-'} | ${r.sourceURI || '-'}`
  }

  take() {
    const snapshot: ResourceSnapshot = {
      timestamp: new Date().toISOString(),
      resources: Array.from(this.rm.resources.values()).map((r) => ({
        id: r.id,
        type: r.type,
        name: r.metadata?.name,
        sourceURI: r.metadata?.sourceURI
      }))
    }

    this.snapshots.push(snapshot)
    this.saveToStorage()
    return snapshot
  }

  sequentialCompare(startIdx: number) {
    if (startIdx >= this.snapshots.length) {
      console.error('invalid start index')
      return
    }

    console.log('Sequential Comparison Report')
    console.log('===========================')

    let totalMissing = 0
    for (let i = startIdx; i < this.snapshots.length - 1; i++) {
      const { missing } = this.compare(i, i + 1, false)
      if (missing.length > 0) totalMissing += missing.length
    }

    if (totalMissing === 0) {
      console.log('No resources went missing in sequence')
    }
  }

  compare(idx1: number, idx2: number, standalone = true) {
    const s1 = this.snapshots[idx1]
    const s2 = this.snapshots[idx2]

    if (!s1 || !s2) {
      console.error('invalid snapshot indices')
      return { missing: [], added: [] }
    }

    const s1Map = new Map(s1.resources.map((r) => [r.id, r]))
    const s2Map = new Map(s2.resources.map((r) => [r.id, r]))

    const missing = s1.resources.filter((r) => !s2Map.has(r.id))
    const added = s2.resources.filter((r) => !s1Map.has(r.id))

    if (standalone) {
      console.log('Resource Change Report')
      console.log('=====================')
    }

    if (missing.length > 0) {
      console.log(`Snapshot ${idx1} -> ${idx2}`)
      console.log(`${s1.timestamp} -> ${s2.timestamp}`)
      console.log(`Resources: ${s1.resources.length} -> ${s2.resources.length}`)
      console.log('Missing:')
      missing.forEach((r) => console.log(this.printResource(r)))
    }

    return { missing, added }
  }

  compareWithCurrent(idx: number) {
    this.take()
    return this.compare(idx, this.snapshots.length - 1)
  }

  auto(intervalMs: number = 60000) {
    this.stop()
    this.take()
    this.intervalId = window.setInterval(() => this.take(), intervalMs)
  }

  stop() {
    if (this.intervalId) {
      window.clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  list() {
    console.log('Snapshot History')
    console.log('================')
    this.snapshots.forEach((s, i) => {
      console.log(`${i}: ${s.timestamp} (${s.resources.length} resources)`)
    })
  }

  clear() {
    this.snapshots = []
    localStorage.removeItem(ResourceDebugger.STORAGE_KEY)
  }

  save() {
    this.saveToStorage()
  }

  load() {
    this.loadFromStorage()
  }

  getStorageSize() {
    const size = JSON.stringify(this.snapshots).length
    console.log(`Current storage size: ${(size / 1024 / 1024).toFixed(2)}MB`)
    return size
  }
}

export function initResourceDebugger(resourceManager: ResourceManager) {
  const enabled = localStorage.getItem('resource_debugger_enabled') === 'true'
  if (!enabled) return
  if (!window.debug) window.debug = {} as any

  // @ts-ignore
  window.debug.resources = new ResourceDebugger(resourceManager)
  // @ts-ignore
  window.debug.resources.auto(1 * 1000 * 60 * 60)
  // @ts-ignore
  window.debug.help = () => {
    console.log('Resource Debugger Commands')
    console.log('=======================')
    console.log('debug.resources.take()                - Take a snapshot')
    console.log('debug.resources.compare(i,j)          - Compare two snapshots')
    console.log(
      'debug.resources.sequentialCompare(i)  - Compare snapshots sequentially from index i'
    )
    console.log('debug.resources.compareWithCurrent(i) - Compare snapshot with current state')
    console.log('debug.resources.list()                - List all snapshots')
    console.log('debug.resources.clear()               - Clear all snapshots')
  }
}

export function toggleResourceDebugger(resourceManager: ResourceManager) {
  const enabled = localStorage.getItem('resource_debugger_enabled') === 'true'

  if (enabled) {
    // @ts-ignore
    if (window.debug?.resources) {
      // @ts-ignore
      window.debug.resources.stop()
      // @ts-ignore
      window.debug.resources = undefined
    }
    localStorage.setItem('resource_debugger_enabled', 'false')
  } else {
    localStorage.setItem('resource_debugger_enabled', 'true')
    initResourceDebugger(resourceManager)
  }
}

export const createResourceManager = ResourceManager.provide
export const useResourceManager = ResourceManager.use
