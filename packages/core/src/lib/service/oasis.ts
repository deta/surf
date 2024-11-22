import { getContext, setContext, tick } from 'svelte'
import { derived, get, writable, type Readable, type Writable } from 'svelte/store'
import EventEmitter from 'events'
import type TypedEmitter from 'typed-emitter'

import {
  conditionalArrayItem,
  generateID,
  getFormattedDate,
  isDev,
  useLocalStorageStore,
  useLogScope
} from '@horizon/utils'
import {
  ChangeContextEventTrigger,
  DeleteResourceEventTrigger,
  ResourceTagsBuiltInKeys,
  ResourceTypes
} from '@horizon/types'

import {
  SpaceEntryOrigin,
  type Optional,
  type Space,
  type SpaceData,
  type SpaceEntry
} from '../types'
import { ResourceManager, type Resource } from './resources'
import type { Telemetry } from './telemetry'
import type { TabsManager } from './tabs'
import type { FilterItem } from '../components/Oasis/FilterSelector.svelte'
import type { ConfigService } from './config'
import { RESOURCE_FILTERS } from '../constants/resourceFilters'

export type OasisEvents = {
  created: (space: OasisSpace) => void
  updated: (space: OasisSpace, changes: Partial<SpaceData>) => void
  'added-resources': (space: OasisSpace, resourceIds: string[]) => void
  'removed-resources': (space: OasisSpace, resourceIds: string[]) => void
  deleted: (spaceId: string) => void
  'changed-active-space': (space: OasisSpace | null) => void
}

export type OptionalSpaceData = Optional<
  SpaceData,
  | 'showInSidebar'
  | 'liveModeEnabled'
  | 'hideViewed'
  | 'smartFilterQuery'
  | 'sortBy'
  | 'sources'
  | 'sql_query'
  | 'embedding_query'
  | 'builtIn'
>

export class OasisSpace {
  id: string
  createdAt: string
  updatedAt: string
  deleted: number

  /** Svelte store for the associated space data, use dataValue to access the value directly  */
  data: Writable<SpaceData>
  /** Svelte store for the associated space contents, use contentsValue to access the value directly */
  contents: Writable<SpaceEntry[]>
  /** Svelte store for the associated space index, use index to access the value directly */
  index: Readable<number>

  log: ReturnType<typeof useLogScope>
  oasis: OasisService
  resourceManager: ResourceManager
  telemetry: Telemetry

  constructor(space: Space, oasis: OasisService) {
    this.id = space.id
    this.createdAt = space.created_at
    this.updatedAt = space.updated_at
    this.deleted = space.deleted

    this.data = writable<SpaceData>(space.name)
    this.contents = writable<SpaceEntry[]>([])
    this.index = derived(this.data, ($data) => $data.index ?? -1)

    this.log = useLogScope(`OasisSpace ${this.id}`)
    this.oasis = oasis
    this.resourceManager = oasis.resourceManager
    this.telemetry = oasis.telemetry
  }

  /** Access the data of the space directly */
  get dataValue() {
    return get(this.data)
  }

  /** Returns the space data in the format of the old/sffs Space object */
  get spaceValue() {
    return {
      id: this.id,
      name: this.dataValue,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
      deleted: this.deleted
    } as Space
  }

  /** Access the contents of the space directly */
  get contentsValue() {
    return get(this.contents)
  }

  /** Access the index of the space directly */
  get indexValue() {
    return get(this.index)
  }

  async updateData(updates: Partial<SpaceData>) {
    this.log.debug('updating space', updates)

    const data = { ...this.dataValue, ...updates }
    this.data.set(data)

    await this.resourceManager.updateSpace(this.id, data)

    this.oasis.triggerStoreUpdate(this)

    this.oasis.emit('updated', this, updates)
  }

  async updateIndex(index: number) {
    this.log.debug('updating space index', index)

    await this.updateData({ index })
  }

