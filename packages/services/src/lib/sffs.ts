import { isDev, useLogScope, type ScopedLogger } from '@deta/utils'
import type {
  BookmarkFolder,
  BrowserType,
  EventBusMessage,
  SFFSResourceOrSpace,
  AiSFFSQueryResponse,
  HistoryEntry,
  HistoryEntryType,
  HorizonData,
  Optional,
  SFFSRawCompositeResource,
  SFFSRawHistoryEntry,
  SFFSRawHistoryEntryType,
  SFFSRawResourceMetadata,
  SFFSRawResourceTag,
  SFFSResource,
  SFFSResourceMetadata,
  SFFSResourceTag,
  SFFSSearchParameters,
  SFFSSearchResult,
  SFFSSearchResultEngine,
  SFFSSearchResultItem,
  SFFSSearchResultItemSpace,
  Space,
  SpaceEntry,
  SpaceData,
  SpaceEntryOrigin,
  SFFSRawResource,
  AIChatMessageRaw,
  AIChatRaw,
  SpaceEntrySearchOptions,
  SFFSRawBookmarkFolder,
  AIChatData,
  AIChatMessage,
  AIChatMessageSource,
  AIDocsSimilarity,
  YoutubeTranscript,
  SFFSPaginationParams,
  SFFSPaginatedResult
} from '@deta/types'

import type {
  App,
  Model,
  ChatMessageOptions,
  NoteMessageOptions,
  CreateAppOptions,
  QueryResourcesOptions,
  Message,
  CreateChatCompletionOptions
} from '@deta/backend/types'
import {
  APIKeyMissingError,
  BadRequestError,
  TooManyRequestsError,
  UnauthorizedError
} from '@deta/backend/types'

export type HorizonToCreate = Optional<
  HorizonData,
  'id' | 'stackingOrder' | 'createdAt' | 'updatedAt'
>

export class SFFS {
  backend: any
  fs: any
  log: ScopedLogger

  constructor() {
    this.log = useLogScope('SFFS')

    // @ts-ignore
    if (typeof window.backend === 'undefined') {
      throw new Error('SFFS backend not available')
    }

    // @ts-ignore
    this.backend = window.backend.sffs
    // @ts-ignore
    this.fs = window.backend.resources

    if (isDev) {
      // @ts-ignore
      window.sffs = this
    }

    if (!this.backend) {
      throw new Error('SFFS backend failed to initialize')
    }
  }

  convertCompositeResourceToResource(composite: SFFSRawCompositeResource): SFFSResource {
    return {
      id: composite.resource.id,
      type: composite.resource.resource_type,
      path: composite.resource.resource_path,
      createdAt: composite.resource.created_at,
      updatedAt: composite.resource.updated_at,
      deleted: composite.resource.deleted === 1,
      metadata: {
        name: composite.metadata?.name ?? '',
        sourceURI: composite.metadata?.source_uri ?? '',
        alt: composite.metadata?.alt ?? '',
        userContext: composite.metadata?.user_context ?? ''
      },
      tags: (composite.resource_tags || []).map((tag) =>
        this.convertRawResourceTagToResourceTag(tag)
      ),
      annotations: (composite.resource_annotations || []).map((annotation) => {
        return {
          id: annotation.id,
          type: annotation.resource_type,
          path: annotation.resource_path,
          // tags are missing as we are not getting back a composite resource for annotations
          createdAt: annotation.created_at,
          updatedAt: annotation.updated_at,
          deleted: annotation.deleted === 1
        }
      }),
      postProcessingState: composite.post_processing_job?.state,
      spaceIds: composite.space_ids ?? []
    }
  }

  convertResourceToCompositeResource(resource: SFFSResource): SFFSRawCompositeResource {
    return {
      resource: {
        id: resource.id,
        resource_path: resource.path,
        resource_type: resource.type,
        created_at: resource.createdAt,
        updated_at: resource.updatedAt,
        deleted: resource.deleted ? 1 : 0
      },
      metadata: {
        id: '', // TODO: what about metadata id? do we need to keep it around?
        resource_id: resource.id,
        name: resource.metadata?.name ?? '',
        source_uri: resource.metadata?.sourceURI ?? '',
        alt: resource.metadata?.alt ?? '',
        user_context: resource.metadata?.userContext ?? ''
      },
      resource_tags: (resource.tags || []).map((tag) => ({
        id: tag.id ?? '',
        resource_id: resource.id,
        tag_name: tag.name,
        tag_value: tag.value
      }))
    }
  }

  convertRawHistoryEntryToHistoryEntry(rawEntry: SFFSRawHistoryEntry): HistoryEntry {
    return {
      id: rawEntry.id,
      createdAt: rawEntry.created_at,
      updatedAt: rawEntry.updated_at,
      type: rawEntry.entry_type.toLowerCase() as HistoryEntryType,
      url: rawEntry.url ?? undefined,
      title: rawEntry.title ?? undefined,
      searchQuery: rawEntry.search_query ?? undefined
    }
  }

