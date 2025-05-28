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
  getNormalizedHostname
} from '@horizon/utils'
import { SFFS } from './sffs'
import {
  type AiSFFSQueryResponse,
  type SFFSResourceMetadata,
  type SFFSResourceTag,
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
  type SpaceSource,
  SpaceEntryOrigin,
  type SFFSRawResource,
  type SpaceEntrySearchOptions
} from '../types'
import type { Telemetry } from './telemetry'
import {
  EventBusMessageType,
  EventContext,
  ResourceProcessingStateType,
  ResourceTagDataStateValue,
  TelemetryEventTypes,
  WEB_RESOURCE_TYPES,
  type DetectedResource,
  type EventBusMessage,
  type ResourceData,
  type ResourceDataAnnotation,
  type ResourceDataHistoryEntry,
  type ResourceState,
  type ResourceStateCombined,
  type ResourceTagsBuiltIn
} from '@horizon/types'
import type TypedEmitter from 'typed-emitter'
import { getContext, onDestroy, setContext, tick } from 'svelte'
import EventEmitter from 'events'
import type { Model } from '@horizon/backend/types'
import { WebParser } from '@horizon/web-parser'
import type { ConfigService } from './config'
import type { AIService } from './ai/ai'
import { EventEmitterBase } from './events'

/*
 TODO:
 - move over other card data to SFFSResource
 - handle errors
 - use the relevant enum, and do not hard code the values
*/

export class ResourceTag {
  static download() {
    return { name: ResourceTagsBuiltInKeys.SAVED_WITH_ACTION, value: 'download' }
  }

  static screenshot() {
    return { name: ResourceTagsBuiltInKeys.SAVED_WITH_ACTION, value: 'screenshot' }
  }

  static dragBrowser() {
    return { name: ResourceTagsBuiltInKeys.SAVED_WITH_ACTION, value: 'drag/browser' }
  }

  static dragLocal() {
    return { name: ResourceTagsBuiltInKeys.SAVED_WITH_ACTION, value: 'drag/local' }
  }

  static paste() {
    return { name: ResourceTagsBuiltInKeys.SAVED_WITH_ACTION, value: 'paste' }
  }

  static import() {
    return { name: ResourceTagsBuiltInKeys.SAVED_WITH_ACTION, value: 'import' }
  }

  static generated() {
    return { name: ResourceTagsBuiltInKeys.SAVED_WITH_ACTION, value: 'generated' }
  }

  static chat() {
    return { name: ResourceTagsBuiltInKeys.SAVED_WITH_ACTION, value: 'chat' }
  }

  static rightClickSave() {
    return { name: ResourceTagsBuiltInKeys.SAVED_WITH_ACTION, value: 'page-right-click' }
  }

  static canonicalURL(url: string) {
    return { name: ResourceTagsBuiltInKeys.CANONICAL_URL, value: url }
  }

  static silent(value: boolean = true) {
    return { name: ResourceTagsBuiltInKeys.SILENT, value: `${value}` }
  }

  static annotates(resourceID: string) {
    return { name: ResourceTagsBuiltInKeys.ANNOTATES, value: resourceID }
  }

  static hashtag(tag: string) {
    return { name: ResourceTagsBuiltInKeys.HASHTAG, value: tag }
  }

  static spaceSource(value: SpaceSource['type']) {
    return { name: ResourceTagsBuiltInKeys.SPACE_SOURCE, value: value }
  }

  static viewedByUser(value: boolean) {
    return { name: ResourceTagsBuiltInKeys.VIEWED_BY_USER, value: `${value}` }
  }

  static hideInEverything(value: boolean = true) {
    return { name: ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING, value: `${value}` }
  }

  static sourcePublishedAt(value: string) {
    return { name: ResourceTagsBuiltInKeys.SOURCE_PUBLISHED_AT, value: value }
  }

  static createdForChat(value: boolean = true) {
    return { name: ResourceTagsBuiltInKeys.CREATED_FOR_CHAT, value: `${value}` }
  }

  static contentHash(value: string) {
    return { name: ResourceTagsBuiltInKeys.CONTENT_HASH, value: value }
  }

  static previewImageResource(previewId: string) {
    return { name: ResourceTagsBuiltInKeys.PREVIEW_IMAGE_RESOURCE, value: previewId }
  }

  static linkedChat(value: string) {
    return { name: ResourceTagsBuiltInKeys.LINKED_CHAT, value: value }
  }