  async fetchContents() {
    this.log.debug('getting space contents')
    const result = await this.resourceManager.getSpaceContents(this.id)

    this.log.debug('got space contents:', result)
    this.contents.set(result)
    return result
  }

  async addResources(resourceIds: string[], origin: SpaceEntryOrigin) {
    this.log.debug('adding resources to space', resourceIds)
    await this.resourceManager.addItemsToSpace(this.id, resourceIds, origin)

    this.log.debug('added resources to space, updating contents')
    await this.fetchContents()

    this.oasis.emit('added-resources', this, resourceIds)
  }

  async removeResources(resourceIds: string | string[]) {
    resourceIds = Array.isArray(resourceIds) ? resourceIds : [resourceIds]

    this.log.debug('removing resources', resourceIds)
    const matchingSpaceContents = this.contentsValue.filter((entry) =>
      resourceIds.includes(entry.resource_id)
    )

    this.log.debug('removing matching entries from space...', matchingSpaceContents)
    await this.resourceManager.deleteSpaceEntries(matchingSpaceContents.map((entry) => entry.id))

    this.log.debug('removing resources from space contents store')
    this.contents.update((contents) => {
      return contents.filter((entry) => !resourceIds.includes(entry.resource_id))
    })

    this.log.debug('adding resources to space blacklist', resourceIds)
    await this.resourceManager.addItemsToSpace(
      this.id,
      matchingSpaceContents.map((entry) => entry.resource_id),
      SpaceEntryOrigin.Blacklisted
    )

    const removedResourceIds = matchingSpaceContents.map((entry) => entry.resource_id)
    this.log.debug('Resources removed:', removedResourceIds)
    this.oasis.emit('removed-resources', this, removedResourceIds)

    return removedResourceIds
  }
}

export class OasisService {
  spaces: Writable<OasisSpace[]>
  selectedSpace: Writable<string>

  everythingContents: Writable<Resource[]>
  loadingEverythingContents: Writable<boolean>
  selectedFilterTypeId: Writable<string | null>
  selectedFilterType: Readable<FilterItem | null>

  stackKey: Writable<{}>
  pendingStackActions: Array<{ resourceId: string; origin: { x: number; y: number } }>

  private eventEmitter: TypedEmitter<OasisEvents>
  tabsManager!: TabsManager
  resourceManager: ResourceManager
  config: ConfigService
  telemetry: Telemetry
  log: ReturnType<typeof useLogScope>

  constructor(resourceManager: ResourceManager, config: ConfigService) {
    this.log = useLogScope('OasisService')
    this.telemetry = resourceManager.telemetry
    this.resourceManager = resourceManager
    this.config = config
    this.eventEmitter = new EventEmitter() as TypedEmitter<OasisEvents>

    this.spaces = writable<OasisSpace[]>([])
    this.selectedSpace = writable<string>('all')

    this.everythingContents = writable([])
    this.loadingEverythingContents = writable(false)
    this.selectedFilterTypeId = writable<string | null>(null)

    this.stackKey = writable({})
    this.pendingStackActions = []

    this.selectedFilterType = derived(this.selectedFilterTypeId, (id) => {
      return RESOURCE_FILTERS.find((filter) => filter.id === id) ?? null
    })

    this.initSpaces()

    if (isDev) {
      // @ts-ignore
      window.oasis = this
    }
  }

  attachTabsManager(tabsManager: TabsManager) {
    this.tabsManager = tabsManager
  }

  private async initSpaces() {
    try {
      await this.loadSpaces()
    } catch (error) {
      this.log.error('Failed to load spaces:', error)
    }
  }

  private createSpaceObject(space: Space) {
    return new OasisSpace(space, this)
  }

  private createFakeSpace(data: SpaceData) {
    const fakeSpace = {
      name: data,
      id: generateID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted: 0
    } as Space

    const space = this.createSpaceObject(fakeSpace)
    this.log.debug('created fake space:', space)

    this.spaces.update((spaces) => {
      return [...spaces, space]
    })

    this.emit('created', space)

    return space
  }