  convertHistoryEntryToRawHistoryEntry(entry: HistoryEntry): SFFSRawHistoryEntry {
    return {
      id: entry.id,
      created_at: entry.createdAt,
      updated_at: entry.updatedAt,
      entry_type: entry.type as SFFSRawHistoryEntryType,
      url: entry.url ?? null,
      title: entry.title ?? null,
      search_query: entry.searchQuery ?? null
    }
  }

  convertRawBookmarkFolderToBookmarkFolder(rawEntry: SFFSRawBookmarkFolder): BookmarkFolder {
    return {
      guid: rawEntry.guid,
      title: rawEntry.title,
      createdAt: rawEntry.created_at,
      updatedAt: rawEntry.updated_at,
      lastUsedAt: rawEntry.last_used_at,
      children: (rawEntry.children ?? []).map((child) => ({
        guid: child.guid,
        title: child.title,
        url: child.url,
        createdAt: child.created_at,
        updatedAt: child.updated_at,
        lastUsedAt: child.last_used_at
      }))
    }
  }

  convertRawSpaceToSpace(raw: any): Space {
    const parsedName = this.parseData<SpaceData>(raw.name)
    const nameData =
      parsedName === null
        ? // @ts-ignore
          ({
            folderName: raw.name,
            colors: ['', ''],
            showInSidebar: false,
            sources: [],
            liveModeEnabled: false,
            smartFilterQuery: null,
            sortBy: 'resource_added_to_space'
          } as SpaceData)
        : parsedName

    nameData.nestingData = {
      parentSpaces: raw.parent_space_ids || [],
      childSpaces: raw.child_space_ids || [],
      hasChildren: raw.child_space_ids?.length > 0 || false,
      hasParents: raw.parent_space_ids?.length > 0 || false
    }

    // Convert legacy sortBy values to new ones
    if (nameData.sortBy) {
      const sortBy = nameData.sortBy as string
      if (sortBy === 'created_at') {
        nameData.sortBy = 'resource_added_to_space'
      } else if (sortBy === 'updated_at') {
        nameData.sortBy = 'resource_updated'
      } else if (sortBy === 'source_published_at') {
        nameData.sortBy = 'resource_source_published'
      }
    }

    return {
      id: raw.id,
      name: nameData,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
      deleted: raw.deleted
    }
  }

  convertSpaceToRawSpace(space: Space): any {
    return {
      id: space.id,
      name: JSON.stringify(space.name),
      created_at: space.created_at,
      updated_at: space.updated_at,
      deleted: space.deleted
    }
  }

  convertRawResourceTagToResourceTag(raw: SFFSRawResourceTag): SFFSResourceTag {
    return {
      id: raw.id,
      name: raw.tag_name,
      value: raw.tag_value
    }
  }

  convertRawChatMessageToChatMessage(raw: AIChatMessageRaw, idx?: number): AIChatMessage {
    return {
      ...raw,
      id: `${raw.ai_session_id}-${raw.role}-${idx}` // TODO: generate ids in the backend
    }
  }

  convertRawChatToChat(raw: AIChatRaw): AIChatData {
    return {
      id: raw.id,
      title: raw.title,
      messages: (raw.messages ?? []).map((message, idx) =>
        this.convertRawChatMessageToChatMessage(message, idx)
      ),
      updatedAt: raw.updated_at,
      createdAt: raw.created_at
    }
  }

  parseData<T>(raw: string): T | null {
    try {
      return JSON.parse(raw)
    } catch (e) {
      // this.log.error('failed to parse data', e)
      return null
    }
  }

  stringifyData(data: any): string {
    return JSON.stringify(data)
  }

  async createResource(
    type: string,
    metadata?: SFFSResourceMetadata,
    tags?: SFFSResourceTag[]
  ): Promise<SFFSResource> {
    this.log.debug('creating resource of type', type)

    // convert metadata and tags to expected format
    const metadataData = JSON.stringify({
      id: '',
      resource_id: '',
      name: metadata?.name ?? '',
      source_uri: metadata?.sourceURI ?? '',
      alt: metadata?.alt ?? '',
      user_context: metadata?.userContext ?? ''
    } as SFFSRawResourceMetadata)

    const tagsData = JSON.stringify(
      (tags ?? []).map(
        (tag) =>
          ({
            id: '',
            resource_id: '',
            tag_name: tag.name ?? '',
            tag_value: tag.value ?? ''
          }) as SFFSRawResourceTag
      )
    )

    const dataString = await this.backend.js__store_create_resource(type, tagsData, metadataData)
    const composite = this.parseData<SFFSRawCompositeResource>(dataString)

    if (!composite) {
      throw new Error('failed to create resource, invalid data', dataString)
    }

    const result = this.convertCompositeResourceToResource(composite)

    return result
  }