  static dataState(value: ResourceTagDataStateValue) {
    return { name: ResourceTagsBuiltInKeys.DATA_STATE, value: value }
  }
}

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

export type ResourceManagerEvents = {
  created: (resource: ResourceObject) => void
  deleted: (resourceId: string) => void
  updated: (resource: ResourceObject) => void
  recovered: (resourceId: string) => void
}

export type ResourceEvents = {
  'updated-metadata': (metadata: SFFSResourceMetadata) => void
  'updated-tags': (tags: SFFSResourceTag[]) => void
  'updated-data': (data: Blob) => void
}

export class Resource extends EventEmitterBase<ResourceEvents> {
  id: string
  type: string
  path: string
  createdAt: string
  updatedAt: string
  deleted: boolean
  dummy: boolean

  metadata?: SFFSResourceMetadata
  tags?: SFFSResourceTag[]
  annotations?: ResourceAnnotation[]

  rawData: Blob | null
  readDataPromise: Promise<Blob> | null // used to avoid duplicate reads
  dataUsed: number // number of times the data is being used

  spaceIds: Writable<string[]>
  extractionState: Writable<ResourceState>
  postProcessingState: Writable<ResourceState>
  state: Readable<ResourceStateCombined>

  sffs: SFFS
  resourceManager: ResourceManager
  log: ScopedLogger

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

  private async readDataAsBlob() {
    const buffer = await this.sffs.readDataFile(this.id)

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

    await this.sffs.writeDataFile(this.id, this.rawData)
  }

  updateData(data: Blob, write = true) {
    this.log.debug('updating resource data with', data)

    this.rawData = data
    this.updatedAt = new Date().toISOString()

    this.emit('updated-data', data)
    this.resourceManager.emit('updated', this)
    if (write) {
      return this.writeData()
    } else {
      return Promise.resolve()
    }
  }

  updateMetadata(updates: Partial<SFFSResourceMetadata>) {
    this.log.debug('updating resource metadata with', updates)

    this.metadata = { ...(this.metadata ?? {}), ...updates } as SFFSResourceMetadata
    this.updatedAt = new Date().toISOString()
    this.emit('updated-metadata', this.metadata)
  }

  updateTags(updates: SFFSResourceTag[]) {
    this.log.debug('updating resource tags with', updates)

    this.tags = [...(this.tags ?? []), ...updates]
    this.updatedAt = new Date().toISOString()
    this.emit('updated-tags', this.tags ?? [])
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
    this.emit('updated-tags', this.tags ?? [])
  }

  addTag(tag: SFFSResourceTag) {
    this.log.debug('adding resource tag', tag)

    this.tags = [...(this.tags ?? []), tag]
    this.updatedAt = new Date().toISOString()
    this.emit('updated-tags', this.tags ?? [])
  }

  removeTag(name: string) {
    this.log.debug('removing resource tag', name)

    this.tags = this.tags?.filter((t) => t.name !== name)
    this.updatedAt = new Date().toISOString()
    this.emit('updated-tags', this.tags ?? [])
  }

  removeTagByID(id: string) {
    this.log.debug('removing resource tag by id', id)

    this.tags = this.tags?.filter((t) => t?.id !== id)
    this.updatedAt = new Date().toISOString()
    this.emit('updated-tags', this.tags ?? [])
  }

