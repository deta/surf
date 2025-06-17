import { getContext, setContext, tick } from 'svelte'
import { derived, get, writable, type Readable, type Writable } from 'svelte/store'
import { openDialog } from '../components/Core/Dialog/Dialog.svelte'
import { isBuiltInSpaceId } from '../constants/spaces'

import {
  conditionalArrayItem,
  generateID,
  getFormattedDate,
  isDev,
  useLogScope,
  wait,
  useLocalStorageStore
} from '@horizon/utils'

import {
  ChangeContextEventTrigger,
  CreateSpaceEventFrom,
  DeleteResourceEventTrigger,
  ResourceTypes
} from '@horizon/types'

import {
  SpaceEntryOrigin,
  type Optional,
  type Space,
  type SpaceData,
  type SpaceEntry,
  type SpaceEntrySearchOptions,
  type TabPage,
  type CreateSubSpaceRequest,
  type MoveResourceRequest
} from '../types'

import { type ResourceManager, ResourceNote, type Resource } from './resources'
import type { Telemetry } from './telemetry'
import type { TabsManager } from './tabs'
import type { FilterItem } from '../components/Oasis/FilterSelector.svelte'
import { blobToSmallImageUrl } from '../utils/screenshot'
import type { ConfigService } from './config'
import { ALL_FILTERS } from '../constants/resourceFilters'
import type { SpaceBasicData } from './ipc/events'
import { createContextService, type ContextService } from './contexts'
import { addSelectionById } from '../components/Oasis/utils/select'
import { SavingItem, type SaveItemMetadata } from './saving'
import type { SmartNoteManager } from './ai/note'
import { ClipboardService } from './clipboard'
import { checkBrowsingContextSelectionNeeded, migrateSpaceBrowsingContext } from './migration'
import { BuiltInSpaces, BuiltInSpaceId } from '../constants/spaces'
import { EventEmitterBase } from './events'
import { SearchResourceTags } from '@horizon/core/src/lib/utils/tags'

export type OasisEvents = {
  created: (space: OasisSpace) => void
  updated: (space: OasisSpace, changes: Partial<SpaceData>) => void
  'added-resources': (space: OasisSpace, resourceIds: string[]) => void
  'removed-resources': (space: OasisSpace, resourceIds: string[]) => void
  deleted: (spaceId: string) => void
  'changed-active-space': (space: OasisSpace | null) => void
  'reload-space': (spaceId: string) => void
}

export type OptionalSpaceData = Optional<
  SpaceData,
  | 'default'
  | 'showInSidebar'
  | 'liveModeEnabled'
  | 'smartFilterQuery'
  | 'sortBy'
  | 'viewType'
  | 'viewDensity'
  | 'sources'
  | 'sql_query'
  | 'embedding_query'
  | 'builtIn'
>

export const getSpaceIconString = (space: SpaceData) => {
  if (space.icon) {
    return `icon;;${space.icon}`
  }
  if (space.emoji) {
    return `emoji;;${space.emoji}`
  } else if (space.imageIcon) {
    return `image;;${space.imageIcon}`
  } else {
    const [color1, color2] = space.colors ?? pickRandomColorPair()
    return `colors;;${color1};;${color2}`
  }
}

export class OasisSpace {
  id: string
  createdAt: string
  updatedAt: string
  deleted: number
  isBuiltInSpace: boolean

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
  // TODO: what is the type of this?
  builtInSpaceStore: any

  constructor(space: Space, oasis: OasisService, isBuiltInSpace = false) {
    this.id = space.id
    this.createdAt = space.created_at
    this.updatedAt = space.updated_at
    this.deleted = space.deleted

    this.contents = writable<SpaceEntry[]>([])

    this.log = useLogScope(`OasisSpace ${this.id}`)
    this.oasis = oasis
    this.resourceManager = oasis.resourceManager
    this.telemetry = oasis.telemetry

    this.isBuiltInSpace = isBuiltInSpace
    if (isBuiltInSpace) {
      const localStorageKey = `builtInSpace_${this.id}`
      this.builtInSpaceStore = useLocalStorageStore<SpaceData>(localStorageKey, space.name, true)
      this.data = {
        set: (value: SpaceData) => {
          this.builtInSpaceStore?.set(value)
        },
        update: (fn: (value: SpaceData) => SpaceData) => {
          this.builtInSpaceStore?.update(fn)
        },
        subscribe: (run: (value: SpaceData) => void) => {
          return this.builtInSpaceStore?.subscribe(run) || (() => {})
        }
      }
    } else {
      this.data = writable<SpaceData>(space.name)
    }
    this.index = derived(this.data, ($data) => $data.index ?? -1)
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

    if (!this.isBuiltInSpace) {
      await this.resourceManager.updateSpace(this.id, data)
    }

    this.oasis.triggerStoreUpdate(this)
    this.oasis.emit('updated', this, updates)
  }

  async updateIndex(index: number) {
    this.log.debug('updating space index', index)

    await this.updateData({ index })
  }

  async fetchContents(opts?: SpaceEntrySearchOptions) {
    this.log.debug('getting space contents')
    const result = await this.resourceManager.getSpaceContents(this.id, opts)

    this.log.debug('got space contents:', result)
    this.contents.set(result)
    return result
  }

  async addResources(resourceIds: string[], origin: SpaceEntryOrigin) {
    this.log.debug('adding resources to space', resourceIds, origin)
    await this.resourceManager.addItemsToSpace(this.id, resourceIds, origin)

    this.log.debug('added resources to space, updating contents')
    await this.fetchContents()

    this.oasis.emit('added-resources', this, resourceIds)
  }

