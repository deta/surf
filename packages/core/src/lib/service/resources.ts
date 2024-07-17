import { get, writable, type Writable } from 'svelte/store'

import { useLogScope, type ScopedLogger } from '../utils/log'
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
  type SpaceSource
} from '../types'
import type { Telemetry } from './telemetry'
import {
  TelemetryEventTypes,
  type ResourceDataAnnotation,
  type ResourceDataHistoryEntry
} from '@horizon/types'
import { getContext, setContext } from 'svelte'
import type { MediaParserResult } from './mediaImporter'

/*
 TODO:
 - move over other card data to SFFSResource
 - handle errors
 - use the relevant enum, and do not hard code the values
*/

export const everythingSpace = {
  id: 'all',
  name: {
    folderName: 'Everything',
    colors: ['#76E0FF', '#4EC9FB'],
    showInSidebar: false,
    liveModeEnabled: false,
    hideViewed: false,
    smartFilterQuery: null
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

export class Resource {
  id: string
  type: string
  path: string
  createdAt: string
  updatedAt: string
  deleted: boolean

  metadata?: SFFSResourceMetadata
  tags?: SFFSResourceTag[]
  annotations?: ResourceAnnotation[]

  rawData: Blob | null
  readDataPromise: Promise<Blob> | null // used to avoid duplicate reads
  dataUsed: number // number of times the data is being used

  sffs: SFFS
  log: ScopedLogger

  constructor(sffs: SFFS, data: SFFSResource) {
    this.log = useLogScope(`SFFSResource ${data.id}`)
    this.sffs = sffs

    this.id = data.id
    this.type = data.type
    this.path = data.path
    this.createdAt = data.createdAt
    this.updatedAt = data.updatedAt
    this.deleted = data.deleted
    this.metadata = data.metadata
    this.tags = data.tags
    this.annotations = data.annotations?.map((a) => new ResourceAnnotation(sffs, a))

    this.rawData = null
    this.readDataPromise = null
    this.dataUsed = 0
  }

  private async readDataAsBlob() {
    const buffer = await this.sffs.readDataFile(this.path, this.id)

    return new Blob([buffer], { type: this.type })
  }

  private async readData() {
    // this.log.debug('reading resource data from', this.path)

    if (this.readDataPromise !== null) {
      // this.log.debug('already reading data, piggybacking on existing promise')
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
    this.log.debug('writing resource data to', this.path)

    if (!this.rawData) {
      this.log.warn('no data to write')
      return
    }

    await this.sffs.writeDataFile(this.path, this.id, this.rawData)
  }

  updateData(data: Blob, write = true) {
    this.log.debug('updating resource data with', data)

    this.rawData = data
    this.updatedAt = new Date().toISOString()

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
}

// TODO: adapt to new resource data
export class ResourceNote extends Resource {
  // data: Writable<SFFSResourceDataNote | null>

  parsedData: Writable<string | null>

  constructor(sffs: SFFS, data: SFFSResource) {
    super(sffs, data)
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

  constructor(sffs: SFFS, data: SFFSResource) {
    super(sffs, data)
    this.parsedData = null
    // this.data = writable(null)
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

  constructor(telemetry: Telemetry) {
    this.log = useLogScope('SFFSResourceManager')
    this.resources = writable([])
    this.sffs = new SFFS()
    this.telemetry = telemetry
  }

  private createResourceObject(data: SFFSResource): ResourceObject {
    if (data.type === ResourceTypes.DOCUMENT_SPACE_NOTE) {
      return new ResourceNote(this.sffs, data)
    } else if (data.type === ResourceTypes.LINK) {
      return new ResourceLink(this.sffs, data)
    } else if (data.type.startsWith(ResourceTypes.ARTICLE)) {
      return new ResourceArticle(this.sffs, data)
    } else if (data.type.startsWith(ResourceTypes.POST)) {
      return new ResourcePost(this.sffs, data)
    } else if (data.type.startsWith(ResourceTypes.CHAT_MESSAGE)) {
      return new ResourceChatMessage(this.sffs, data)
    } else if (data.type.startsWith(ResourceTypes.CHAT_THREAD)) {
      return new ResourceChatThread(this.sffs, data)
    } else if (data.type.startsWith(ResourceTypes.DOCUMENT)) {
      return new ResourceDocument(this.sffs, data)
    } else if (data.type.startsWith(ResourceTypes.ANNOTATION)) {
      return new ResourceAnnotation(this.sffs, data)
    } else if (data.type.startsWith(ResourceTypes.HISTORY_ENTRY)) {
      return new ResourceHistoryEntry(this.sffs, data)
    } else {
      return new Resource(this.sffs, data)
    }
  }

  private findOrCreateResourceObject(resource: SFFSResource) {
    const existingResource = get(this.resources).find((r) => r.id === resource.id)
    if (existingResource) {
      return existingResource
    }

    return this.createResourceObject(resource)
  }

  private findOrGetResourceObject(id: string, opts?: { includeAnnotations: boolean }) {
    const existingResource = get(this.resources).find((r) => r.id === id)
    if (existingResource) {
      return Promise.resolve(existingResource)
    }

    return this.getResource(id, opts)
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

    const sffsItem = await this.sffs.createResource(type, parsedMetadata, tags)

    const resource = this.createResourceObject(sffsItem)

    // store the data in the resource and write it to sffs
    if (data) {
      resource.rawData = data
      await resource.writeData()
    }

    this.log.debug('created resource', resource)

    this.resources.update((resources) => [...resources, resource])

    this.telemetry.trackEvent(TelemetryEventTypes.CreateResource, {
      kind: getPrimaryResourceType(type),
      type: type,
      savedWithAction: tags?.find((t) => t.name === ResourceTagsBuiltInKeys.SAVED_WITH_ACTION)
        ?.value
    })

    return resource
  }

  async readResources() {
    const resourceItems = await this.sffs.readResources()
    const resources = resourceItems.map((item) => new Resource(this.sffs, item))
    this.resources.set(resources)
  }

  async listResourceIDsByTags(tags: SFFSResourceTag[]) {
    const results = await this.sffs.listResourceIDsByTags(tags)
    return results
  }

  async listResourcesByTags(tags: SFFSResourceTag[], opts?: { includeAnnotations: boolean }) {
    const resourceIds = await this.sffs.listResourceIDsByTags(tags)
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

  async searchForNearbyResources(resourceId: string, parameters?: SFFSSearchProximityParameters) {
    const rawResults = await this.sffs.searchForNearbyResources(resourceId, parameters)
    const results = rawResults.map(
      (item) =>
        ({
          id: item.resource.id,
          engine: item.engine,
          cardIds: item.card_ids,
          resource: this.findOrCreateResourceObject(item.resource)
        }) as ResourceSearchResultItem
    )

    return results
  }

  async getResourceAnnotations() {
    const rawResults = await this.listResourcesByTags([
      ResourceManager.SearchTagResourceType(ResourceTypes.ANNOTATION),
      ResourceManager.SearchTagDeleted(false)
    ])

    return rawResults.map((item) => this.findOrCreateResourceObject(item)) as ResourceAnnotation[]
  }

  async getResourcesFromSourceURL(url: string) {
    const resources = await this.listResourcesByTags([
      ResourceManager.SearchTagCanonicalURL(url),
      ResourceManager.SearchTagDeleted(false)
    ])

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
    console.log('resource object', obj)
    return this.findOrCreateResourceObject(obj)
  }

  async getResourceWithAnnotations(id: string) {
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
    const resources = await this.listResourcesByTags([
      ResourceManager.SearchTagResourceType(ResourceTypes.HISTORY_ENTRY),
      ResourceManager.SearchTagDeleted(false)
    ])

    return resources as ResourceHistoryEntry[]
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

  async getResource(id: string, opts?: { includeAnnotations: boolean }) {
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

    // delete resource from sffs
    await this.sffs.deleteResource(id)
    this.resources.update((resources) => resources.filter((r) => r.id !== id))

    this.telemetry.trackEvent(TelemetryEventTypes.DeleteResource, { type: resource.type })
  }

  async reloadResource(id: string) {
    const resourceItem = await this.sffs.readResource(id)
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

  async updateResourceData(id: string, data: Blob, write = true) {
    const resource = await this.getResource(id)
    if (!resource) {
      throw new Error('resource not found')
    }

    return resource.updateData(data, write)
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

  async createResourceNote(
    content: string,
    metadata?: Partial<SFFSResourceMetadata>,
    tags?: SFFSResourceTag[]
  ) {
    const blob = new Blob([content], { type: ResourceTypes.DOCUMENT_SPACE_NOTE })
    return this.createResource(
      ResourceTypes.DOCUMENT_SPACE_NOTE,
      blob,
      metadata,
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
    return this.createResource(ResourceTypes.LINK, blob, metadata, tags) as Promise<ResourceLink>
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

  async createResourceHistoryEntry(
    data: ResourceDataHistoryEntry,
    metadata?: Partial<SFFSResourceMetadata>,
    tags?: SFFSResourceTag[]
  ) {
    const blobData = JSON.stringify(data)
    const blob = new Blob([blobData], { type: ResourceTypes.HISTORY_ENTRY })
    return this.createResource(
      ResourceTypes.HISTORY_ENTRY,
      blob,
      metadata,
      tags
    ) as Promise<ResourceHistoryEntry>
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

    return await this.sffs.getSpace(id)
  }

  async listSpaces() {
    const spaces = await this.sffs.listSpaces()

    return [everythingSpace, ...spaces] as Space[]
  }

  async updateSpace(spaceId: string, name: SpaceData) {
    return await this.sffs.updateSpace(spaceId, name)
  }

  async deleteSpace(spaceId: string) {
    return await this.sffs.deleteSpace(spaceId)
  }

  async addItemsToSpace(space_id: string, resourceIds: string[]) {
    const existingItems = await this.getSpaceContents(space_id)
    const existingResourceIds = existingItems.map((item) => item.resource_id)
    const newItems = resourceIds.filter((id) => !existingResourceIds.includes(id))

    return await this.sffs.addItemsToSpace(space_id, newItems)
  }

  async getSpaceContents(space_id: string): Promise<SpaceEntry[]> {
    return await this.sffs.getSpaceContents(space_id)
  }

  async deleteSpaceEntries(entry_ids: string[]) {
    console.log('about to delete entries', entry_ids)
    return await this.sffs.deleteSpaceEntries(entry_ids)
  }

  async getNumberOfReferencesInSpaces(resourceId: string): Promise<number> {
    const allFolders = await this.sffs.listSpaces()
    console.log('allFolders', allFolders)

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

  async getResourcesViaPrompt(query: string): Promise<AiSFFSQueryResponse> {
    return await this.sffs.getResourcesViaPrompt(query)
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

  static provide(telemetry: Telemetry) {
    const resourceManager = new ResourceManager(telemetry)

    setContext('resourceManager', resourceManager)

    return resourceManager
  }

  static use() {
    return getContext('resourceManager') as ResourceManager
  }
}

export const createResourceManager = ResourceManager.provide
export const useResourceManager = ResourceManager.use