  async readResource(
    id: string,
    opts?: { includeAnnotations?: boolean }
  ): Promise<SFFSResource | null> {
    this.log.debug('reading resource with id', id)
    const dataString = await this.backend.js__store_get_resource(
      id,
      opts?.includeAnnotations ?? false
    )

    const composite = this.parseData<SFFSRawCompositeResource>(dataString)
    if (!composite) {
      return null
    }

    return this.convertCompositeResourceToResource(composite)
  }

  async updateResource(resource: SFFSRawResource) {
    this.log.debug('updating resource with id', resource.id, 'data:', resource)

    const stringified = JSON.stringify(resource)

    const result = this.backend.js__store_update_resource(stringified)
    return result
  }

  async updateResourceMetadata(id: string, metadata: SFFSResourceMetadata) {
    const dataString = await this.backend.js__store_get_resource(id, false)
    const composite = this.parseData<SFFSRawCompositeResource>(dataString)
    if (!composite || !composite.metadata) {
      throw new Error('failed to update resource, invalid resource data', dataString)
    }

    const stringified = JSON.stringify({
      id: composite.metadata.id,
      resource_id: composite.resource.id,
      name: metadata.name,
      source_uri: metadata.sourceURI,
      alt: metadata.alt,
      user_context: metadata.userContext
    } as SFFSRawResourceMetadata)

    const result = this.backend.js__store_update_resource_metadata(stringified)
    return result
  }

  async createResourceTag(resourceId: string, tagName: string, tagValue: string) {
    this.log.debug('creating resource tag', resourceId, tagName, tagValue)
    const stringified = JSON.stringify({
      id: '',
      resource_id: resourceId,
      tag_name: tagName,
      tag_value: tagValue
    } as SFFSRawResourceTag)

    const raw = await this.backend.js__store_create_resource_tag(stringified)
    const tag = this.parseData<SFFSRawResourceTag>(raw)

    if (!tag) {
      return null
    }

    return this.convertRawResourceTagToResourceTag(tag)
  }

  async updateResourceTag(resourceId: string, tagName: string, tagValue: string) {
    this.log.debug('updating resource tag', resourceId, tagName, tagValue)
    const stringified = JSON.stringify({
      id: '',
      resource_id: resourceId,
      tag_name: tagName,
      tag_value: tagValue
    } as SFFSRawResourceTag)

    await this.backend.js__store_update_resource_tag_by_name(stringified)
  }

  async deleteResourceTag(resourceId: string, tagName: string) {
    this.log.debug('deleting resource tag', resourceId, tagName)
    await this.backend.js__store_remove_resource_tag_by_name(resourceId, tagName)
  }

  async deleteResourceTagByID(id: string) {
    this.log.debug('deleting resource tag by id', id)
    await this.backend.js__store_remove_resource_tag_by_id(id)
  }

  async deleteResource(id: string): Promise<void> {
    this.log.debug('deleting resource with id', id)
    await this.backend.js__store_remove_resources([id])
  }

  async deleteResources(ids: string[]): Promise<void> {
    this.log.debug('deleting resources', ids)
    await this.backend.js__store_remove_resources(ids)
  }

  async deleteResourcesByTags(tags: SFFSResourceTag[]): Promise<void> {
    this.log.debug('deleting resources by tags', tags)
    await this.backend.js__store_remove_resources_by_tags(tags)
  }

  async recoverResource(id: string): Promise<void> {
    this.log.debug('recovering resource with id', id)
    await this.backend.js__store_recover_resource(id)
  }

  async readResources(): Promise<SFFSResource[]> {
    this.log.debug('reading all resources')
    const items = await this.backend.js__store_get_resources()
    return items.map(this.convertCompositeResourceToResource)
  }

  private serializeTagsData(tags: SFFSResourceTag[]): string {
    return JSON.stringify(
      tags.map(
        (tag) =>
          ({
            id: '',
            resource_id: '',
            tag_name: tag.name,
            tag_value: tag.value,
            op: tag.op ?? 'eq'
          }) as SFFSRawResourceTag
      )
    )
  }

  async listAllResourceIDsByTags(
    tags: SFFSResourceTag[],
    excludeWithinSpaces: boolean = false
  ): Promise<string[]> {
    this.log.debug('listing all resources by tags', tags, excludeWithinSpaces)

    const tagsData = this.serializeTagsData(tags)

    const allResults: string[] = []
    let hasMore = true
    let cursor: string | null = null

    while (hasMore) {
      const paginationParams: SFFSPaginationParams = {
        limit: 100,
        ...(cursor && { cursor })
      }
      const paginationData = JSON.stringify(paginationParams)

      let raw: string
      if (excludeWithinSpaces) {
        raw = await this.backend.js__store_list_resources_by_tags_no_space(tagsData, paginationData)
      } else {
        raw = await this.backend.js__store_list_resources_by_tags(tagsData, paginationData)
      }

      const parsed = this.parseData<SFFSPaginatedResult<string>>(raw)
      if (!parsed) {
        throw new Error(
          'failed to parse result of list resources by tags, unexpected data from backend'
        )
      }

      allResults.push(...parsed.items)
      hasMore = parsed.has_more
      cursor = parsed.next_cursor
    }

    this.log.debug(`fetched ${allResults.length} total resources by tags`)
    return allResults
  }

