import { tick } from 'svelte'
import { derived, get, writable, type Readable, type Writable } from 'svelte/store'

import {
  conditionalArrayItem,
  isDev,
  useLogScope,
  EventEmitterBase,
  SearchResourceTags
} from '@deta/utils'

import {
  DeleteResourceEventTrigger,
  ResourceTypes,
  SpaceEntryOrigin,
  type SpaceEntrySearchOptions,
  type NotebookData,
  type NotebookSpace,
  type Space
} from '@deta/types'

import { ResourceNote, type ResourceManager, type Resource } from '@deta/services/resources'
import { type Telemetry, type ConfigService } from '@deta/services'
import type { SpaceBasicData } from '@deta/services/dist/ipc/events.js'

import { Notebook } from './notebook'
import type { NotebookManagerEmitterEvents } from './notebook.types'

export class NotebookManager extends EventEmitterBase<NotebookManagerEmitterEvents> {
  notebooks: Writable<Notebook[]>
  selectedNotebook: Writable<string | null>

  everythingContents: Writable<Resource[]>
  loadingEverythingContents: Writable<boolean>
  sortedNotebooksList: Readable<Notebook[]>

  resourceManager: ResourceManager
  config: ConfigService
  telemetry: Telemetry
  log: ReturnType<typeof useLogScope>

  static self: NotebookManager

  constructor(resourceManager: ResourceManager, config: ConfigService) {
    super()
    this.log = useLogScope('NotebookManager')
    this.telemetry = resourceManager.telemetry
    this.resourceManager = resourceManager
    this.config = config

    this.notebooks = writable<Notebook[]>([])
    this.selectedNotebook = writable<string | null>(null)

    this.everythingContents = writable([])
    this.loadingEverythingContents = writable(false)

    this.sortedNotebooksList = derived(
      [this.notebooks, this.config.settings],
      ([$spaces, $userSettings]) => {
        const filteredSpaces = $spaces
          .filter((space) => space.dataValue.name !== '.tempspace')
          .sort((a, b) => {
            return a.indexValue - b.indexValue
          })

        return filteredSpaces
      }
    )

    this.init()

    if (isDev) {
      // @ts-ignore
      window.notebookManager = this
    }
  }

  private async init() {
    await this.loadNotebooks()
  }

  reloadNotebook(notebookId: string) {
    this.emit('reload-notebook', notebookId)
  }

  private createNotebookObject(space: NotebookSpace) {
    return new Notebook(space, this)
  }

  get notebooksValue() {
    return get(this.notebooks)
  }

  get selectedNotebookValue() {
    return get(this.selectedNotebook)
  }

  get notebookSpacesValue() {
    return get(this.notebooks).map((notebook) => notebook.spaceValue)
  }

  get sortedNotebooksListValue() {
    return get(this.sortedNotebooksList)
  }

  updateMainProcessNotebooksList() {
    const items = this.sortedNotebooksListValue.map(
      (space) =>
        ({
          id: space.id,
          name: space.dataValue.name,
          pinned: false,
          linked: false
        }) as SpaceBasicData
    )

    const filteredItems = items.filter(
      (e) => e.id !== 'all' && e.id !== 'inbox' && e.name?.toLowerCase() !== '.tempspace'
    )

    this.log.debug('updating spaces list in main process', filteredItems)
    window.api.updateSpacesList(filteredItems)
  }

  triggerStoreUpdate(space: Notebook) {
    // trigger Svelte reactivity
    this.notebooks.update((spaces) => {
      return spaces.map((s) => (s.id === space.id ? space : s))
    })

    tick().then(() => {
      this.updateMainProcessNotebooksList()
    })
  }

  async loadNotebooks() {
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
      .map((space) => this.createNotebookObject(space as unknown as NotebookSpace))

    this.log.debug('loaded spaces:', spaces)

    this.notebooks.set(spaces)

    tick().then(() => {
      this.updateMainProcessNotebooksList()
    })

    return result
  }