  async removeResources(resourceIds: string | string[]) {
    resourceIds = Array.isArray(resourceIds) ? resourceIds : [resourceIds]

    this.log.debug('removing resources', resourceIds)

    await this.resourceManager.sffs.deleteEntriesInSpaceByEntryIds(this.id, resourceIds)

    this.log.debug('removing resources from space contents store')
    this.contents.update((contents) => {
      return contents.filter((entry) => !resourceIds.includes(entry.entry_id))
    })
    this.log.debug('Resources removed:', resourceIds)
    this.oasis.emit('removed-resources', this, resourceIds)
    return resourceIds
  }

  async useResourceAsIcon(resourceId: string) {
    const resource = await this.resourceManager.getResource(resourceId)
    if (!resource) {
      this.log.error('Resource not found')
      return
    }

    if (!resource.type.startsWith('image/')) {
      this.log.error('Resource is not an image')
      return
    }

    const blob = await resource.getData()
    if (!blob) {
      this.log.error('Resource data not found')
      return
    }

    const base64 = await blobToSmallImageUrl(blob)
    if (!base64) {
      this.log.error('Failed to convert blob to base64')
      return
    }

    await this.oasis.updateSpaceData(this.id, {
      emoji: undefined,
      imageIcon: base64
    })
  }

  getIconString() {
    return getSpaceIconString(this.dataValue)
  }
}

export class OasisService extends EventEmitterBase<OasisEvents> {
  spaces: Writable<OasisSpace[]>
  selectedSpace: Writable<string>
  detailedResource: Writable<Resource | null>

  everythingContents: Writable<Resource[]>
  loadingEverythingContents: Writable<boolean>
  selectedFilterTypeId: Writable<string | null>
  selectedFilterType: Readable<FilterItem | null>
  sortedSpacesList: Readable<{ pinned: OasisSpace[]; linked: OasisSpace[]; unpinned: OasisSpace[] }>
  sortedSpacesListFlat: Readable<OasisSpace[]>

  stackKey: Writable<{}>
  pendingSave: Writable<SavingItem | null>
  pendingSaveTimeout: ReturnType<typeof setTimeout> | null
  pendingStackActions: Array<{ resourceId: string; origin: { x: number; y: number } }>

  tabsManager!: TabsManager
  resourceManager: ResourceManager
  smartNotes: SmartNoteManager
  config: ConfigService
  contextService: ContextService
  clipboardService!: ClipboardService
  telemetry: Telemetry
  log: ReturnType<typeof useLogScope>

  navigationHistory: Writable<string[]>
  canNavigateBack: Readable<boolean>

  static self: OasisService
  private builtInSpaces: Record<BuiltInSpaceId, OasisSpace>

  constructor(
    resourceManager: ResourceManager,
    config: ConfigService,
    smartNotes: SmartNoteManager
  ) {
    super()
    this.log = useLogScope('OasisService')
    this.telemetry = resourceManager.telemetry
    this.resourceManager = resourceManager
    this.smartNotes = smartNotes
    this.config = config

    this.spaces = writable<OasisSpace[]>([])
    this.selectedSpace = writable<string>(this.defaultSpaceID)
    this.detailedResource = writable<Resource | null>(null)

    this.everythingContents = writable([])
    this.loadingEverythingContents = writable(false)
    // Run migration for browsing context defaults
    this.migrateBrowsingContextDefaults()
    this.selectedFilterTypeId = writable<string | null>(null)

    this.stackKey = writable({})
    this.pendingSave = writable(null)
    this.pendingSaveTimeout = null
    this.pendingStackActions = []

    this.selectedFilterType = derived(this.selectedFilterTypeId, (id) => {
      return ALL_FILTERS.find((filter) => filter.id === id) ?? null
    })

    this.contextService = createContextService(this)

    // Initialize the clipboard service
    this.clipboardService = new ClipboardService(this)

    this.sortedSpacesList = derived(
      [this.spaces, this.contextService.rankedSpaces, this.config.settings],
      ([$spaces, $sourceSpaces, $userSettings]) => {
        const filteredSpaces = $spaces
          .filter(
            (space) => space.dataValue.folderName !== '.tempspace' && !isBuiltInSpaceId(space.id)
          )
          .sort((a, b) => {
            return a.indexValue - b.indexValue
          })

        const pinnedSpaces = filteredSpaces.filter((space) => space.dataValue.pinned)

        const unpinnedSpaces = filteredSpaces.filter((space) => {
          if ($userSettings.experimental_context_linking) {
            return (
              $sourceSpaces.findIndex((s) => s.id === space.id) === -1 && !space.dataValue.pinned
            )
          }

          return !space.dataValue.pinned
        })

        const sourceSpaces = $sourceSpaces.filter(
          (space) => pinnedSpaces.findIndex((s) => s.id === space.id) === -1
        )

        return {
          pinned: pinnedSpaces,
          linked: $userSettings.experimental_context_linking ? sourceSpaces : [],
          unpinned: unpinnedSpaces
        }
      }
    )

    this.sortedSpacesListFlat = derived(this.sortedSpacesList, (sorted) => {
      return [...sorted.pinned, ...sorted.linked, ...sorted.unpinned]
    })

    this.initSpaces()

    this.builtInSpaces = BuiltInSpaces.reduce(
      (acc, space) => {
        const id = space.id as BuiltInSpaceId
        acc[id] = this.createSpaceObject(space, true)
        return acc
      },
      {} as Record<BuiltInSpaceId, OasisSpace>
    )

    this.navigationHistory = writable<string[]>([])
    this.canNavigateBack = derived(this.navigationHistory, ($history) => $history.length > 0)

    if (isDev) {
      // @ts-ignore
      window.oasis = this
    }
  }