  async listResourceIDsByTags(
    tags: SFFSResourceTag[],
    paginationParams: SFFSPaginationParams,
    // undefined = all spaces
    // empty string = does not belong to any space
    // non empty string = specific space
    spaceId?: string
  ) {
    this.log.debug('listing resources by tags', tags, paginationParams, spaceId)
    const tagsData = JSON.stringify(
      tags.map(
        (tag) =>
          ({
            id: '',
            resource_id: '',
            tag_name: tag.name,
            tag_value: tag.value,
            op: tag.op ?? 'eq'
          }) as SFFSRawResourceTag
      )
    )
    const paginationData = JSON.stringify(paginationParams)
    const raw = await this.backend.js__store_list_resources_by_tags(
      tagsData,
      paginationData,
      spaceId
    )
    const parsed = this.parseData<SFFSPaginatedResult<string>>(raw)
    return parsed
  }

  async listAllResourcesAndSpaces(tags: SFFSResourceTag[]) {
    this.log.debug('listing all resources and spaces by tags', tags)
    const tagsData = JSON.stringify(
      tags.map(
        (tag) =>
          ({
            id: '',
            resource_id: '',
            tag_name: tag.name,
            tag_value: tag.value,
            op: tag.op ?? 'eq'
          }) as SFFSRawResourceTag
      )
    )
    const raw = await this.backend.js__store_list_all_resources_and_spaces(tagsData)
    const parsed = this.parseData<SFFSResourceOrSpace[]>(raw)
    return parsed ?? []
  }

  async searchResources(
    query: string,
    tags?: SFFSResourceTag[],
    parameters?: SFFSSearchParameters
  ): Promise<SFFSSearchResult> {
    this.log.debug(
      'searching resources with query',
      query,
      'and tags',
      tags,
      'and parameters',
      parameters
    )
    const tagsData = JSON.stringify(
      (tags ?? []).map(
        (tag) =>
          ({
            id: '',
            resource_id: '',
            tag_name: tag.name ?? '',
            tag_value: tag.value ?? '',
            op: tag.op ?? 'eq'
          }) as SFFSRawResourceTag
      )
    )
    const raw = await this.backend.js__store_search_resources(
      query,
      tagsData,
      parameters?.semanticEnabled,
      parameters?.semanticDistanceThreshold,
      parameters?.semanticLimit,
      parameters?.spaceId,
      parameters?.keywordLimit
    )
    const parsed = this.parseData<SFFSSearchResult>(raw)
    const parsedItems = parsed?.items ?? []
    const parsedSpaces = parsed?.spaces ?? []

    const items = parsedItems.map((item) => ({
      ...item,
      engine: item.engine.toLowerCase() as SFFSSearchResultEngine,
      resource: this.convertCompositeResourceToResource(item.resource)
    }))

    const spaces = parsedSpaces.map((space) => ({
      ...space,
      engine: space.engine.toLowerCase() as SFFSSearchResultEngine
    }))
    return {
      items,
      spaces,
      space_entries: parsed?.space_entries
    }
  }

  async searchChatResourcesAI(
    query: string,
    model: Model,
    opts?: {
      customKey?: string
      limit?: number
      resourceIds?: string[]
    }
  ): Promise<SFFSResource[]> {
    this.log.debug('searching resources with AI query', query, 'model:', model, 'opts:', opts)
    const rawResponse: string = await this.withErrorHandling(
      this.backend,
      this.backend.js__ai_search_chat_resources,
      JSON.stringify({
        query,
        model,
        custom_key: opts?.customKey,
        number_documents: opts?.limit ?? 20,
        resource_ids: opts?.resourceIds
      })
    )

    const compositeResources = this.parseData<SFFSRawCompositeResource[]>(rawResponse)
    if (!compositeResources) {
      return []
    }

    return compositeResources.map((resource) => this.convertCompositeResourceToResource(resource))
  }

  async createSpace(name: SpaceData) {
    this.log.debug('creating space with name:', name)

    const raw = await this.backend.js__store_create_space(JSON.stringify(name))
    const space = this.parseData<any>(raw)

    if (!space) {
      return null
    }

    return this.convertRawSpaceToSpace(space)
  }