  get spacesValue() {
    return get(this.spaces).map((space) => space.spaceValue)
  }

  on<E extends keyof OasisEvents>(event: E, listener: OasisEvents[E]): () => void {
    this.eventEmitter.on(event, listener)

    return () => {
      this.eventEmitter.off(event, listener)
    }
  }

  emit<E extends keyof OasisEvents>(event: E, ...args: Parameters<OasisEvents[E]>) {
    this.eventEmitter.emit(event, ...args)
  }

  triggerStoreUpdate(space: OasisSpace) {
    // trigger Svelte reactivity
    this.spaces.update((spaces) => {
      return spaces.map((s) => (s.id === space.id ? space : s))
    })
  }

  async loadSpaces() {
    this.log.debug('fetching spaces')
    let result = await this.resourceManager.listSpaces()

    // TODO: Felix — Continuation on felix/tempspace-removal: Remove all .tempspaces
    const filteredResult = result.filter((space) => space.name.folderName !== '.tempspace')
    result = filteredResult

    this.log.debug('fetched spaces:', result)

    const spaces = result
      // make sure each space has a index
      .map((space, idx) => {
        return {
          ...space,
          name: {
            ...space.name,
            index: space.name.index ?? idx
          }
        }
      })
      .sort((a, b) => (a.name.index ?? -1) - (b.name.index ?? -1))
      .map((space, idx) => ({ ...space, name: { ...space.name, index: idx } }))
      .map((space) => this.createSpaceObject(space))

    this.log.debug('loaded spaces:', spaces)

    this.spaces.set(spaces)
    return result
  }

  async createSpace(data: OptionalSpaceData) {
    this.log.debug('creating space')

    const defaults = {
      showInSidebar: false,
      liveModeEnabled: false,
      hideViewed: false,
      smartFilterQuery: null,
      sql_query: null,
      embedding_query: null,
      sortBy: 'created_at',
      builtIn: false,
      index: this.spacesValue.length,
      sources: []
    }

    const fullData = Object.assign({}, defaults, data)

    if (fullData.folderName === '.tempspace') {
      const space = this.createFakeSpace(fullData)
      return space
    }

    const result = await this.resourceManager.createSpace(fullData)
    if (!result) {
      this.log.error('failed to create space')
      throw new Error('Failed to create space')
    }

    const space = this.createSpaceObject(result)

    this.log.debug('created space:', space)
    this.spaces.update((spaces) => {
      return [...spaces, space]
    })

    this.emit('created', space)

    return space
  }

  async getSpace(spaceId: string, fresh = false) {
    const storedSpace = get(this.spaces).find((space) => space.id === spaceId)
    if (storedSpace && !fresh) {
      return storedSpace
    }

    const result = await this.resourceManager.getSpace(spaceId)
    if (!result) {
      this.log.error('space not found:', spaceId)
      return null
    }

    const space = this.createSpaceObject(result)
    this.spaces.update((spaces) => {
      return spaces.map((s) => (s.id === spaceId ? space : s))
    })

    this.log.debug('got space:', space)

    return space
  }

  async deleteSpace(spaceId: string) {
    this.log.debug('deleting space', spaceId)
    await this.resourceManager.deleteSpace(spaceId)

    this.log.debug('deleted space:', spaceId)

    const filtered = get(this.spaces).filter((space) => space.id !== spaceId)

    await Promise.all(filtered.map((space, idx) => space.updateIndex(idx)))

    this.spaces.set(filtered)

    if (get(this.selectedSpace) === spaceId && spaceId !== '.tempspace') {
      this.changeSelectedSpace('all')
    }

    await this.tabsManager.deleteScopedTabs(spaceId)

    this.emit('deleted', spaceId)
  }