  attachTabsManager(tabsManager: TabsManager) {
    this.tabsManager = tabsManager
  }

  private async initSpaces() {
    await this.loadSpaces()

    // Run migrations
    await this.migrateBrowsingContextDefaults()

    // Check if we need to show the interactive browsing context selection
    // This will set up the stores that the UI can use to show the selection dialog
    const selectionNeeded = await checkBrowsingContextSelectionNeeded({ oasis: this })

    // If selection is not needed (either because migration is already done or there are no spaces to migrate),
    // run the fallback migration which will set all spaces with nestingData to have browsing context enabled
    if (!selectionNeeded) {
      await migrateSpaceBrowsingContext({ oasis: this })
    }
    // Otherwise, the UI will handle showing the selection dialog and calling applyBrowsingContextSelection
  }

  /**
   * Migrate spaces to set default useAsBrowsingContext values
   * This ensures that existing spaces have the correct browsing context settings
   * and prevents all contexts from appearing in the browsing contexts dropdown
   */
  private async migrateBrowsingContextDefaults() {
    try {
      // Wait for spaces to be loaded
      await this.loadSpaces()
      const spaces = get(this.spaces)

      // Check if we have any spaces without useAsBrowsingContext set
      const spacesNeedingMigration = spaces.filter(
        (space) => space.dataValue.useAsBrowsingContext === undefined
      )

      // If we have spaces that need migration, reset the migration flags
      if (spacesNeedingMigration.length > 0) {
        this.log.debug(
          `Found ${spacesNeedingMigration.length} spaces without useAsBrowsingContext set, resetting migration flags`
        )
        localStorage.removeItem('browsing_context_migration_completed')
        localStorage.removeItem('migratedSpaceBrowsingContext')
      } else {
        // Check if migration has already been completed
        const migrationCompleted = localStorage.getItem('browsing_context_migration_completed')
        if (migrationCompleted === 'true') {
          this.log.debug('Browsing context migration already completed')
          return
        }
      }

      this.log.debug('Starting browsing context migration')

      // Track if we made any changes
      let changesMade = false

      // Process each space
      for (const space of spaces) {
        const spaceData = space.dataValue

        // Only process spaces that don't have useAsBrowsingContext set
        if (spaceData.useAsBrowsingContext === undefined) {
          // By default, set useAsBrowsingContext to false
          // This ensures spaces don't automatically appear in the browsing contexts dropdown
          await space.updateData({
            useAsBrowsingContext: false
          })

          changesMade = true
          this.log.debug(`Set useAsBrowsingContext to false for space: ${space.id}`)
        }
      }

      // Only mark migration as completed if we didn't find any spaces needing migration
      if (spacesNeedingMigration.length === 0) {
        localStorage.setItem('browsing_context_migration_completed', 'true')
      }

      if (changesMade) {
        this.log.debug('Browsing context migration completed with changes')
      } else {
        this.log.debug('Browsing context migration completed with no changes needed')
      }
    } catch (error) {
      this.log.error('Error during browsing context migration:', error)
    }
  }

  reloadSpace(spaceId: string) {
    this.emit('reload-space', spaceId)
  }

  private createSpaceObject(space: Space, builtInSpace: boolean = false) {
    return new OasisSpace(space, this, builtInSpace)
  }

  getActiveSpace() {
    return (
      get(this.spaces).find((space) => space.id === this.tabsManager.activeScopeIdValue) ?? null
    )
  }

  createFakeSpace(data: Partial<SpaceData>, id?: string, skipUpdate = false) {
    const fullData = {
      showInSidebar: false,
      liveModeEnabled: false,
      smartFilterQuery: null,
      sql_query: null,
      embedding_query: null,
      sortBy: 'resource_added_to_space',
      builtIn: false,
      index: this.spacesValue.length,
      sources: [],
      ...data
    }

    const fakeSpace = {
      name: fullData,
      id: id ?? generateID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted: 0
    } as Space

    const space = this.createSpaceObject(fakeSpace)
    this.log.debug('created fake space:', space)

    if (!skipUpdate) {
      this.spaces.update((spaces) => {
        return [...spaces, space]
      })
    }

    this.emit('created', space)

    return space
  }

  get spacesValue() {
    return get(this.spaces).map((space) => space.spaceValue)
  }

  get spacesObjectsValue() {
    return get(this.spaces)
  }

  get sortedSpacesListValue() {
    return get(this.sortedSpacesList)
  }

  get sortedSpacesListFlatValue() {
    return get(this.sortedSpacesListFlat)
  }

  get pendingSaveValue() {
    return get(this.pendingSave)
  }

  get defaultSpaceID() {
    if (this.config.settingsValue.save_to_active_context) {
      return BuiltInSpaceId.Everything
    } else {
      return BuiltInSpaceId.Inbox
    }
  }

  get navigationHistoryValue() {
    return get(this.navigationHistory)
  }

  get canNavigateBackValue() {
    return get(this.canNavigateBack)
  }