  async getSpace(id: string) {
    this.log.debug('getting space with id', id)
    const raw = await this.backend.js__store_get_space(id)

    const space = this.parseData<any>(raw)

    if (!space) {
      return null
    }

    return this.convertRawSpaceToSpace(space)
  }

  async listSpaces() {
    this.log.debug('listing all spaces')
    const raw = await this.backend.js__store_list_spaces()

    const spaces = this.parseData<any[]>(raw)

    if (!spaces) {
      return []
    }

    return spaces.map((space) => this.convertRawSpaceToSpace(space))
  }

  async searchSpaces(query: string) {
    this.log.debug('searching spaces with query', query)
    const raw = await this.backend.js__store_search_spaces(query)
    const result = this.parseData<any[]>(raw)
    this.log.debug('search spaces result', result)
    if (!result) {
      return []
    }
    return result.map((item) => this.convertRawSpaceToSpace(item.space))
  }

  async updateSpace(spaceId: string, name: SpaceData) {
    this.log.debug('updating space', spaceId, name)
    const rawName = JSON.stringify(name)
    await this.backend.js__store_update_space(spaceId, rawName)
  }

  async deleteSpace(space_id: string): Promise<void> {
    this.log.debug('deleting space with id', space_id)
    await this.backend.js__store_delete_space(space_id)
  }

  async addItemsToSpace(
    space_id: string,
    resourceIds: string[],
    origin: SpaceEntryOrigin
  ): Promise<void> {
    const typedItems = resourceIds.map((id) => ({
      entry_id: id,
      entry_type: 'resource',
      manually_added: origin
    }))
    this.log.debug('creating space entries for space', space_id, 'entries:', typedItems)
    await this.backend.js__store_create_space_entries(space_id, typedItems)
  }

  async addSubspacesToSpace(
    space_id: string,
    space_ids: string[],
    origin: SpaceEntryOrigin
  ): Promise<void> {
    const typedItems = space_ids.map((id) => ({
      entry_id: id,
      entry_type: 'space',
      manually_added: origin
    }))
    this.log.debug('creating sub space entries for space', space_id, 'entries:', typedItems)
    await this.backend.js__store_create_space_entries(space_id, typedItems)
  }

  async getSpaceContents(space_id: string, opts?: SpaceEntrySearchOptions): Promise<SpaceEntry[]> {
    this.log.debug('getting space entries for space with id', space_id)
    const rawEntries = await this.backend.js__store_get_space_entries(
      space_id,
      opts?.sort_by,
      opts?.order,
      opts?.limit
    )
    const entries = this.parseData<SpaceEntry[]>(rawEntries)
    if (!entries) {
      return []
    }

    return entries
  }

  // NOTE: the ids here are the ids of the entries themselves and NOT THE RESOURCE/SPACE IDS
  async deleteSpaceEntries(ids: string[], isResourceType = true): Promise<void> {
    this.log.debug('deleting space entries with ids', ids)
    const typedItems = ids.map((id) => ({
      id: id,
      entry_type: isResourceType ? 'resource' : 'space'
    }))
    await this.backend.js__store_delete_space_entries(typedItems)
  }

  async deleteEntriesInSpaceByEntryIds(
    spaceId: string,
    entryIds: string[],
    isResourceType = true
  ): Promise<void> {
    this.log.debug('deleting entries in space ', spaceId, ' with entry ids', entryIds)
    const resourceType = isResourceType ? 'resource' : 'space'

    await this.backend.js__store_delete_entries_in_space_by_entry_ids(
      spaceId,
      entryIds,
      resourceType
    )
  }

  async moveSpace(spaceId: string, toSpaceId: string): Promise<void> {
    this.log.debug('moving space', spaceId, 'to space', toSpaceId)
    await this.backend.js__store_move_space(spaceId, toSpaceId)
  }

  // async searchForNearbyResources(resourceId: string, parameters?: SFFSSearchProximityParameters) {
  //   const raw = await this.backend.js__store_proximity_search_resources(
  //     resourceId,
  //     parameters?.proximityDistanceThreshold,
  //     parameters?.proximityLimit
  //   )
  //   const parsed = this.parseData<SFFSSearchResult>(raw)
  //   const items = parsed?.items ?? []
  //   this.log.debug('search results', items)
  //   return items.map((item) => ({
  //     ...item,
  //     engine: item.engine.toLowerCase() as SFFSSearchResultEngine,
  //     resource: this.convertCompositeResourceToResource(item.resource)
  //   }))
  // }

  async readDataFile(
    resourceId: string,
    resourceType: string,
    resourcePath: string
  ): Promise<Uint8Array> {
    // this.log.debug('reading data file', path)

    await this.fs.openResource(resourceId, resourceType, resourcePath, 'r+')

    const uInt8 = (await this.fs.readResource(resourceId)) as Promise<Uint8Array>

    await this.fs.closeResource(resourceId)

    return uInt8
  }