  async createNotebook(data: NotebookData, parentId?: string) {
    this.log.debug('creating notebook', parentId ? 'as subfolder of ' + parentId : '')

    const defaults = {
      showInSidebar: false,
      liveModeEnabled: false,
      smartFilterQuery: null,
      sql_query: null,
      embedding_query: null,
      sortBy: 'resource_added_to_space',
      builtIn: false,
      default: false,
      index: this.notebooksValue.length,
      sources: []
    }

    // Create a copy of the data to avoid modifying the original
    let fullData = Object.assign({}, defaults, data)

    let parentSpace: Notebook | undefined | null = null
    let parentData: NotebookData | null = null

    const result = await this.resourceManager.createSpace(fullData)
    if (!result) {
      this.log.error('failed to create space')
      throw new Error('Failed to create space')
    }

    const space = this.createNotebookObject(result as unknown as NotebookSpace)

    this.log.debug('created space:', space)
    this.notebooks.update((spaces) => {
      return [...spaces, space]
    })

    if (parentId && parentSpace && parentData) {
      await this.resourceManager.sffs.addSubspacesToSpace(
        parentId,
        [space.id],
        SpaceEntryOrigin.ManuallyAdded
      )
    }
    await this.loadNotebooks()
    this.emit('created', space)
    return space
  }

  async getNotebook(notebookId: string, fresh = false) {
    const storedSpace = get(this.notebooks).find((space) => space.id === notebookId)
    if (storedSpace && !fresh) {
      return storedSpace
    }

    const result = await this.resourceManager.getSpace(notebookId)
    if (!result) {
      this.log.error('space not found:', notebookId)
      return null
    }

    const space = this.createNotebookObject(result as unknown as NotebookSpace)
    this.notebooks.update((notebooks) => {
      return notebooks.map((s) => (s.id === notebookId ? space : s))
    })

    this.log.debug('got space:', space)

    return space
  }

  async deleteNotebook(notebookId: string) {
    this.log.debug('deleting notebook', notebookId)

    // Proceed with normal notebook deletion
    await this.resourceManager.deleteSpace(notebookId)

    this.log.debug('deleted notebook:', notebookId)

    const filtered = get(this.notebooks).filter((space) => space.id !== notebookId)

    await Promise.all(filtered.map((space, idx) => space.updateIndex(idx)))

    this.notebooks.set(filtered)

    if (get(this.selectedNotebook) === notebookId && notebookId !== '.tempspace') {
      this.changeSelectedNotebook(null)
    }

    await this.loadNotebooks()
    this.emit('deleted', notebookId)
  }

  async updateNotebookData(id: string, updates: Partial<NotebookData>) {
    this.log.debug('updating notebook', id, updates)

    const space = await this.getNotebook(id)
    if (!space) {
      this.log.error('space not found:', id)
      throw new Error('Space not found')
    }

    await space.updateData(updates)
    this.log.debug('updated space:', space)

    this.triggerStoreUpdate(space)

    return space
  }

  async addResourcesToNotebook(
    notebookId: string,
    resourceIds: string[],
    origin: SpaceEntryOrigin
  ) {
    this.log.debug('adding resources to notebook', notebookId, resourceIds, origin)

    const notebook = await this.getNotebook(notebookId)
    if (!notebook) {
      this.log.error('notebook not found:', notebookId)
      throw new Error('Notebook not found')
    }

    await notebook.addResources(resourceIds, origin)
    this.log.debug('added resources to notebook')
    this.triggerStoreUpdate(notebook)
    return notebook
  }

  /**
   * Get the contents of a space
   * @param spaceId The space ID to get contents for
   * @param opts Optional search options
   * @param includeFolderData Whether to include folder-specific data (child folders, path)
   * @returns The space contents or folder contents response
   */
  async getNotebookContents(notebookId: string, opts?: SpaceEntrySearchOptions) {
    this.log.debug('getting notebook contents', notebookId)
    const notebook = await this.getNotebook(notebookId)
    if (!notebook) {
      this.log.error('notebook not found:', notebookId)
      throw new Error('Notebook not found')
    }
    return await notebook.fetchContents(opts)
  }