  async updateSpaceData(id: string, updates: Partial<SpaceData>) {
    this.log.debug('updating space', id, updates)

    const space = await this.getSpace(id)
    if (!space) {
      this.log.error('space not found:', id)
      throw new Error('Space not found')
    }

    await space.updateData(updates)
    this.log.debug('updated space:', space)

    this.triggerStoreUpdate(space)

    return space
  }

  async addResourcesToSpace(spaceId: string, resourceIds: string[], origin: SpaceEntryOrigin) {
    this.log.debug('adding resources to space', spaceId, resourceIds)

    const space = await this.getSpace(spaceId)
    if (!space) {
      this.log.error('space not found:', spaceId)
      throw new Error('Space not found')
    }

    await space.addResources(resourceIds, origin)
    this.log.debug('added resources to space')

    this.triggerStoreUpdate(space)

    if (get(this.selectedSpace) === 'inbox') {
      this.log.debug('updating everything after resource was moved to a space')
      await this.loadEverything(false)
    }

    return space
  }

  async getSpaceContents(spaceId: string) {
    this.log.debug('getting space contents', spaceId)

    const space = await this.getSpace(spaceId)
    if (!space) {
      this.log.error('space not found:', spaceId)
      throw new Error('Space not found')
    }

    return space.fetchContents()
  }

  /** Deletes the provided resources from Oasis and gets rid of all references in any space */
  async deleteResourcesFromOasis(resourceIds: string | string[], confirmAction = true) {
    resourceIds = Array.isArray(resourceIds) ? resourceIds : [resourceIds]
    this.log.debug('removing resources', resourceIds)

    const resources = await Promise.all(
      resourceIds.map((id) => this.resourceManager.getResource(id))
    )
    const validResources = resources.filter((resource) => resource !== null) as Resource[]
    const validResourceIDs = validResources.map((resource) => resource.id)

    if (validResourceIDs.length === 0) {
      this.log.error('No valid resources found')
      return false
    }

    const allReferences = await Promise.all(
      validResourceIDs.map((id) => this.resourceManager.getAllReferences(id, this.spacesValue))
    )
    this.log.debug('all references:', allReferences)

    let totalNumberOfReferences = allReferences.reduce((sum, refs) => sum + refs.length, 0)

    const confirmMessage =
      totalNumberOfReferences > 0
        ? `${validResourceIDs.length > 1 ? `These ${validResourceIDs.length} resources` : `This resource`} will be removed from ${totalNumberOfReferences} space${totalNumberOfReferences > 1 ? 's' : ''} and deleted permanently.`
        : `This resource will be deleted permanently.`

    const confirmed = !confirmAction || window.confirm(confirmMessage)
    if (!confirmed) {
      return false
    }

    // turn the array of references into an array of spaces with the resources to remove
    const spacesWithReferences = allReferences
      .filter((references) => references.length > 0)
      .map((references, index) => {
        return {
          spaceId: references[0].folderId,
          resourceIds: references.map((ref) => ref.folderId)
        }
      })
      .filter((entry, index, self) => {
        return self.findIndex((e) => e.spaceId === entry.spaceId) === index
      })

    this.log.debug('deleting resource references from spaces', spacesWithReferences)
    await Promise.all(
      spacesWithReferences.map(async (entry, index) => {
        const space = await this.getSpace(entry.spaceId)
        if (space) {
          await space.removeResources(entry.resourceIds)
        }
      })
    )

    this.log.debug('deleting resources from oasis', validResourceIDs)
    await this.resourceManager.deleteResources(validResourceIDs)

    this.log.debug('removing resource bookmarks from tabs', validResourceIDs)
    await Promise.all(validResourceIDs.map((id) => this.tabsManager.removeResourceBookmarks(id)))

    this.log.debug('updating everything after resource deletion')
    this.everythingContents.update((contents) => {
      return contents.filter((resource) => !validResourceIDs.includes(resource.id))
    })

    await Promise.all(
      validResources.map((resource) =>
        this.telemetry.trackDeleteResource(
          resource.type,
          false,
          validResources.length > 1
            ? DeleteResourceEventTrigger.OasisMultiSelect
            : DeleteResourceEventTrigger.OasisItem
        )
      )
    )

    this.log.debug('deleted resources:', resourceIds)
    return resourceIds
  }