  async writeDataFile(
    resourceId: string,
    resourceType: string,
    resourcePath: string,
    data: Blob
  ): Promise<void> {
    this.log.debug('writing data file', data)

    await this.fs.openResource(resourceId, resourceType, resourcePath, 'w')

    const buffer = await data.arrayBuffer()

    await this.fs.writeResource(resourceId, buffer)
    await this.fs.closeResource(resourceId)
  }

  async createHistoryEntry(entry: HistoryEntry): Promise<HistoryEntry> {
    this.log.debug('creating history entry', entry)
    const rawEntry = this.convertHistoryEntryToRawHistoryEntry(entry)
    const stringEntry = this.stringifyData(rawEntry)
    const newRawEntry = await this.backend.js__store_create_history_entry(stringEntry)
    const newEntry = this.parseData<SFFSRawHistoryEntry>(newRawEntry)
    if (!newEntry) {
      throw new Error('failed to create history entry, invalid data', newRawEntry)
    }

    return this.convertRawHistoryEntryToHistoryEntry(newEntry)
  }

  async getHistoryEntry(id: string): Promise<HistoryEntry | null> {
    this.log.debug('getting history entry with id', id)
    const rawEntry = await this.backend.js__store_get_history_entry(id)
    const entry = this.parseData<SFFSRawHistoryEntry>(rawEntry)
    if (!entry) {
      return null
    }

    return this.convertRawHistoryEntryToHistoryEntry(entry)
  }

  async getHistoryEntries(limit?: number): Promise<HistoryEntry[]> {
    this.log.debug('getting all history entries')
    const rawEntries = await this.backend.js__store_get_all_history_entries(limit)
    const entries = this.parseData<SFFSRawHistoryEntry[]>(rawEntries)
    if (!entries) {
      return []
    }

    return entries.map((e) => this.convertRawHistoryEntryToHistoryEntry(e))
  }

  async updateHistoryEntry(data: Partial<HistoryEntry>): Promise<void> {
    this.log.debug('updating history entry', data)
    const rawEntry = this.convertHistoryEntryToRawHistoryEntry(data as HistoryEntry)
    const stringEntry = this.stringifyData(rawEntry)
    await this.backend.js__store_update_history_entry(stringEntry)
  }

  async deleteHistoryEntry(id: string): Promise<void> {
    this.log.debug('deleting history entry', id)
    await this.backend.js__store_remove_history_entry(id)
  }

  async deleteAllHistoryEntries(): Promise<void> {
    this.log.debug('deleting all history entries')
    await this.backend.js__store_remove_all_history_entries()
  }

  async importBrowserHistory(type: BrowserType) {
    this.log.debug('importing browser history')
    const rawEntries = await this.backend.js__store_import_browser_history(type)
    const entries = this.parseData<SFFSRawHistoryEntry[]>(rawEntries)
    if (!entries) {
      return []
    }

    return entries.map((e) => this.convertRawHistoryEntryToHistoryEntry(e))
  }

  async importBrowserBookmarks(type: BrowserType) {
    this.log.debug('importing browser bookmarks')
    const rawEntries = await this.backend.js__store_import_browser_bookmarks(type)
    const entries = this.parseData<SFFSRawBookmarkFolder[]>(rawEntries)
    if (!entries) {
      return []
    }

    return entries.map((e) => this.convertRawBookmarkFolderToBookmarkFolder(e))
  }

  // returns a list of unique hostnames
  async searchHistoryEntriesByHostnamePrefix(
    prefix: string,
    since?: Date
  ): Promise<HistoryEntry[]> {
    this.log.debug('searching history entries by hostname prefix', prefix)
    const rawEntries = await this.backend.js__store_search_history_entries_by_hostname_prefix(
      prefix,
      since
    )
    const entries = this.parseData<SFFSRawHistoryEntry[]>(rawEntries)
    if (!entries) {
      return []
    }

    return entries.map((e) => this.convertRawHistoryEntryToHistoryEntry(e))
  }

  async searchHistoryEntriesByHostname(url: string): Promise<HistoryEntry[]> {
    this.log.debug('searching history entries by hostname prefix', url)
    const rawEntries = await this.backend.js__store_search_history_entries_by_hostname(url)
    const entries = this.parseData<SFFSRawHistoryEntry[]>(rawEntries)
    if (!entries) {
      return []
    }

    return entries.map((e) => this.convertRawHistoryEntryToHistoryEntry(e))
  }

  async searchHistoryEntriesByUrlAndTitle(query: string, since?: Date): Promise<HistoryEntry[]> {
    this.log.debug('searching history entries by url and title for', query)
    const rawEntries = await this.backend.js__store_search_history_entries_by_url_and_title(
      query,
      since
    )
    const entries = this.parseData<SFFSRawHistoryEntry[]>(rawEntries)
    if (!entries) {
      return []
    }

    return entries.map((e) => this.convertRawHistoryEntryToHistoryEntry(e))
  }