  /**
   * Fetches note resources from a specific space
   * @param spaceId - ID of the space to fetch notes from
   * @returns Array of ResourceNote objects from the space
   */
  async fetchNoteResourcesFromNotebook(notebookId: string) {
    this.log.debug('Fetching note resources for notebook:', notebookId)

    // Get the notebook
    const notebook = await this.getNotebook(notebookId)
    if (!notebook) {
      this.log.error('Notebook not found:', notebookId)
      return []
    }

    // Get notebook contents
    const notebookContents = (await notebook.fetchContents()) ?? []

    // Extract IDs of note resources
    const noteIds = notebookContents
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

  /** Deletes the provided resources from Oasis and gets rid of all references in any notebook */
  async deleteResourcesFromSurf(resourceIds: string | string[]) {
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
      validResourceIDs.map((id) =>
        this.resourceManager.getAllReferences(id, this.notebookSpacesValue as unknown as Space[])
      )
    )
    this.log.debug('all references:', allReferences)

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
        const space = await this.getNotebook(entry.spaceId)
        if (space) {
          await space.removeResources(entry.resourceIds)
        }
      })
    )

    this.log.debug('deleting resources from oasis', validResourceIDs)
    await this.resourceManager.deleteResources(validResourceIDs)

    // this.log.debug('removing resource bookmarks from tabs', validResourceIDs)
    // await Promise.all(validResourceIDs.map((id) => this.tabsManager.removeResourceBookmarks(id)))

    this.log.debug('removing deleted smart notes', validResourceIDs)

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

  /** Removes the provided resources from the notebook */
  async removeResourcesFromNotebook(notebookId: string, resourceIds: string | string[]) {
    const notebook = await this.getNotebook(notebookId)
    if (!notebook) {
      this.log.error('notebook not found:', notebookId)
      throw new Error('Notebook not found')
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

    this.log.debug('removing resource entries from notebook...', validResources)

    const removedResources = await notebook.removeResources(
      validResources.map((resource) => resource.id)
    )
    this.log.debug('removed resource entries from notebook', removedResources)

    this.triggerStoreUpdate(notebook)

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

  /** Remove a resource from a specific notebook, or from Stuff entirely if no notebook is provided.
   * throws: Error in various failure cases.
   */
  async removeResources(resourceIds: string | string[], notebookId?: string) {
    resourceIds = Array.isArray(resourceIds) ? resourceIds : [resourceIds]
    this.log.debug('removing resources from', notebookId ?? 'oasis', resourceIds)

    if (!notebookId) {
      return this.deleteResourcesFromSurf(resourceIds)
    }
    return this.removeResourcesFromNotebook(notebookId, resourceIds)
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
      // const selectedFilterType = get(this.selectedFilterType)

      this.log.debug('loading everything', { excludeAnnotations })
      const resources = await this.resourceManager.listResourcesByTags(
        [
          ...SearchResourceTags.NonHiddenDefaultTags({ excludeAnnotations: excludeAnnotations }),
          // ...conditionalArrayItem(selectedFilterType !== null, selectedFilterType?.tags ?? []),
          ...conditionalArrayItem(
            get(this.selectedNotebook) === 'notes',
            SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE)
          )
        ],
        { includeAnnotations: true, excludeWithinSpaces: get(this.selectedNotebook) === 'inbox' }
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

  async changeSelectedNotebook(notebookId: string | null) {
    this.selectedNotebook.set(notebookId)
    // this.selectedFilterTypeId.set(null)
  }

  async resetSelectedNotebook() {
    this.changeSelectedNotebook(null)
  }

  async moveNotebookToIndex(notebookId: string, targetIndex: number) {
    const notebook = await this.getNotebook(notebookId)
    if (!notebook) {
      this.log.error('notebook not found:', notebookId)
      throw new Error('Notebook not found')
    }

    const notebooks = get(this.notebooks)
    const currentIndex = notebooks.findIndex((s) => s.id === notebookId)

    if (currentIndex === -1) {
      throw new Error('Notebook not found in notebooks array')
    }

    const clampedTargetIndex = Math.min(Math.max(0, targetIndex), notebooks.length - 1)

    if (currentIndex === clampedTargetIndex) return

    this.log.debug(
      'moving notebook',
      notebookId,
      'from index',
      currentIndex,
      'to index',
      clampedTargetIndex,
      targetIndex !== clampedTargetIndex ? `(clamped from ${targetIndex})` : ''
    )

    const newNotebooks = [...notebooks]
    const [movedNotebook] = newNotebooks.splice(currentIndex, 1)
    newNotebooks.splice(clampedTargetIndex, 0, movedNotebook)

    try {
      const updates = newNotebooks
        .map((notebook, index) => ({ notebook, index }))
        .filter(({ notebook, index }) => notebook.indexValue !== index)

      await Promise.all(updates.map(({ notebook, index }) => notebook.updateIndex(index)))

      this.notebooks.set(newNotebooks)

      this.log.debug('moved notebook', notebookId, 'to index', targetIndex)
    } catch (error) {
      this.log.error('failed to move notebook:', error)
      throw new Error('Failed to move notebook')
    }
  }

  static provide(resourceManager: ResourceManager, config: ConfigService) {
    const service = new NotebookManager(resourceManager, config)
    if (!NotebookManager.self) NotebookManager.self = service

    return service
  }

  static use() {
    if (!NotebookManager.self) {
      throw new Error('NotebookManager not initialized')
    }
    return NotebookManager.self
  }
}

export const useNotebookManager = NotebookManager.use
export const createNotebookManager = NotebookManager.provide