  /** Removes the provided resources from the space */
  async removeResourcesFromSpace(
    spaceId: string,
    resourceIds: string | string[],
    confirmAction = true
  ) {
    const space = await this.getSpace(spaceId)
    if (!space) {
      this.log.error('space not found:', spaceId)
      throw new Error('Space not found')
    }

    resourceIds = Array.isArray(resourceIds) ? resourceIds : [resourceIds]
    this.log.debug('removing resources', resourceIds)

    const resources = await Promise.all(
      resourceIds.map((id) => this.resourceManager.getResource(id))
    )

    const validResources = resources.filter((resource) => resource !== null) as Resource[]
    if (validResources.length === 0) {
      this.log.error('No valid resources found')
      return false
    }

    const confirmMessage = `Remove ${validResources.length > 1 ? 'these resources' : 'this resource'} from '${space?.dataValue.folderName}'? \n${validResources.length > 1 ? 'They' : 'It'} will still be in 'All my Stuff'.`
    const confirmed = !confirmAction || window.confirm(confirmMessage)
    if (!confirmed) {
      return false
    }

    this.log.debug('removing resource entries from space...', validResources)

    const removedResources = await space.removeResources(
      validResources.map((resource) => resource.id)
    )
    this.log.debug('removed resource entries from space', removedResources)

    this.triggerStoreUpdate(space)

    await Promise.all(
      validResources.map((resource) =>
        this.telemetry.trackDeleteResource(
          resource.type,
          true,
          validResources.length > 1
            ? DeleteResourceEventTrigger.OasisMultiSelect
            : DeleteResourceEventTrigger.OasisItem
        )
      )
    )

    this.log.debug('resources removed from space:', resourceIds)
    return removedResources
  }

  /** Remove a resource from a specific space, or from Stuff entirely if no space is provided.
   * throws: Error in various failure cases.
   */
  async removeResourcesFromSpaceOrOasis(resourceIds: string | string[], spaceId?: string) {
    resourceIds = Array.isArray(resourceIds) ? resourceIds : [resourceIds]
    this.log.debug('removing resources from', spaceId ?? 'oasis', resourceIds)

    if (spaceId) {
      return this.removeResourcesFromSpace(spaceId, resourceIds)
    } else {
      return this.deleteResourcesFromOasis(resourceIds)
    }
  }

  async loadEverything(initialLoad = false) {
    try {
      if (get(this.loadingEverythingContents)) {
        this.log.debug('Already loading everything')
        return
      }

      this.loadingEverythingContents.set(true)
      this.everythingContents.set([])
      await tick()

      if (initialLoad) {
        this.telemetry.trackOpenOasis()
      }

      const excludeAnnotations = !get(this.config.settings).show_annotations_in_oasis
      const selectedFilterType = get(this.selectedFilterType)

      this.log.debug('loading everything', selectedFilterType, { excludeAnnotations })
      const resources = await this.resourceManager.listResourcesByTags(
        [
          ResourceManager.SearchTagDeleted(false),
          ResourceManager.SearchTagResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
          ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING),
          ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.SILENT),
          ...conditionalArrayItem(selectedFilterType !== null, selectedFilterType?.tags ?? []),
          ...conditionalArrayItem(
            excludeAnnotations,
            ResourceManager.SearchTagResourceType(ResourceTypes.ANNOTATION, 'ne')
          )
        ],
        { includeAnnotations: true, excludeWithinSpaces: get(this.selectedSpace) === 'inbox' }
      )

      this.log.debug('Loaded everything:', resources)
      this.everythingContents.set(resources)