  async createAIChat(title?: string, system_prompt?: string): Promise<string | null> {
    this.log.debug(`creating ai chat "${title}" with system prompt: ${system_prompt}`)
    return this.parseData<string>(
      await this.backend.js__store_create_ai_chat(system_prompt ?? '', title ?? '')
    )
  }

  async updateAIChatTitle(id: string, title: string): Promise<void> {
    this.log.debug('updating ai chat with id', id, title)
    await this.backend.js__store_update_ai_chat(id, title)
  }

  async listAIChats(limit?: number): Promise<AIChatData[]> {
    this.log.debug('listing ai chats', limit ?? 'all')
    const raw = await this.backend.js__store_list_ai_chats(limit)
    const chats = this.parseData<AIChatRaw[]>(raw)
    if (!chats) {
      return []
    }

    return chats.map((chat) => this.convertRawChatToChat(chat))
  }

  async searchAIChats(query: string, limit?: number): Promise<AIChatData[]> {
    this.log.debug('searching ai chats with query', query, limit ?? 'all')
    const raw = await this.backend.js__store_search_ai_chats(query, limit)
    const chats = this.parseData<AIChatRaw[]>(raw)
    if (!chats) {
      return []
    }

    return chats.map((chat) => this.convertRawChatToChat(chat))
  }

  async deleteAIChat(id: string): Promise<void> {
    this.log.debug('deleting ai chat with id', id)
    await this.backend.js__store_remove_ai_chat(id)
  }

  async getAIChat(id: string): Promise<AIChatData | null> {
    this.log.debug('getting ai chat with id', id)
    const raw = await this.backend.js__store_get_ai_chat(id)

    const chat = this.parseData<AIChatRaw>(raw)
    if (!chat) {
      return null
    }

    return this.convertRawChatToChat(chat)
  }

  async getAIDocsSimilarity(
    query: string,
    docs: string[],
    threshold: number = 0.5
  ): Promise<AIDocsSimilarity[] | null> {
    this.log.debug('getting ai docs similarity with query', query, 'threshold', threshold)
    const raw = await this.backend.js__ai_get_docs_similarity(query, docs, threshold)

    return this.parseData<AIDocsSimilarity[]>(raw)
  }

  async getAIChatDataSource(hash: string): Promise<AIChatMessageSource | null> {
    const raw = await this.backend.js__ai_get_chat_data_source(hash)
    //
    const dataChunkSource = JSON.parse(raw)
    if (!dataChunkSource) {
      return null
    }

    // TODO: fix the empty fields and also the data remodelling done
    const source: AIChatMessageSource = {
      id: '',
      all_chunk_ids: [],
      render_id: '',
      uid: dataChunkSource.id,
      content: dataChunkSource.content,
      resource_id: dataChunkSource.resource_id,
      metadata: {
        timestamp: dataChunkSource.metadata.timestamp,
        url: dataChunkSource.metadata.url,
        page: dataChunkSource.metadata.page
      }
    }
    return source
  }

  async getAIYoutubeTranscript(videoURL: string): Promise<YoutubeTranscript | null> {
    this.log.debug('getting youtube transcript with video url', videoURL)
    const raw = await this.backend.js__ai_get_youtube_transcript(videoURL)
    return this.parseData<YoutubeTranscript>(raw)
  }

  async withErrorHandling<T>(
    context: any,
    fn: (...args: any[]) => Promise<T>,
    ...args: any[]
  ): Promise<T> {
    try {
      return await fn.apply(context, args)
    } catch (error) {
      this.log.debug('error', error)
      const message =
        typeof error === 'string' ? error : error instanceof Error ? error.message : undefined
      if (message) {
        if (message.includes('LLM Bad Request error')) {
          throw new BadRequestError(message.replace('LLM Bad Request error: ', ''))
        }
        if (message.includes('LLM API Key Missing error')) {
          throw new APIKeyMissingError()
        }
        if (message.includes('LLM Too Many Requests error')) {
          throw new TooManyRequestsError()
        }
        if (message.includes('LLM Unauthorized error')) {
          throw new UnauthorizedError()
        }
      }
      throw error
    }
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
    this.log.debug(
      'querying SFFS resources with AI',
      query,
      'model:',
      model,
      'custom_key:',
      !!opts?.customKey,
      'sql_query:',
      opts?.sqlQuery,
      'embedding_query:',
      opts?.embeddingQuery,
      'embedding_distance_threshold:',
      opts?.embeddingDistanceThreshold
    )

    const data: QueryResourcesOptions = {
      query,
      model,
      custom_key: opts?.customKey,
      sql_query: opts?.sqlQuery,
      embedding_query: opts?.embeddingQuery,
      embedding_distance_threshold: opts?.embeddingDistanceThreshold
    }

    const rawResponse: string = await this.withErrorHandling(
      this.backend,
      this.backend.js__ai_query_sffs_resources,
      JSON.stringify(data)
    )
    this.log.debug('raw response', rawResponse)

    let response = this.parseData<AiSFFSQueryResponse>(rawResponse)
    if (!response) {
      throw new Error(`failed to query SFFS resources, invalid response data: ${rawResponse}`)
    }

    if (typeof response === 'string') {
      response = this.parseData<AiSFFSQueryResponse>(response)
      if (!response) {
        throw new Error(`failed to query SFFS resources, invalid response data: ${rawResponse}`)
      }
    }

    return response
  }

