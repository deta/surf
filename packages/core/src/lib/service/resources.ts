import { derived, get, writable, type Readable, type Writable } from 'svelte/store'

import {
  useLogScope,
  type ScopedLogger,
  generateID,
  getFormattedDate,
  parseUrlIntoCanonical,
  isDev,
  parseStringIntoUrl
} from '@horizon/utils'
import { SFFS } from './sffs'
import {
  type AiSFFSQueryResponse,
  type CreateSpaceEntryInput,
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
  type ResourceTagsBuiltIn,
  type ResourceDataDocument,
  type SFFSSearchParameters,
  type SFFSSearchProximityParameters,
  type SpaceEntry,
  type Space,
  type SpaceData,
  type SpaceSource,
  SpaceEntryOrigin,
  type SFFSRawResource
} from '../types'
import type { Telemetry } from './telemetry'
import {
  EventBusMessageType,
  ResourceProcessingStateType,
  TelemetryEventTypes,
  type DetectedResource,
  type EventBusMessage,
  type ResourceData,
  type ResourceDataAnnotation,
  type ResourceDataHistoryEntry,
  type ResourceState,
  type ResourceStateCombined
} from '@horizon/types'
import type TypedEmitter from 'typed-emitter'
import { getContext, onDestroy, setContext, tick } from 'svelte'
import EventEmitter from 'events'
import type { Model } from '@horizon/backend/types'
import { WebParser } from '@horizon/web-parser'

/*
 TODO:
 - move over other card data to SFFSResource
 - handle errors
 - use the relevant enum, and do not hard code the values
*/