  updateMainProcessSpacesList() {
    const { pinned, unpinned, linked } = this.sortedSpacesListValue

    const pinnedItems = pinned.map(
      (space) =>
        ({
          id: space.id,
          name: space.dataValue.folderName,
          pinned: true,
          linked: false
        }) as SpaceBasicData
    )

    const linkedItems = linked.map(
      (space) =>
        ({
          id: space.id,
          name: space.dataValue.folderName,
          pinned: false,
          linked: true
        }) as SpaceBasicData
    )

    const unpinnedItems = unpinned.map(
      (space) =>
        ({
          id: space.id,
          name: space.dataValue.folderName,
          pinned: false,
          linked: false
        }) as SpaceBasicData
    )

    const items = [...pinnedItems, ...linkedItems, ...unpinnedItems].filter(
      (e) => e.id !== 'all' && e.id !== 'inbox' && e.name?.toLowerCase() !== '.tempspace'
    )

    this.log.debug('updating spaces list in main process', items)
    window.api.updateSpacesList(items)
  }

  triggerStoreUpdate(space: OasisSpace) {
    // trigger Svelte reactivity
    this.spaces.update((spaces) => {
      return spaces.map((s) => (s.id === space.id ? space : s))
    })

    tick().then(() => {
      this.updateMainProcessSpacesList()
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

    tick().then(() => {
      this.updateMainProcessSpacesList()
    })

    return result
  }

  async createSpace(data: OptionalSpaceData, parentId?: string) {
    this.log.debug('creating space', parentId ? 'as subfolder of ' + parentId : '')

    const defaults = {
      showInSidebar: false,
      liveModeEnabled: false,
      smartFilterQuery: null,
      sql_query: null,
      embedding_query: null,
      sortBy: 'resource_added_to_space',
      builtIn: false,
      default: false,
      index: this.spacesValue.length,
      sources: []
    }

    // Create a copy of the data to avoid modifying the original
    let fullData = Object.assign({}, defaults, data)

    let parentSpace: OasisSpace | undefined | null = null
    let parentData: SpaceData | null = null

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

    if (parentId && parentSpace && parentData) {
      await this.resourceManager.sffs.addSubspacesToSpace(
        parentId,
        [space.id],
        SpaceEntryOrigin.ManuallyAdded
      )
    }
    await this.loadSpaces()
    this.emit('created', space)
    return space
  }

  async getSpace(spaceId: string, fresh = false) {
    const builtInSpace = this.builtInSpaces[spaceId as BuiltInSpaceId]
    if (builtInSpace) {
      return builtInSpace
    }
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

    // Proceed with normal space deletion
    await this.resourceManager.deleteSpace(spaceId)

    this.log.debug('deleted space:', spaceId)

    const filtered = get(this.spaces).filter((space) => space.id !== spaceId)

    await Promise.all(filtered.map((space, idx) => space.updateIndex(idx)))

    this.spaces.set(filtered)

    if (get(this.selectedSpace) === spaceId && spaceId !== '.tempspace') {
      this.changeSelectedSpace(this.defaultSpaceID)
    }

    await this.tabsManager.deleteScopedTabs(spaceId)
    await this.loadSpaces()
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
    // built in space is no-op
    if (isBuiltInSpaceId(spaceId)) {
      return
    }

    this.log.debug('adding resources to space', spaceId, resourceIds, origin)

    const space = await this.getSpace(spaceId)
    if (!space) {
      this.log.error('space not found:', spaceId)
      throw new Error('Space not found')
    }

    await space.addResources(resourceIds, origin)
    this.log.debug('added resources to space')
    this.triggerStoreUpdate(space)
    return space
  }

  /**
   * Get the contents of a space
   * @param spaceId The space ID to get contents for
   * @param opts Optional search options
   * @param includeFolderData Whether to include folder-specific data (child folders, path)
   * @returns The space contents or folder contents response
   */
  async getSpaceContents(spaceId: string, opts?: SpaceEntrySearchOptions) {
    this.log.debug('getting space contents', spaceId)
    const space = await this.getSpace(spaceId)
    if (!space) {
      this.log.error('space not found:', spaceId)
      throw new Error('Space not found')
    }
    return await space.fetchContents(opts)
  }

  /**
   * Fetches note resources from a specific space
   * @param spaceId - ID of the space to fetch notes from
   * @returns Array of ResourceNote objects from the space
   */
  async fetchNoteResourcesFromSpace(spaceId: string) {
    this.log.debug('Fetching note resources for space:', spaceId)

    // Get the space
    const space = await this.getSpace(spaceId)
    if (!space) {
      this.log.error('Space not found:', spaceId)
      return []
    }

    // Get space contents
    const spaceContents = (await space.fetchContents()) ?? []

    // Extract IDs of note resources
    const noteIds = spaceContents
      .filter(
        (entry) =>
          entry.manually_added !== SpaceEntryOrigin.Blacklisted &&
          entry.resource_type === ResourceTypes.DOCUMENT_SPACE_NOTE
      )
      .map((entry) => entry.entry_id)

    // Load all note resources in parallel
    const resources = await Promise.all(noteIds.map((id) => this.resourceManager.getResource(id)))

    // Filter valid resources
    const filteredResources = resources.filter(Boolean) as ResourceNote[]

    return filteredResources
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
        ? `${
            validResourceIDs.length > 1
              ? `These ${validResourceIDs.length} resources`
              : `This resource`
          } will be removed from ${totalNumberOfReferences} space${
            totalNumberOfReferences > 1 ? 's' : ''
          } and deleted permanently.`
        : `${validResourceIDs.length > 1 ? 'These' : 'This'} resource${
            validResourceIDs.length > 1 ? 's' : ''
          } will be deleted permanently.`

    const { closeType: confirmed } = !confirmAction
      ? { closeType: true }
      : await openDialog({
          title: `Delete ${validResourceIDs.length} Resource${
            validResourceIDs.length > 1 ? 's' : ''
          }`,
          message: confirmMessage,
          actions: [
            { title: 'Cancel', type: 'reset' },
            { title: 'Delete', type: 'submit', kind: 'danger' }
          ]
        })

    if (!confirmed) {
      return false
    }

    // turn the array of references into an array of spaces with the resources to remove
    const spacesWithReferences = allReferences
      .filter((references) => references.length > 0)
      .map((references) => {
        return {
          spaceId: references[0].folderId,
          resourceIds: references.map((ref) => ref.resourceId)
        }
      })
      .filter((entry, index, self) => {
        return self.findIndex((e) => e.spaceId === entry.spaceId) === index
      })

    this.log.debug('deleting resource references from spaces', spacesWithReferences)
    await Promise.all(
      spacesWithReferences.map(async (entry) => {
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

    this.log.debug('removing deleted smart notes', validResourceIDs)
    this.smartNotes.handleDeletedResources(validResourceIDs)

    if (
      this.pendingSaveValue?.resourceValue?.id &&
      validResourceIDs.includes(this.pendingSaveValue.resourceValue.id)
    ) {
      this.log.debug('pending save resource was deleted, clearing pending save')
      await this.removePendingSave()
    }

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

    const confirmMessage = `Remove ${
      validResources.length > 1 ? 'these resources' : 'this resource'
    } from '${space?.dataValue.folderName}'? \n${
      validResources.length > 1 ? 'They' : 'It'
    } will still be in 'All my Stuff'.`
    const { closeType: confirmed } = !confirmAction
      ? { closeType: true }
      : await openDialog({
          title: `Remove ${validResources.length} Resource${validResources.length > 1 ? 's' : ''}`,
          message: confirmMessage,
          actions: [
            { title: 'Cancel', type: 'reset' },
            { title: 'Remove', type: 'submit', kind: 'danger' }
          ]
        })

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
  async removeResourcesFromSpaceOrOasis(
    resourceIds: string | string[],
    spaceId?: string,
    confirmAction = true
  ) {
    resourceIds = Array.isArray(resourceIds) ? resourceIds : [resourceIds]
    this.log.debug('removing resources from', spaceId ?? 'oasis', resourceIds)

    if (!spaceId) {
      return this.deleteResourcesFromOasis(resourceIds, confirmAction)
    }
    return this.removeResourcesFromSpace(spaceId, resourceIds, confirmAction)
  }

  async loadEverything() {
    try {
      if (get(this.loadingEverythingContents)) {
        this.log.debug('Already loading everything')
        return
      }

      this.loadingEverythingContents.set(true)
      this.everythingContents.set([])
      await tick()

      const excludeAnnotations = !get(this.config.settings).show_annotations_in_oasis
      const selectedFilterType = get(this.selectedFilterType)

      this.log.debug('loading everything', selectedFilterType, { excludeAnnotations })
      const resources = await this.resourceManager.listResourcesByTags(
        [
          ...SearchResourceTags.NonHiddenDefaultTags({ excludeAnnotations: excludeAnnotations }),
          ...conditionalArrayItem(selectedFilterType !== null, selectedFilterType?.tags ?? []),
          ...conditionalArrayItem(
            get(this.selectedSpace) === 'notes',
            SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE)
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

  async changeSelectedSpace(spaceId: string) {
    this.selectedSpace.set(spaceId)
    this.selectedFilterTypeId.set(null)

    // Automatically set useAsBrowsingContext to true when a space is selected
    await this.ensureSpaceIsBrowsingContext(spaceId)
  }

  /**
   * Ensures that a space is marked as a browsing context
   * This is called automatically when a space is selected
   * @param spaceId The ID of the space to ensure is a browsing context
   */
  async ensureSpaceIsBrowsingContext(spaceId: string): Promise<void> {
    try {
      const space = await this.getSpace(spaceId)
      if (!space) return

      const spaceData = space.dataValue
      const nestingData = spaceData.nestingData

      if (nestingData && spaceData.useAsBrowsingContext === undefined) {
        this.log.debug('Automatically setting useAsBrowsingContext to true for space:', spaceId)
        await this.toggleBrowsingContext(spaceId, true)
      }
    } catch (error) {
      this.log.error('Error ensuring space is browsing context:', error)
    }
  }

  async resetSelectedSpace() {
    this.changeSelectedSpace(this.defaultSpaceID)
  }

  async createNewBrowsingSpace(
    trigger: ChangeContextEventTrigger,
    createFrom: CreateSpaceEventFrom,
    opts?: { switch?: boolean; newTab?: boolean }
  ) {
    const space = await this.createSpace({
      folderName: getFormattedDate(Date.now()),
      colors: pickRandomColorPair()
    })

    this.telemetry.trackCreateSpace(createFrom, {
      isLiveSpace: false,
      createdUsingAI: false,
      numberOfPrompts: 0,
      numberOfBlacklistedItems: 0
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

  async moveSpaceToIndex(spaceId: string, targetIndex: number) {
    const space = await this.getSpace(spaceId)
    if (!space) {
      this.log.error('space not found:', spaceId)
      throw new Error('Space not found')
    }

    const spaces = get(this.spaces)
    const currentIndex = spaces.findIndex((s) => s.id === spaceId)

    if (currentIndex === -1) {
      throw new Error('Space not found in spaces array')
    }

    const clampedTargetIndex = Math.min(Math.max(0, targetIndex), spaces.length - 1)

    if (currentIndex === clampedTargetIndex) return

    this.log.debug(
      'moving space',
      spaceId,
      'from index',
      currentIndex,
      'to index',
      clampedTargetIndex,
      targetIndex !== clampedTargetIndex ? `(clamped from ${targetIndex})` : ''
    )

    const newSpaces = [...spaces]
    const [movedSpace] = newSpaces.splice(currentIndex, 1)
    newSpaces.splice(clampedTargetIndex, 0, movedSpace)

    try {
      const updates = newSpaces
        .map((space, index) => ({ space, index }))
        .filter(({ space, index }) => space.indexValue !== index)

      await Promise.all(updates.map(({ space, index }) => space.updateIndex(index)))

      this.spaces.set(newSpaces)

      this.log.debug('moved space', spaceId, 'to index', targetIndex)
    } catch (error) {
      this.log.error('failed to move space:', error)
      throw new Error('Failed to move space')
    }
  }

  /**
   *
   * @param resourceOrId resource or resource id
   * @param opts - options
   * @param opts.select - whether to select the resource in the sidebar
   * @param opts.selectedSpace - the space to select, or 'auto' to select the space that contains the resource
   */
  async openResourceDetailsSidebar(
    resourceOrId: Resource | string,
    opts?: { select?: boolean; selectedSpace?: 'auto' | string }
  ) {
    const resource =
      typeof resourceOrId === 'string'
        ? await this.resourceManager.getResource(resourceOrId)
        : resourceOrId
    if (!resource) {
      this.log.error('Resource not found')
      return
    }

    let selectedSpace: string | undefined = undefined

    if (opts?.selectedSpace === 'auto') {
      if (
        this.tabsManager.activeScopeIdValue &&
        resource.spaceIdsValue.includes(this.tabsManager.activeScopeIdValue)
      ) {
        selectedSpace = this.tabsManager.activeScopeIdValue
      } else if (resource.spaceIdsValue.length === 1) {
        selectedSpace = resource.spaceIdsValue[0]
      }
    } else if (opts?.selectedSpace) {
      selectedSpace = opts?.selectedSpace
    }

    const options = {
      select: opts?.select ?? true,
      selectedSpace: selectedSpace
    }

    this.log.debug('Opening resource details sidebar', resource, options)

    if (this.tabsManager.showNewTabOverlayValue !== 2) {
      this.tabsManager.showNewTabOverlay.set(2)

      if (!options.selectedSpace) {
        this.selectedSpace.set(BuiltInSpaceId.Everything)
      }
    }

    if (options.selectedSpace) {
      this.selectedSpace.set(options.selectedSpace)
    }

    this.detailedResource.set(resource)

    if (options.select) {
      await wait(300)
      addSelectionById(resource.id, { removeOthers: true })
    }
  }

  addPendingSave(data: SaveItemMetadata, resource?: Resource) {
    this.log.debug('Adding pending save', resource)

    const item = new SavingItem(
      { resourceManager: this.resourceManager, oasis: this },
      data,
      resource
    )

    this.pendingSave.set(item)

    item.on('destroy', () => {
      this.pendingSave.set(null)
    })

    return item
  }

  addPendingSaveTab(tab: TabPage, resource?: Resource) {
    this.log.debug('Adding pending save tab', tab, resource)

    return this.addPendingSave(
      {
        title: tab.title,
        description: '',
        url: tab.currentLocation || tab.initialLocation,
        icon: `image;;${tab.icon}`
      },
      resource
    )
  }

  async removePendingSave() {
    this.log.debug('Removing pending save')
    await this.pendingSaveValue?.destroy()
    this.pendingSave.set(null)
  }

  static provide(
    resourceManager: ResourceManager,
    config: ConfigService,
    smartNotes: SmartNoteManager
  ) {
    const service = new OasisService(resourceManager, config, smartNotes)
    if (!OasisService.self) OasisService.self = service

    setContext('oasis', service)
    setContext('clipboard', service.clipboardService)
    ;(window as any).__oasisService = service

    return service
  }

  static use() {
    if (!OasisService.self) return getContext<OasisService>('oasis')
    return OasisService.self
  }

  /**
   * Create a new subfolder within a parent folder
   * @param request The subfolder creation request
   * @returns The newly created subfolder space
   */
  async createSubSpace(request: CreateSubSpaceRequest): Promise<OasisSpace | null> {
    try {
      return await this.createSpace(
        {
          folderName: request.name,
          description: request.description,
          emoji: request.emoji,
          colors: request.colors,
          showInSidebar: false,
          liveModeEnabled: false,
          smartFilterQuery: null,
          sql_query: null,
          embedding_query: null,
          useAsBrowsingContext: request.useAsBrowsingContext ?? false
        },
        request.parentId
      )
    } catch (error) {
      this.log.error('Error creating subfolder:', error)
      return null
    }
  }

  /**
   * Move a resource from one space to another
   * @param request The move resource request
   * @returns True if successful, false otherwise
   */
  async moveResource(request: MoveResourceRequest): Promise<boolean> {
    try {
      const { resourceId, sourceId, targetId } = request

      // Check if source and target folders exist
      const sourceFolder = await this.getSpace(sourceId)
      const targetFolder = await this.getSpace(targetId)

      if (!sourceFolder || !targetFolder) {
        this.log.error('Source or target folder not found')
        return false
      }

      // Remove resource from source folder
      await sourceFolder.removeResources(resourceId)

      // Add resource to target folder
      await targetFolder.addResources([resourceId], SpaceEntryOrigin.ManuallyAdded)

      return true
    } catch (error) {
      this.log.error('Error moving resource:', error)
      return false
    }
  }

  /**
   * Move a resource from its current space to another space
   * @param resourceId The ID of the resource to move
   * @param targetSpaceId The ID of the target space to move the resource to
   * @param sourceSpaceId Optional ID of the source space where the resource is currently located
   *                     If not provided, will attempt to find the first space containing the resource
   * @returns True if successful, false otherwise
   */
  async moveResourceToSpace(
    resourceId: string,
    targetSpaceId: string,
    sourceSpaceId?: string
  ): Promise<boolean> {
    try {
      this.log.debug('Moving resource to space:', resourceId, 'to', targetSpaceId)

      // Use provided sourceSpaceId if available, otherwise find which space contains the resource
      let foundSourceSpaceId: string | null = sourceSpaceId || null

      // If no sourceSpaceId was provided, search for it
      if (!foundSourceSpaceId) {
        const allSpaces = get(this.spaces)

        // Look through all spaces to find where this resource exists
        for (const space of allSpaces) {
          if (!space) continue

          const contents = get(space.contents)
          if (contents.some((entry) => entry.entry_id === resourceId)) {
            foundSourceSpaceId = space.id
            break
          }
        }
      }

      // If resource not found in any space, just add it to the target space
      if (!foundSourceSpaceId) {
        this.log.debug('Resource not found in any space, adding directly to target')
        return this.addResourcesToSpace(targetSpaceId, [resourceId], SpaceEntryOrigin.ManuallyAdded)
          .then(() => true)
          .catch((error) => {
            this.log.error('Error adding resource to space:', error)
            return false
          })
      }

      // If source and target are the same, nothing to do
      if (foundSourceSpaceId === targetSpaceId) {
        this.log.debug('Source and target spaces are the same, no action needed')
        return true
      }

      // Move the resource using the existing moveResource method
      return this.moveResource({
        resourceId,
        sourceId: foundSourceSpaceId,
        targetId: targetSpaceId
      })
    } catch (error) {
      this.log.error('Error in moveResourceToSpace:', error)
      return false
    }
  }

  /**
   * Move a space to a new parent space
   * @param spaceId The ID of the space to move
   * @param targetParentId The ID of the new parent space
   * @returns Promise<boolean> True if successful
   */
  async moveSpace(spaceId: string, targetParentId: string): Promise<boolean> {
    try {
      if (spaceId === targetParentId) {
        this.log.error('Cannot move a space to itself')
        return false
      }

      const [spaceToMove, targetParentSpace] = await Promise.all([
        this.getSpace(spaceId),
        this.getSpace(targetParentId)
      ])

      if (!spaceToMove || !targetParentSpace) {
        this.log.error('Space not found', { spaceId, targetParentId })
        return false
      }

      const parentSpaces = targetParentSpace.dataValue.nestingData?.parentSpaces || []
      if (parentSpaces.includes(targetParentId)) {
        this.log.debug('Space is already in the target parent')
        return true
      }

      await this.resourceManager.sffs.moveSpace(spaceId, targetParentId)

      const spacesToReload = [spaceId, targetParentId]
      await Promise.all(spacesToReload.map((id) => this.reloadSpace(id)))
      await this.loadSpaces()
      return true
    } catch (error) {
      this.log.error('Error moving space:', error)
      return false
    }
  }

  /**
   * Nest a space within another space without removing it from its original location(s),
   * allowing the space to exist in multiple places in the hierarchy
   * @param spaceId The ID of the space to nest
   * @param parentSpaceId The ID of the parent space to nest it within
   * @returns Promise<boolean> True if successful
   */
  async nestSpaceWithin(spaceId: string, parentSpaceId: string): Promise<boolean> {
    try {
      // Don't allow nesting a space within itself
      if (spaceId === parentSpaceId) {
        this.log.error('Cannot nest a space within itself')
        return false
      }

      // Get both spaces in parallel
      const [spaceToNest, parentSpace] = await Promise.all([
        this.getSpace(spaceId),
        this.getSpace(parentSpaceId)
      ])

      if (!spaceToNest || !parentSpace) {
        this.log.error('Space not found', { spaceId, parentSpaceId })
        return false
      }

      const existingParentSpaces = spaceToNest.dataValue.nestingData?.parentSpaces || []
      if (existingParentSpaces.includes(parentSpaceId)) {
        this.log.debug('Space is already in the target parent')
        return true
      }

      await this.resourceManager.sffs.addSubspacesToSpace(
        parentSpaceId,
        [spaceId],
        SpaceEntryOrigin.ManuallyAdded
      )
      await this.telemetry.trackLinkSpace()
      await Promise.all([this.reloadSpace(spaceId), this.reloadSpace(parentSpaceId)])
      await this.loadSpaces()
      return true
    } catch (error) {
      this.log.error('Error nesting space within parent:', error)
      return false
    }
  }

  /**
   * Removes spaces from a nested space hierarchy without moving them elsewhere
   * This "un-nests" the spaces from their parent while preserving them in the system
   * @param parentId The ID of the parent space to remove from
   * @param spaceIds The ID or IDs of the spaces to remove from the parent
   * @param confirmAction Whether to show a confirmation dialog before removing (default: true)
   * @returns Promise<boolean> True if successful
   */
  async removeSpacesFromNestedSpace(
    parentId: string,
    spaceIds: string | string[],
    confirmAction = true
  ): Promise<boolean> {
    try {
      // Convert to array if a single string was provided
      spaceIds = Array.isArray(spaceIds) ? spaceIds : [spaceIds]
      this.log.debug('Removing spaces from parent', { parentId, spaceIds })

      // Get the parent space
      const parentSpace = await this.getSpace(parentId)
      if (!parentSpace) {
        this.log.error('Parent space not found:', parentId)
        return false
      }

      // Get all spaces to remove
      const spacesToRemove = await Promise.all(spaceIds.map((id) => this.getSpace(id)))

      // Filter out any spaces that couldn't be found
      const validSpaces = spacesToRemove.filter((space) => space !== null) as OasisSpace[]
      if (validSpaces.length === 0) {
        this.log.error('No valid spaces found')
        return false
      }

      // Show confirmation dialog if required
      if (confirmAction) {
        const confirmMessage = `Remove ${
          validSpaces.length > 1 ? 'these spaces' : 'this space'
        } from '${parentSpace?.dataValue.folderName}'? ${
          validSpaces.length > 1 ? 'They' : 'It'
        } will still be available as ${validSpaces.length > 1 ? 'separate spaces' : 'a separate space'}.`

        const { closeType: confirmed } = await openDialog({
          title: `Remove ${validSpaces.length} Space${validSpaces.length > 1 ? 's' : ''}`,
          message: confirmMessage,
          actions: [
            { title: 'Cancel', type: 'reset' },
            { title: 'Remove', type: 'submit', kind: 'primary' }
          ]
        })

        if (!confirmed) {
          return false
        }
      }

      const parentData = parentSpace.dataValue
      if (!parentData.nestingData?.childSpaces) {
        this.log.error('Parent space does not have child spaces')
        return false
      }

      await this.resourceManager.sffs.deleteEntriesInSpaceByEntryIds(parentId, spaceIds, false)

      await this.loadSpaces()
      await Promise.all([this.reloadSpace(parentId), ...spaceIds.map((id) => this.reloadSpace(id))])

      this.log.debug('Successfully removed spaces from nested hierarchy:', {
        parentId,
        removedSpaces: spaceIds
      })
      return true
    } catch (error) {
      this.log.error('Error removing spaces from nested space:', error)
      return false
    }
  }

  /**
   * Get all root folders (folders with no parent)
   * @returns Array of root folder spaces
   */
  async getRootSpaces(): Promise<OasisSpace[]> {
    try {
      const allSpaces = get(this.spaces)
      const rootSpaces: OasisSpace[] = []

      for (const space of allSpaces) {
        const spaceData = space.dataValue
        if (!spaceData.nestingData?.hasParents) {
          rootSpaces.push(space)
        }
      }

      return rootSpaces
    } catch (error) {
      this.log.error('Error getting root spacess:', error)
      return []
    }
  }

  /**
   * Toggle whether a space should be used as a browsing context
   * @param spaceId The space ID to toggle
   * @param useAsBrowsingContext Optional explicit value to set (if not provided, it will toggle the current value)
   * @returns True if successful, false otherwise
   */
  async toggleBrowsingContext(spaceId: string, useAsBrowsingContext?: boolean): Promise<boolean> {
    try {
      const space = await this.getSpace(spaceId)
      if (!space) {
        this.log.error('Space not found:', spaceId)
        return false
      }

      const spaceData = space.dataValue
      const currentValue = spaceData.useAsBrowsingContext

      if (useAsBrowsingContext !== undefined && useAsBrowsingContext === currentValue) {
        this.log.debug(
          `Browsing context for space ${spaceId} is already set to ${useAsBrowsingContext}, no change needed`
        )
        return true
      }

      const newValue = useAsBrowsingContext !== undefined ? useAsBrowsingContext : !currentValue
      const isActiveInBrowser = this.tabsManager?.activeScopeIdValue === spaceId

      await space.updateData({
        ...spaceData,
        useAsBrowsingContext: newValue
      })

      // If we're turning off browsing context for the currently active context,
      // notify the TabsManager to handle the context switch
      if (isActiveInBrowser && !newValue && this.tabsManager) {
        this.log.debug(
          `Notifying TabsManager that active browsing context ${spaceId} is no longer valid`
        )
        // Use the TabsManager's validateActiveScope method to handle the context switch
        await this.tabsManager.validateActiveScope()
      }

      this.log.debug(`Updated browsing context for space ${spaceId}: ${newValue}`)
      return true
    } catch (error) {
      this.log.error('Error toggling browsing context:', error)
      return false
    }
  }

  addToNavigationHistory(spaceId: string) {
    const currentHistory = this.navigationHistoryValue
    const currentSpace = get(this.selectedSpace)

    if (
      currentSpace &&
      currentSpace !== spaceId &&
      currentHistory[currentHistory.length - 1] !== currentSpace
    ) {
      this.navigationHistory.update((history) => [...history, currentSpace])

      this.log.debug(
        'Added to navigation history:',
        currentSpace,
        'New history:',
        this.navigationHistoryValue
      )
    }
  }

  async navigateBack(): Promise<string | null> {
    if (!this.canNavigateBackValue) {
      this.log.debug('Cannot navigate back - no previous history')
      return null
    }

    const history = this.navigationHistoryValue
    const previousSpaceId = history[history.length - 1]

    if (!previousSpaceId) {
      this.log.error('Invalid navigation history state')
      return null
    }
    this.log.debug('Navigating back to space:', previousSpaceId)
    this.navigationHistory.update((history) => history.slice(0, -1))
    this.selectedSpace.set(previousSpaceId)
    this.selectedFilterTypeId.set(null)
    return previousSpaceId
  }

  resetNavigationHistory() {
    this.navigationHistory.set([])
    this.log.debug('Navigation history reset')
  }

  getPreviousSpaceInNavigationHistory(): string | null {
    const history = this.navigationHistoryValue
    return history.length > 0 ? history[history.length - 1] : null
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

// Compatibility function for existing code that uses useNestedSpaceService
// This returns the OasisService instance which now has all the space functionality
export function useNestedSpaceService(): OasisService {
  return useOasis()
}