  async createAIApp(
    query: string,
    model: Model,
    chunkCallback: (chunk: string) => void,
    doneCallback: () => void,
    opts?: {
      customKey?: string
      inlineImages?: string[]
    }
  ): Promise<string | null> {
    const data: CreateAppOptions = {
      query,
      model,
      custom_key: opts?.customKey,
      inline_images: opts?.inlineImages
    }

    const raw = await this.withErrorHandling(
      this.backend,
      this.backend.js__ai_create_app,
      JSON.stringify(data),
      chunkCallback,
      doneCallback
    )
    return String(raw)
  }

  async sendAIChatMessage(
    callback: (chunk: string) => void,
    chatId: string,
    query: string,
    model: Model,
    opts?: {
      customKey?: string
      limit?: number
      ragOnly?: boolean
      resourceIds?: string[]
      inlineImages?: string[]
      general?: boolean
      appCreation?: boolean
    }
  ): Promise<void> {
    this.log.debug(
      'sending ai chat message to chat with id',
      chatId,
      'query:',
      query,
      'model',
      model,
      'custom_key',
      !!opts?.customKey,
      'limit:',
      opts?.limit,
      'resource ids filter:',
      opts?.resourceIds,
      'inline images length:',
      opts?.inlineImages?.length,
      'rag only:',
      opts?.ragOnly
    )
    const data: ChatMessageOptions = {
      query,
      chat_id: chatId,
      model,
      custom_key: opts?.customKey,
      resource_ids: opts?.resourceIds,
      inline_images: opts?.inlineImages,
      limit: opts?.limit ?? 20,
      rag_only: opts?.ragOnly,
      general: opts?.general,
      app_creation: opts?.appCreation
    }
    return this.withErrorHandling(
      this.backend,
      this.backend.js__ai_send_chat_message,
      JSON.stringify(data),
      callback
    )
  }

  async sendAINoteMessage(
    callback: (chunk: string) => void,
    noteResourceId: string,
    query: string,
    model: Model,
    opts?: {
      customKey?: string
      limit?: number
      resourceIds?: string[]
      inlineImages?: string[]
      general?: boolean
      websearch?: boolean
      surflet?: boolean
    }
  ): Promise<void> {
    this.log.debug(
      'sending ai note message with note resource id',
      noteResourceId,
      'query:',
      query,
      'model',
      model,
      'custom_key',
      !!opts?.customKey,
      'limit:',
      opts?.limit,
      'resource ids filter:',
      opts?.resourceIds,
      'inline images length:',
      opts?.inlineImages?.length
    )
    const data: NoteMessageOptions = {
      query,
      note_resource_id: noteResourceId,
      model,
      custom_key: opts?.customKey,
      resource_ids: opts?.resourceIds,
      inline_images: opts?.inlineImages,
      limit: opts?.limit ?? 20,
      general: opts?.general,
      websearch: opts?.websearch,
      surflet: opts?.surflet
    }
    return this.withErrorHandling(
      this.backend,
      this.backend.js__ai_send_note_message,
      JSON.stringify(data),
      callback
    )
  }

  async createAIChatCompletion(
    messages: Message[],
    model: Model,
    opts?: {
      customKey?: string
      responseFormat?: string
    }
  ) {
    const data = {
      messages,
      model,
      custom_key: opts?.customKey,
      response_format: opts?.responseFormat
    } as CreateChatCompletionOptions

    return JSON.parse(
      await this.withErrorHandling(
        this.backend,
        this.backend.js__ai_create_chat_completion,
        JSON.stringify(data)
      )
    )
  }

  registerEventBustHandler(handler: (event: EventBusMessage) => void) {
    return this.backend.js__backend_event_bus_register(handler) as () => void
  }

  // TODO: use the App interface here?
  async storeAIApp(appType: string, content: string, name?: string, icon?: string, meta?: string) {
    return this.backend.js__store_create_app(appType, content, name, icon, meta)
  }

  async deleteAIApp(id: string) {
    return this.backend.js__store_delete_app(id)
  }

  async listAIApps(): Promise<App[]> {
    const apps = await this.backend.js__store_list_apps()
    const parsed = this.parseData<App[]>(apps)
    return parsed ?? []
  }
}