export const everythingSpace = {
  id: 'all',
  name: {
    folderName: 'All my Stuff',
    colors: ['#76E0FF', '#4EC9FB'],
    showInSidebar: false,
    liveModeEnabled: false,
    hideViewed: false,
    smartFilterQuery: null,
    sql_query: null,
    embedding_query: null,
    sortBy: 'created_at'
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted: 0,
  type: 'space'
} as Space

export const inboxSpace = {
  id: 'inbox',
  name: {
    folderName: 'Inbox',
    colors: ['#76E0FF', '#4EC9FB'],
    showInSidebar: false,
    liveModeEnabled: false,
    hideViewed: false,
    smartFilterQuery: null,
    sql_query: null,
    embedding_query: null,
    sortBy: 'created_at'
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted: 0,
  type: 'space'
} as Space

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

export type ResourceEvents = {
  created: (resource: ResourceObject) => void
  deleted: (resourceId: string) => void
  updated: (resource: ResourceObject) => void
  recovered: (resourceId: string) => void
}

export class Resource {
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

  extractionState: Writable<ResourceState>
  postProcessingState: Writable<ResourceState>
  state: Readable<ResourceStateCombined>

  sffs: SFFS
  resourceManager: ResourceManager
  log: ScopedLogger

  constructor(sffs: SFFS, resourceManager: ResourceManager, data: SFFSResource) {
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

    this.state.subscribe((state) => {
      this.log.debug('state changed', state, this)
    })
  }

  get stateValue() {
    return get(this.state)
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

    this.resourceManager.eventEmitter.emit('updated', this)
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
  }

  updateTags(updates: SFFSResourceTag[]) {
    this.log.debug('updating resource tags with', updates)

    this.tags = [...(this.tags ?? []), ...updates]
    this.updatedAt = new Date().toISOString()
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
  }

  addTag(tag: SFFSResourceTag) {
    this.log.debug('adding resource tag', tag)

    this.tags = [...(this.tags ?? []), tag]
    this.updatedAt = new Date().toISOString()
  }

  removeTag(name: string) {
    this.log.debug('removing resource tag', name)

    this.tags = this.tags?.filter((t) => t.name !== name)
    this.updatedAt = new Date().toISOString()
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
}

// TODO: adapt to new resource data
export class ResourceNote extends Resource {
  // data: Writable<SFFSResourceDataNote | null>

  parsedData: Writable<string | null>

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
  cardIds: string[]
  engine: SFFSSearchResultEngine
}

export class ResourceManager {
  resources: Writable<ResourceObject[]>

  log: ScopedLogger
  sffs: SFFS
  telemetry: Telemetry

  private eventEmitter: TypedEmitter<ResourceEvents>

  constructor(telemetry: Telemetry) {
    this.log = useLogScope('SFFSResourceManager')
    this.resources = writable([])
    this.sffs = new SFFS()
    this.telemetry = telemetry

    this.eventEmitter = new EventEmitter() as TypedEmitter<ResourceEvents>

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

  on<E extends keyof ResourceEvents>(event: E, listener: ResourceEvents[E]): () => void {
    this.eventEmitter.on(event, listener)

    return () => {
      this.eventEmitter.off(event, listener)
    }
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
    this.eventEmitter.emit('created', res)
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
    this.log.debug('received event bus message', event)

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

    this.eventEmitter.emit('created', resource)
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

    this.eventEmitter.emit('created', resource)
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

  async searchResources(
    query: string,
    tags?: SFFSResourceTag[],
    parameters?: SFFSSearchParameters
  ) {
    const rawResults = await this.sffs.searchResources(query, tags, parameters)
    const results = rawResults.map(
      (item) =>
        ({
          id: item.resource.id,
          engine: item.engine,
          cardIds: item.card_ids,
          resource: this.findOrCreateResourceObject(item.resource),
          annotations: item.resource.annotations?.map((a) => this.findOrCreateResourceObject(a))
        }) as ResourceSearchResultItem
    )

    // we probably don't want to overwrite the existing resources
    // this.resources.set(resources)

    return results
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
    const rawResults = await this.listResourcesByTags([
      ResourceManager.SearchTagResourceType(ResourceTypes.ANNOTATION),
      ResourceManager.SearchTagDeleted(false)
    ])

    return rawResults.map((item) => this.findOrCreateResourceObject(item)) as ResourceAnnotation[]
  }

  async getResourcesFromSourceURL(url: string) {
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
      ResourceManager.SearchTagDeleted(false)
    ])

    // if the canonical URL is different, we should also search for the original URL
    if (canonicalURL !== url) {
      const additionalResources = await this.listResourcesByTags([
        ResourceManager.SearchTagCanonicalURL(url),
        ResourceManager.SearchTagDeleted(false)
      ])

      resources.push(...additionalResources)
    }

    return resources
  }

  async getAnnotationsForResource(id: string) {
    const rawResults = await this.listResourcesByTags([
      ResourceManager.SearchTagResourceType(ResourceTypes.ANNOTATION),
      ResourceManager.SearchTagAnnotates(id),
      ResourceManager.SearchTagDeleted(false)
    ])

    return rawResults.map((item) => this.findOrCreateResourceObject(item)) as ResourceAnnotation[]
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
      // delete resource from sffs
      await this.sffs.deleteResource(id)
      // better to handle in user land
      // this.telemetry.trackEvent(TelemetryEventTypes.DeleteResource, { type: resource.type })
    }

    this.resources.update((resources) => resources.filter((r) => r.id !== id))
    this.eventEmitter.emit('deleted', id)
  }

  async deleteResources(ids: string[]) {
    if (!ids.length) return

    await this.sffs.deleteResources(ids)
    this.resources.update((resources) => resources.filter((r) => !ids.includes(r.id)))

    ids.forEach((id) => {
      this.eventEmitter.emit('deleted', id)
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

    this.eventEmitter.emit('updated', resource)
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

    await this.sffs.createResourceTag(resourceId, tagName, tagValue)

    resource.addTag({ name: tagName, value: tagValue })
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

  async markResourceAsSavedByUser(resourceId: string) {
    await this.deleteResourceTag(resourceId, ResourceTagsBuiltInKeys.SILENT)

    await this.deleteResourceTag(resourceId, ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING)

    await this.deleteResourceTag(resourceId, ResourceTagsBuiltInKeys.CREATED_FOR_CHAT)

    // Note: we update the created timestamp to make sure the date (and order) is what the user expects
    await this.updateResource(resourceId, { created_at: new Date().toISOString() })
  }

  async createResourceNote(
    content: string,
    metadata?: Partial<SFFSResourceMetadata>,
    tags?: SFFSResourceTag[]
  ) {
    const defaultMetadata = {
      name: `Untitled ${getFormattedDate(Date.now())}`
    }

    const fullMetadata = Object.assign(defaultMetadata, metadata)
    const blob = new Blob([content], { type: ResourceTypes.DOCUMENT_SPACE_NOTE })
    return this.createResource(
      ResourceTypes.DOCUMENT_SPACE_NOTE,
      blob,
      fullMetadata,
      tags
    ) as Promise<ResourceNote>
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

    return this.createResource(ResourceTypes.LINK, blob, metadata, allTags) as Promise<ResourceLink>
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

  static SearchTagResourceType(
    type: ResourceTypes | string,
    op: SFFSResourceTag['op'] = 'eq'
  ): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.TYPE, value: type, op: op }
  }

  static SearchTagSavedWithAction(action: string, prefix = false): SFFSResourceTag {
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

  async createSpace(name: SpaceData) {
    return await this.sffs.createSpace(name)
  }

  async getSpace(id: string) {
    if (id === 'all') {
      return everythingSpace
    }

    if (id === 'inbox') {
      return inboxSpace
    }

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
    const existingItems = await this.getSpaceContents(space_id)
    const newItems = resourceIds.filter(
      (id) =>
        existingItems.findIndex(
          (item) => item.resource_id === id && item.manually_added === origin
        ) === -1
    )
    return await this.sffs.addItemsToSpace(space_id, newItems, origin)
  }

  async getSpaceContents(space_id: string): Promise<SpaceEntry[]> {
    return await this.sffs.getSpaceContents(space_id)
  }

  async deleteSpaceEntries(entry_ids: string[]) {
    return await this.sffs.deleteSpaceEntries(entry_ids)
  }

  async getNumberOfReferencesInSpaces(resourceId: string): Promise<number> {
    const allFolders = await this.sffs.listSpaces()

    let count = 0
    for (const folder of allFolders) {
      const folderContents = await this.sffs.getSpaceContents(folder.id)
      const references = folderContents.filter((content) => content.resource_id === resourceId)

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
        .filter((content) => content.resource_id === resourceId)
        .map((content) => ({
          folderId: folder.id,
          resourceId: content.resource_id,
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

    const canBeRefreshed =
      (Object.values(ResourceTypes) as string[]).includes(resource.type) ||
      resource.type === 'application/pdf'
    const canonicalUrl = parseStringIntoUrl(
      resource.tags?.find((x) => x.name === ResourceTagsBuiltInKeys.CANONICAL_URL)?.value ||
        resource.metadata?.sourceURI ||
        ''
    )?.href

    if (!canBeRefreshed || !canonicalUrl) {
      this.log.debug('skipping refresh for non-refreshable resource', resource.id)
      return
    }

    if (resource.stateValue === 'extracting') {
      this.log.debug('skipping refresh as resource is already refreshing', resource.id)
      return
    }

    try {
      if (resource.type === 'application/pdf') {
        this.log.debug('refreshing PDF resource by only re-running post processing', resource.id)
        await this.sffs.backend.js__store_resource_post_process(resource.id)
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

      resource.updateExtractionState('idle')
    } catch (e) {
      this.log.error('error refreshing resource', e)
      resource.updateExtractionState('idle') // TODO: support error state

      throw e
    }
  }

  static SearchTagCanonicalURL(url: string): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.CANONICAL_URL, value: url, op: 'eq' }
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

  static provide(telemetry: Telemetry) {
    const resourceManager = new ResourceManager(telemetry)

    setContext('resourceManager', resourceManager)

    return resourceManager
  }

  static use() {
    return getContext('resourceManager') as ResourceManager
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