      return resources
    } catch (error) {
      this.log.error('Failed to load everything:', error)
      throw error
    } finally {
      this.loadingEverythingContents.set(false)
    }
  }

  changeSelectedSpace(spaceId: string) {
    this.selectedSpace.set(spaceId)
    this.selectedFilterTypeId.set(null)
  }

  async resetSelectedSpace() {
    this.changeSelectedSpace('all')
  }

  async createNewBrowsingSpace(
    trigger: ChangeContextEventTrigger,
    opts?: { switch?: boolean; newTab?: boolean }
  ) {
    const space = await this.createSpace({
      folderName: getFormattedDate(Date.now()),
      colors: pickRandomColorPair()
    })

    const options = Object.assign({ switch: true, newTab: true }, opts)

    if (options.switch) {
      await this.tabsManager.changeScope(space.id, trigger)
    }

    if (options.newTab) {
      this.tabsManager.showNewTabOverlay.set(1)
    }

    return space
  }

  reloadStack() {
    this.stackKey.set({})
  }

  /// For now we just give it the tabId, in the future this could be an actual action,
  /// depending on the state of the saving etc.
  pushPendingStackAction(
    resourceId: string,
    origin: { tabId?: string; xy?: { x: number; y: number } }
  ) {
    if (origin.tabId) {
      const tabEl = document.getElementById(`tab-${origin.tabId}`)
      if (tabEl) {
        const rect = tabEl.getBoundingClientRect()
        this.pendingStackActions.push({ resourceId, origin: { x: rect.left, y: rect.top } })
      }
    } else if (origin.xy) {
      this.pendingStackActions.push({ resourceId, origin: origin.xy })
    }
  }

  async moveSpaceToIndex(spaceId: string, index: number) {
    const space = await this.getSpace(spaceId)
    if (!space) {
      this.log.error('space not found:', spaceId)
      throw new Error('Space not found')
    }

    this.log.debug('moving space', spaceId, 'to index', index)

    // adjust the index of the space and all other spaces that are affected by the change
    const spaces = get(this.spaces)

    // place the space at the new index
    spaces.splice(space.indexValue, 1)

    // adjust the index of the other spaces
    spaces.splice(index, 0, space)

    // update the index of all spaces
    await Promise.all(
      spaces.map(async (space, idx) => {
        if (space.indexValue !== idx) {
          await space.updateIndex(idx)
        }
      })
    )

    await tick()

    this.log.debug('moved space', spaceId, 'to index', index, this.spacesValue)
  }

  static provide(resourceManager: ResourceManager, config: ConfigService) {
    const service = new OasisService(resourceManager, config)

    setContext('oasis', service)

    return service
  }

  static use() {
    return getContext<OasisService>('oasis')
  }
}

export const colorPairs: [string, string][] = [
  ['#76E0FF', '#4EC9FB'],
  ['#76FFB4', '#4FFBA0'],
  ['#7FFF76', '#4FFA4C'],
  ['#D8FF76', '#BAFB4E'],
  ['#FFF776', '#FBE24E'],
  ['#FFE076', '#FBC94E'],
  ['#FFBA76', '#FB8E4E'],
  ['#FF7676', '#FB4E4E'],
  ['#FF76BA', '#FB4EC9'],
  ['#D876FF', '#BA4EFB'],
  ['#7676FF', '#4E4EFB'],
  ['#76B4FF', '#4EA0FB'],
  ['#76FFE0', '#4EFBC9'],
  ['#76FFD8', '#4EFBBF'],
  ['#76FFF7', '#4EFBE2'],
  ['#76FFB4', '#4FFBA0'],
  ['#76FF76', '#4FFB4E'],
  ['#A4FF76', '#8EFB4E'],
  ['#FFF776', '#FBE24E'],
  ['#FFE076', '#FBC94E']
]

export const pickRandomColorPair = (): [string, string] => {
  return colorPairs[Math.floor(Math.random() * colorPairs.length)]
}

export const useOasis = OasisService.use
export const provideOasis = OasisService.provide