  getData() {
    this.dataUsed += 1

    if (this.rawData) {
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

    const data = await this.getData()
    const text = await data.text()

    this.parsedData.set(text)
    return this.parsedData
  }

  async updateContent(content: string) {
    this.parsedData.set(content)
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
    const parsed = JSON.parse(text) as T

    this.parsedData = parsed
    return parsed
  }

  async updateParsedData(data: T) {
    const blobData = JSON.stringify(data)
    const blob = new Blob([blobData], { type: this.type })

    this.parsedData = data

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

export class ResourceManager extends EventEmitterBase<ResourceManagerEvents> {
  resources: Writable<ResourceObject[]>

  log: ScopedLogger
  sffs: SFFS
  telemetry: Telemetry
  config: ConfigService
  ai!: AIService

  static self: ResourceManager

  constructor(telemetry: Telemetry, config: ConfigService) {
    super()
    this.log = useLogScope('SFFSResourceManager')
    this.resources = writable([])
    this.sffs = new SFFS()
    this.telemetry = telemetry
    this.config = config

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

  attachAIService(ai: AIService) {
    this.ai = ai
  }

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
    const existingResource = get(this.resources).find((r) => r.id === resource.id)
    if (existingResource) {
      return existingResource
    }

    let res = this.createResourceObject(resource)
    this.emit('created', res)
    return res
  }

  private findOrGetResourceObject(id: string, opts: { includeAnnotations?: boolean } = {}) {
    const existingResource = get(this.resources).find((r) => r.id === id)
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

    const resource = get(this.resources).find((r) => r.id === id)
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

    this.resources.update((resources) => resources.map((r) => (r.id === id ? resource : r)))
  }

  static NonHiddenDefaultTags(): SFFSResourceTag[] {
    return [
      ResourceManager.SearchTagDeleted(false),
      ResourceManager.SearchTagResourceType(ResourceTypes.ANNOTATION, 'ne'),
      ResourceManager.SearchTagResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
      ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING),
      ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.SILENT)
    ]
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

    this.resources.update((resources) => [...resources, resource])

    this.emit('created', resource)
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
    const typeSupportsCleanup =
      !WEB_RESOURCE_TYPES.some((x) => type.startsWith(x)) &&
      type !== ResourceTypes.PDF &&
      type !== ResourceTypes.DOCUMENT_SPACE_NOTE
    if (typeSupportsCleanup && this.config.settingsValue.cleanup_filenames) {
      const filename = metadata?.name
      if (filename) {
        const context = canonicalUrlTag?.value || metadata?.sourceURI || ''
        this.log.debug('cleaning up filename', filename, context)
        const completion = await this.ai.cleanupTitle(filename, context)
        if (!completion.error && completion.output) {
          this.log.debug('cleaned up filename', filename, completion.output)
          parsedMetadata.name = completion.output
        }
      }
    }

    const sffsItem = await this.sffs.createResource(type, parsedMetadata, tags)
    const resource = this.createResourceObject(sffsItem)

    this.log.debug('created resource', resource)
    this.resources.update((resources) => [...resources, resource])

    // store the data in the resource and write it to sffs
    if (data) {
      resource.rawData = data
      await resource.writeData()
    }

    const isSilent = tags?.find((t) => t.name === ResourceTagsBuiltInKeys.SILENT)?.value === 'true'
    const isFromSpace = !!tags?.find((t) => t.name === ResourceTagsBuiltInKeys.SPACE_SOURCE)?.value

    // TODO: should we also track auto saved resources?
    // if (!isSilent && !isFromSpace) {
    //   this.telemetry.trackEvent(TelemetryEventTypes.CreateResource, {
    //     kind: getPrimaryResourceType(type),
    //     type: type,
    //     savedWithAction: tags?.find((t) => t.name === ResourceTagsBuiltInKeys.SAVED_WITH_ACTION)
    //       ?.value
    //   })
    // }

    this.emit('created', resource)
    return resource
  }

  async readResources() {
    const resourceItems = await this.sffs.readResources()
    const resources = resourceItems.map((item) => new Resource(this.sffs, this, item))
    this.resources.set(resources)
  }

  async listResourceIDsByTags(tags: SFFSResourceTag[], excludeWithinSpaces: boolean = false) {
    const results = await this.sffs.listResourceIDsByTags(tags, excludeWithinSpaces)
    return results
  }

  async listResourcesByTags(
    tags: SFFSResourceTag[],
    opts: { includeAnnotations?: boolean; excludeWithinSpaces?: boolean } = {}
  ) {
    const resourceIds = await this.sffs.listResourceIDsByTags(
      tags,
      opts?.excludeWithinSpaces ?? false
    )
    this.log.debug('found resource ids', resourceIds)
    return (await Promise.all(
      resourceIds.map((id) => this.findOrGetResourceObject(id, opts))
    )) as Resource[]
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
  ) {
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

  // async searchForNearbyResources(resourceId: string, parameters?: SFFSSearchProximityParameters) {
  //   const rawResults = await this.sffs.searchForNearbyResources(resourceId, parameters)
  //   const results = rawResults.map(
  //     (item) =>
  //       ({
  //         id: item.resource.id,
  //         engine: item.engine,
  //         cardIds: item.card_ids,
  //         resource: this.findOrCreateResourceObject(item.resource)
  //       }) as ResourceSearchResultItem
  //   )

  //   return results
  // }

  async getResourceAnnotations() {
    const resources = await this.listResourcesByTags([
      ResourceManager.SearchTagResourceType(ResourceTypes.ANNOTATION),
      ResourceManager.SearchTagDeleted(false)
    ])

    return resources as ResourceAnnotation[]
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

    const resources = await this.listResourcesByTags([
      ResourceManager.SearchTagCanonicalURL(canonicalURL),
      ResourceManager.SearchTagDeleted(false),
      ...(tags ?? [])
    ])

    // if the canonical URL is different, we should also search for the original URL
    if (canonicalURL !== url) {
      const additionalResources = await this.listResourcesByTags([
        ResourceManager.SearchTagCanonicalURL(url),
        ResourceManager.SearchTagDeleted(false),
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

    const resources = await this.listResourcesByTags([
      ResourceManager.SearchTagCanonicalURL(prefixedHostname, 'prefix'),
      ResourceManager.SearchTagDeleted(false),
      ...(tags ?? [])
    ])

    return resources
  }

  async getAnnotationsForResource(id: string) {
    const resources = await this.listResourcesByTags([
      ResourceManager.SearchTagResourceType(ResourceTypes.ANNOTATION),
      ResourceManager.SearchTagAnnotates(id),
      ResourceManager.SearchTagDeleted(false)
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
    const loadedResources = get(this.resources)
    const loadedResource = loadedResources.find((r) => r.id === id)
    if (loadedResource) {
      return loadedResource
    }

    // read resource from sffs
    const resourceItem = await this.sffs.readResource(id, { includeAnnotations: true })
    if (!resourceItem) {
      return null
    }

    const resource = this.findOrCreateResourceObject(resourceItem)

    this.resources.update((resources) => {
      const index = resources.findIndex((r) => r.id === id)
      if (index > -1) {
        resources[index] = resource
      } else {
        resources.push(resource)
      }

      return resources
    })

    // const annotations = (resourceItem.annotations ?? []).map((a) =>
    //   this.findOrCreateResourceObject(a)
    // ) as ResourceAnnotation[]

    return resource
  }

  async getHistoryEntries() {
    return this.sffs.getHistoryEntries()
  }

  async findHistoryEntriesByHostname(url: string) {
    const result = await this.sffs.searchHistoryEntriesByHostname(url)
    return result
  }

  addAnnotationToLoadedResource(resourceId: string, annotation: ResourceAnnotation) {
    const loadedResources = get(this.resources)
    const loadedResource = loadedResources.find((r) => r.id === resourceId)
    if (loadedResource) {
      this.log.debug('adding annotation to loaded resource', resourceId, annotation)
      loadedResource.annotations = [...(loadedResource.annotations ?? []), annotation]
    } else {
      this.log.debug('resource not loaded, skipping adding annotation', resourceId)
    }
  }

  async getResource(id: string, opts: { includeAnnotations?: boolean } = {}) {
    // check if resource is already loaded
    const loadedResources = get(this.resources)
    const loadedResource = loadedResources.find((r) => r.id === id)
    if (loadedResource) {
      return loadedResource
    }

    // read resource from sffs
    const resourceItem = await this.sffs.readResource(id, opts)
    if (!resourceItem) {
      return null
    }

    const resource = this.findOrCreateResourceObject(resourceItem)

    this.resources.update((resources) => {
      const index = resources.findIndex((r) => r.id === id)
      if (index > -1) {
        resources[index] = resource
      } else {
        resources.push(resource)
      }

      return resources
    })

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
      // this.telemetry.trackEvent(TelemetryEventTypes.DeleteResource, { type: resource.type })
    }

    this.resources.update((resources) => resources.filter((r) => r.id !== id))
    this.emit('deleted', id)
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
    this.resources.update((resources) => resources.filter((r) => !ids.includes(r.id)))

    ids.forEach((id) => {
      this.emit('deleted', id)
    })
  }

  async deleteHistoryEntry(id: string) {
    await this.sffs.deleteHistoryEntry(id)
  }

  // returns only a list of hostnames
  async searchHistoryEntriesByHostnamePrefix(prefix: string, since?: Date) {
    return this.sffs.searchHistoryEntriesByHostnamePrefix(prefix, since)
  }

  async searchHistoryEntriesByUrlAndTitle(query: string, since?: Date) {
    return this.sffs.searchHistoryEntriesByUrlAndTitle(query, since)
  }

  async reloadResource(id: string) {
    const resourceItem = await this.sffs.readResource(id)
    if (!resourceItem) {
      return null
    }
    const resource = this.createResourceObject(resourceItem)

    this.resources.update((resources) => {
      const index = resources.findIndex((r) => r.id === id)
      if (index > -1) {
        resources[index] = resource
      } else {
        resources.push(resource)
      }

      return resources
    })

    this.emit('updated', resource)
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
    this.resources.update((resources) => resources.map((r) => (r.id === id ? resource : r)))
  }

  async updateResourceTag(resourceId: string, tagName: string, tagValue: string) {
    const resource = await this.getResource(resourceId)
    if (!resource) {
      throw new Error('resource not found')
    }

    this.log.debug('updating resource tags', resourceId, tagName, tagValue)

    await this.sffs.updateResourceTag(resourceId, tagName, tagValue)

    resource.updateTag(tagName, tagValue)
    this.resources.update((resources) => resources.map((r) => (r.id === resourceId ? resource : r)))
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
    this.resources.update((resources) => resources.map((r) => (r.id === resourceId ? resource : r)))
  }

  async deleteResourceTag(resourceId: string, tagName: string) {
    const resource = await this.getResource(resourceId)
    if (!resource) {
      throw new Error('resource not found')
    }

    this.log.debug('deleting resource tag', resourceId, tagName)

    await this.sffs.deleteResourceTag(resourceId, tagName)

    resource.removeTag(tagName)
    this.resources.update((resources) => resources.map((r) => (r.id === resourceId ? resource : r)))
  }

  async deleteResourceTagByID(resourceId: string, id: string) {
    const resource = await this.getResource(resourceId)
    if (!resource) {
      throw new Error('resource not found')
    }

    this.log.debug('deleting resource tag', resourceId, id)

    await this.sffs.deleteResourceTagByID(id)

    resource.removeTagByID(id)
    this.resources.update((resources) => resources.map((r) => (r.id === resourceId ? resource : r)))
  }

  async markResourceAsSavedByUser(resourceId: string) {
    await this.deleteResourceTag(resourceId, ResourceTagsBuiltInKeys.SILENT)

    await this.deleteResourceTag(resourceId, ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING)

    await this.deleteResourceTag(resourceId, ResourceTagsBuiltInKeys.CREATED_FOR_CHAT)

    // Note: we update the created timestamp to make sure the date (and order) is what the user expects
    await this.updateResource(resourceId, { created_at: new Date().toISOString() })
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

  async createResourceNote(
    content: string,
    metadata?: Partial<SFFSResourceMetadata>,
    tags?: SFFSResourceTag[],
    eventContext?: EventContext
  ) {
    const defaultMetadata = {
      name: `Note - ${getFormattedDate(Date.now())}`
    }

    const fullMetadata = Object.assign(defaultMetadata, metadata)
    const blob = new Blob([content], { type: ResourceTypes.DOCUMENT_SPACE_NOTE })
    const resource = await this.createResource(
      ResourceTypes.DOCUMENT_SPACE_NOTE,
      blob,
      fullMetadata,
      tags
    )

    if (eventContext) {
      this.telemetry.trackCreateNote(eventContext)
    }

    return resource as ResourceNote
  }

  async createResourceLink(
    data: Partial<ResourceDataLink>,
    metadata?: Partial<SFFSResourceMetadata>,
    tags?: SFFSResourceTag[]
  ) {
    const blobData = JSON.stringify(data)
    const blob = new Blob([blobData], { type: ResourceTypes.LINK })

    const additionalTags = []

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

  async createDetectedResource<T>(
    detectedResource: DetectedResource<T>,
    metadata?: Partial<SFFSResourceMetadata>,
    tags?: SFFSResourceTag[]
  ) {
    const { data, type } = detectedResource

    const blobData = typeof data === 'string' ? data : JSON.stringify(data)
    const blob = new Blob([blobData], { type: type })

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
    const resources = await this.listResourcesByTags([
      ResourceManager.SearchTagDeleted(false),
      ResourceManager.SearchTagResourceType(type),
      ResourceManager.SearchTagContentHash(codeHash),
      ResourceManager.SearchTagSavedWithAction('generated')
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

  static SearchTagResourceType(
    type: ResourceTypes | string,
    op: SFFSResourceTag['op'] = 'eq'
  ): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.TYPE, value: type, op: op }
  }

  static SearchTagSavedWithAction(
    action: ResourceTagsBuiltIn['savedWithAction'],
    prefix = false
  ): SFFSResourceTag {
    return {
      name: ResourceTagsBuiltInKeys.SAVED_WITH_ACTION,
      value: action,
      op: prefix ? 'prefix' : 'eq'
    }
  }

  static SearchTagDeleted(value = true): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.DELETED, value: `${value}`, op: 'eq' }
  }

  static SearchTagHorizon(horizonId: string): SFFSResourceTag {
    return { name: 'horizonId', value: horizonId, op: 'eq' }
  }

  static SearchTagHostname(hostname: string): SFFSResourceTag {
    return { name: 'horizonId', value: hostname, op: 'suffix' }
  }

  static SearchTagHashtag(tag: string): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.HASHTAG, value: tag, op: 'eq' }
  }

  static SearchTagLinkedChat(chatId: string): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.LINKED_CHAT, value: chatId, op: 'eq' }
  }

  async createSpace(name: SpaceData) {
    return await this.sffs.createSpace(name)
  }

  async getSpace(id: string) {
    return await this.sffs.getSpace(id)
  }

  async listSpaces() {
    const spaces = await this.sffs.listSpaces()

    return spaces // [inboxSpace, everythingSpace, ...spaces] as Space[]
  }

  async updateSpace(spaceId: string, name: SpaceData) {
    return await this.sffs.updateSpace(spaceId, name)
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
      const loadedResources = get(this.resources)
      loadedResources.map((r) => {
        if (resourceIds.includes(r.id)) {
          r.spaceIds.update((ids) => [...ids, space_id])
        }

        return r
      })
    }

    return res
  }

  async getSpaceContents(space_id: string, opts?: SpaceEntrySearchOptions): Promise<SpaceEntry[]> {
    if (!opts?.search_query) {
      return await this.sffs.getSpaceContents(space_id, opts)
    }
    const results = await this.searchResources(
      opts.search_query,
      [
        ResourceManager.SearchTagDeleted(false),
        ResourceManager.SearchTagResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
        ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.SILENT)
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
    const loadedResources = get(this.resources)
    entries.map(async (entry) => {
      const resource = loadedResources.find((r) => r.id === entry.entry_id)
      this.log.debug('deleting space entry', entry, resource)
      if (resource) {
        this.log.debug('updating resource spaceIds', resource.id, resource.spaceIdsValue)
        resource.spaceIds.update((ids) => ids.filter((id) => id !== entry.space_id))
        await tick()
        this.log.debug('updated resource spaceIds', resource.id, resource.spaceIdsValue)
      }
    })

    // trigger reactivity upadte
    this.resources.update((resources) => resources)
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

    const references: { folderId: string; resourceId: string; entryId: string }[] = []

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

    const canBeRefreshed = WEB_RESOURCE_TYPES.some((x) => resource.type.startsWith(x))
    const canBeReprocessed =
      resource.type === ResourceTypes.PDF || resource.type.startsWith('image/')

    if (!canBeRefreshed && !canBeReprocessed) {
      this.log.debug('skipping refresh for non-refreshable resource', resource.id)
      return
    }

    if (resource.stateValue === 'extracting') {
      this.log.debug('skipping refresh as resource is already refreshing', resource.id)
      return
    }

    try {
      if (canBeReprocessed) {
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

  static SearchTagCanonicalURL(url: string, op: SFFSResourceTag['op'] = 'eq'): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.CANONICAL_URL, value: url, op }
  }

  static SearchTagAnnotates(resourceId: string): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.ANNOTATES, value: resourceId, op: 'eq' }
  }

  static SearchTagSpaceSource(
    value: SpaceSource['type'],
    op: SFFSResourceTag['op'] = 'eq'
  ): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.SPACE_SOURCE, value: value, op: op }
  }

  static SearchTagNotExists(name: string): SFFSResourceTag {
    return { name: name, value: '', op: 'notexists' }
  }

  static SearchTagViewedByUser(value: boolean): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.VIEWED_BY_USER, value: `${value}`, op: 'eq' }
  }

  static SearchTagSilent(value: boolean = true): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.SILENT, value: `${value}`, op: 'eq' }
  }

  static SearchTagHideInEverything(value: boolean = true): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING, value: `${value}`, op: 'eq' }
  }

  static SearchTagCreatedForChat(value: boolean = true): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.CREATED_FOR_CHAT, value: `${value}`, op: 'eq' }
  }

  static SearchTagContentHash(hash: string): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.CONTENT_HASH, value: hash, op: 'eq' }
  }

  static SearchTagPreviewImageResource(id: string): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.PREVIEW_IMAGE_RESOURCE, value: id, op: 'eq' }
  }

  static SearchTagDataState(state: ResourceTagDataStateValue) {
    return { name: ResourceTagsBuiltInKeys.DATA_STATE, value: state, op: 'eq' }
  }

  static provide(telemetry: Telemetry, config: ConfigService) {
    const resourceManager = new ResourceManager(telemetry, config)

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
      resources: get(this.rm.resources).map((r) => ({
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
