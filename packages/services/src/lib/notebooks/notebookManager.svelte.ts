import { onMount, tick } from 'svelte'
import { derived, get, writable, type Readable, type Writable } from 'svelte/store'

import {
  conditionalArrayItem,
  isDev,
  useLogScope,
  EventEmitterBase,
  SearchResourceTags,
  isMainRenderer
} from '@deta/utils'

import { useKVTable, type BaseKVItem } from '../kv'

import {
  ResourceTypes,
  SpaceEntryOrigin,
  type SpaceEntrySearchOptions,
  type NotebookData,
  type NotebookSpace,
  type Space,
  type Lock,
  type Fn
} from '@deta/types'

import {
  ResourceNote,
  type ResourceManager,
  type Resource,
  ResourceManagerEvents
} from '../resources'
import { type ConfigService } from '../config'
import type { SpaceBasicData } from '../ipc/events'

import { Notebook } from './notebook.svelte'
import { NotebookManagerEvents, type NotebookManagerEventHandlers } from './notebook.types'
import { IconTypes } from '@deta/icons'
import { SvelteMap } from 'svelte/reactivity'
import type { MessagePortClient, MessagePortPrimary } from '../messagePort'
import { useViewManager } from '@deta/services/views'

type NotebookSettings = BaseKVItem & {
  title: string
}

export class NotebookManager extends EventEmitterBase<NotebookManagerEventHandlers> {
  private messagePort: MessagePortClient | MessagePortPrimary
  private config: ConfigService
  private log: ReturnType<typeof useLogScope>
  resourceManager: ResourceManager

  notebooks = new SvelteMap<string, Notebook>()
  private notebooks_lock: Lock = null

  sortedNotebooks = $derived(
    Array.from(this.notebooks.values())
      // TODO: Can we nuke this succer?
      .filter((space) => space.data.name !== '.tempspace')
      .sort((a, b) => b.data.index - a.data.index)
  )

  everythingContents: Writable<Resource[]>
  loadingEverythingContents: Writable<boolean>

  // Settings management
  private settingsStore = useKVTable<NotebookSettings>('notebook_settings')

  static self: NotebookManager

  constructor(
    resourceManager: ResourceManager,
    config: ConfigService,
    messagePort: MessagePortPrimary | MessagePortClient
  ) {
    super()
    this.log = useLogScope('NotebookManager')
    this.resourceManager = resourceManager
    this.config = config

    this.everythingContents = writable([])
    this.loadingEverythingContents = writable(false)
    this.messagePort = messagePort

    onMount(() => {
      let unsubs: Fn[] = []

      unsubs.push(
        //this.resourceManager.on(ResourceManagerEvents.Created, (resource: Resource) => {
        //  if (isMainRenderer()) {
        //    useViewManager()?.viewsValue.forEach((view) =>
        //      this.messagePort.extern_state_resourceCreated.send(view.id, {
        //        resourceId: resource.id
        //      })
        //    )
        //  } else {
        //    this.messagePort.extern_state_resourceCreated.send({
        //      resourceId: resource.id
        //    })
        //  }
        //}),
        this.resourceManager.on(ResourceManagerEvents.Deleted, (resourceId: string) => {
          for (const notebook of this.notebooks.values()) {
            notebook.contents = notebook.contents.filter((e) => e.id !== resourceId)
          }

          if (isMainRenderer()) {
            useViewManager()?.viewsValue.forEach((view) =>
              this.messagePort.extern_state_resourceDeleted.send(view.id, {
                resourceId
              })
            )
          } else {
            this.messagePort.extern_state_resourceDeleted.send({
              resourceId
            })
          }
        }),

        // Listen to resource updates (e.g., name changes) to keep notebook contents fresh
        this.resourceManager.on(ResourceManagerEvents.Updated, (resource: Resource) => {
          this.log.debug('Resource updated, refreshing affected notebooks:', resource.id)

          // Find notebooks that contain this resource and refresh their contents
          for (const notebook of this.notebooks.values()) {
            const hasResource = notebook.contents.some((entry) => entry.entry_id === resource.id)
            if (hasResource) {
              this.log.debug('Refreshing notebook contents for:', notebook.nameValue)
              // Refresh contents to get updated resource metadata
              notebook.fetchContents().catch((error) => {
                this.log.warn('Failed to refresh notebook contents:', notebook.id, error)
              })
            }
          }

          // Send cross-renderer message for resource updates
          if (isMainRenderer()) {
            useViewManager()?.viewsValue.forEach((view) =>
              this.messagePort.extern_state_resourceUpdated.send(view.id, {
                resourceId: resource.id
              })
            )
          } else {
            this.messagePort.extern_state_resourceUpdated.send({
              resourceId: resource.id
            })
          }
        }),

        this.resourceManager.on(
          ResourceManagerEvents.NotebookAddResources,
          (notebookId: string, resourceIds: string[]) => {
            if (isMainRenderer()) {
              useViewManager()?.viewsValue.forEach((view) =>
                this.messagePort.extern_state_notebookAddResources.send(view.id, {
                  notebookId,
                  resourceIds
                })
              )
            } else {
              this.messagePort.extern_state_notebookAddResources.send({
                notebookId,
                resourceIds
              })
            }
          }
        ),
        this.resourceManager.on(
          ResourceManagerEvents.NotebookRemoveResources,
          (notebookId: string, resourceIds: string[]) => {
            if (isMainRenderer()) {
              useViewManager()?.viewsValue.forEach((view) =>
                this.messagePort.extern_state_notebookRemoveResources.send(view.id, {
                  notebookId,
                  resourceIds
                })
              )
            } else {
              this.messagePort.extern_state_notebookRemoveResources.send({
                notebookId,
                resourceIds
              })
            }
          }
        )
      )

      if (isMainRenderer()) {
        unsubs.push(
          this.messagePort.extern_state_resourceDeleted.on(({ resourceId }) => {
            this.emit(NotebookManagerEvents.DeletedResource, resourceId)
            useViewManager().viewsValue.forEach((view) => {
              this.messagePort.extern_state_resourceDeleted.send(view.id, {
                resourceId
              })
            })
          }),
          this.messagePort.extern_state_resourceCreated.on(({ resourceId }) => {
            this.emit(NotebookManagerEvents.CreatedResource, resourceId)
            useViewManager().viewsValue.forEach((view) => {
              this.messagePort.extern_state_resourceCreated.send(view.id, {
                resourceId
              })
            })
          }),
          this.messagePort.extern_state_resourceUpdated.on(async ({ resourceId }) => {
            this.log.debug('Received cross-renderer resource update:', resourceId)

            try {
              await this.resourceManager.reloadResource(resourceId, true)
            } catch (error) {
              this.log.warn('Failed to refresh resource metadata:', resourceId, error)
            }

            // Find notebooks that contain this resource and refresh their contents
            for (const notebook of this.notebooks.values()) {
              const hasResource = notebook.contents.some((entry) => entry.entry_id === resourceId)
              if (hasResource) {
                this.log.debug('Refreshing notebook contents for:', notebook.nameValue)
                notebook.fetchContents().catch((error) => {
                  this.log.warn('Failed to refresh notebook contents:', notebook.id, error)
                })
              }
            }

            // Emit local event to trigger NotebookTreeView reactivity
            this.emit(NotebookManagerEvents.UpdatedResource, resourceId)

            // Also emit through ResourceManager to trigger ResourceLoader updates
            this.resourceManager.emit('externalResourceUpdated', resourceId)

            if (isMainRenderer()) {
              useViewManager().viewsValue.forEach((view) => {
                this.messagePort.extern_state_resourceUpdated.send(view.id, {
                  resourceId
                })
              })
            } else {
              this.messagePort.extern_state_resourceUpdated.send({
                resourceId
              })
            }
          }),

          this.messagePort.extern_state_notebookAddResources.on(({ notebookId, resourceIds }) => {
            this.getNotebook(notebookId).then((e) => e?.fetchContents())
            this.getNotebook(notebookId, { cacheOnly: true }).then((notebook) =>
              notebook?.fetchContents()
            )

            useViewManager().viewsValue.forEach((view) => {
              this.messagePort.extern_state_notebookAddResources.send(view.id, {
                notebookId,
                resourceIds
              })
            })
          }),
          this.messagePort.extern_state_notebookRemoveResources.on(
            ({ notebookId, resourceIds }) => {
              useViewManager().viewsValue.forEach((view) => {
                this.messagePort.extern_state_notebookRemoveResources.send(view.id, {
                  notebookId,
                  resourceIds
                })
              })
              this.getNotebook(notebookId).then((notebook) => {
                if (!notebook) return
                notebook.contents = notebook.contents.filter((e) => !resourceIds.includes(e.id))
              })
            }
          ),
          this.messagePort.extern_state_notebooksChanged.on(() => {
            this.loadNotebooks()
          })
        )
      } else {
        unsubs.push(
          //this.messagePort.extern_state_resourceCreated.handle(({ resourceId }) => {
          //  this.emit(NotebookManagerEvents.CreatedResource, resourceId)
          //}),
          this.messagePort.extern_state_resourceDeleted.handle(({ resourceId }) => {
            this.emit(NotebookManagerEvents.DeletedResource, resourceId)
          }),

          this.messagePort.extern_state_notebookAddResources.handle(
            ({ notebookId, resourceIds }) => {
              this.emit(NotebookManagerEvents.AddedResources, notebookId, resourceIds)
              this.getNotebook(notebookId, { cacheOnly: true }).then((notebook) =>
                notebook?.fetchContents()
              )
            }
          ),
          this.messagePort.extern_state_notebookRemoveResources.handle(
            ({ notebookId, resourceIds }) => {
              this.getNotebook(notebookId).then((notebook) => {
                if (!notebook) return
                notebook.contents = notebook.contents.filter((e) => !resourceIds.includes(e.id))
              })

              this.emit(NotebookManagerEvents.RemovedResources, notebookId, resourceIds)
              //this.getNotebook(notebookId, { cacheOnly: true }).then((notebook) => {
              //  if (!notebook) return
              //  console.warn('removing res', resourceIds, notebook)
              //  notebook.contents = notebook.contents.filter((e) => !resourceIds.includes(e.id))
              //})
            }
          ),
          this.messagePort.extern_state_notebooksChanged.handle(() => {
            this.loadNotebooks()
          })
        )
      }

      unsubs.push(
        this.on(NotebookManagerEvents.Created, () => {
          this.updateRendererNotebooks()
        }),
        this.on(NotebookManagerEvents.Deleted, () => {
          this.updateRendererNotebooks()
        }),
        this.on(NotebookManagerEvents.Updated, () => {
          this.updateRendererNotebooks()
        })
      )

      return () => unsubs.forEach((f) => f())
    })

    this.loadNotebooks()

    if (isDev) {
      // @ts-ignore
      window.notebookManager = this
    }
  }

  private createNotebookObject(space: NotebookSpace) {
    return new Notebook(space, this)
  }

  get notebookSpacesValue() {
    return Array.from(this.notebooks.values()).map((notebook) => notebook.spaceValue)
  }

  updateMainProcessNotebooksList() {
    const items = this.sortedNotebooks.map(
      (space) =>
        ({
          id: space.id,
          name: space.nameValue,
          pinned: space.data.pinned,
          linked: false
        }) as SpaceBasicData
    )

    const filteredItems = items.filter(
      (e) => e.id !== 'all' && e.id !== 'inbox' && e.name?.toLowerCase() !== '.tempspace'
    )

    this.log.debug('updating spaces list in main process', filteredItems)
    // @ts-ignore
    if (window.api.updateSpacesList) window.api.updateSpacesList(filteredItems)
  }

  updateRendererNotebooks() {
    if (isMainRenderer()) {
      useViewManager()?.viewsValue.forEach((view) =>
        this.messagePort.extern_state_notebooksChanged.send(view.id, {
          notebookIds: Array.from(this.notebooks.keys())
        })
      )
    } else {
      this.messagePort.extern_state_notebooksChanged.send({
        notebookIds: Array.from(this.notebooks.keys())
      })
    }
  }

  triggerUpdate() {
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

    this.log.debug('loaded spaces:', spaces)

    // Preserve object identity by updating existing notebooks instead of replacing them
    // This prevents breaking reactivity in components that hold references to Notebook objects
    const newSpaceIds = new Set(spaces.map((s) => s.id))
    const existingIds = new Set(this.notebooks.keys())

    // Remove notebooks that no longer exist
    for (const existingId of existingIds) {
      if (!newSpaceIds.has(existingId)) {
        this.log.debug('Removing deleted notebook:', existingId)
        this.notebooks.delete(existingId)
      }
    }

    // Update existing notebooks or add new ones
    for (const space of spaces) {
      const existing = this.notebooks.get(space.id)
      if (existing) {
        // Update existing notebook in-place to preserve object identity
        this.log.debug('Updating existing notebook:', space.id)
        existing.updateFromSpace(space as unknown as NotebookSpace)
      } else {
        // Create new notebook for newly added spaces
        this.log.debug('Adding new notebook:', space.id)
        const notebook = this.createNotebookObject(space as unknown as NotebookSpace)
        this.notebooks.set(space.id, notebook)
      }
    }

    this.triggerUpdate()

    return Array.from(this.notebooks.values())
  }

  async createNotebook(data: Partial<NotebookData>, isUserAction = false) {
    this.log.debug('creating notebook', data)

    const defaults = {
      name: 'New Notebook',
      description: '',
      index: this.notebooks.size,
      pinned: false,
      onboarding: data.onboarding ?? false,
      imported: data.imported ?? false,
      customization: {},
      icon: {
        type: IconTypes.ICON,
        data: 'file-text-ai'
      }
    } satisfies NotebookData

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

    this.log.debug('cregted space:', space)
    this.notebooks.set(space.id, space)

    await this.loadNotebooks()
    this.emit(NotebookManagerEvents.Created, space.id)
    return space
  }

  /**
   * @param cacheOnly - will return null if notebook is not already loaded in cache.
   */
  async getNotebook(
    notebookId: string,
    { fresh, cacheOnly }: { fresh?: boolean; cacheOnly?: boolean } = {
      fresh: false,
      cacheOnly: false
    }
  ) {
    fresh = fresh ?? false
    cacheOnly = cacheOnly ?? false
    if (fresh && cacheOnly) throw new Error('Cannot fetch notebook with fresh and cacheOnly!')
    if (this.notebooks_lock) {
      await this.notebooks_lock.catch(() => this.log.warn('Lock rejected @ getNotebook()'))
    }

    if (cacheOnly) {
      return this.notebooks.get(notebookId)
    } else if (this.notebooks.has(notebookId) && !fresh) {
      return this.notebooks.get(notebookId)
    }

    this.notebooks_lock = new Promise(async (res, rej) => {
      try {
        const result = await this.resourceManager.getSpace(notebookId)
        if (!result) {
          this.log.error('space not found:', notebookId)
          return null
        }

        const space = this.createNotebookObject(result as unknown as NotebookSpace)
        this.notebooks.set(notebookId, space)

        this.log.debug('got space:', space)

        res(space)
      } catch {
        rej()
      }
    })
    return this.notebooks_lock
  }

  async getOrCreateNotebook(id: string, defaults: Partial<NotebookData> = {}) {
    let notebook = await this.getNotebook(id)
    if (!notebook) {
      notebook = await this.createNotebook(defaults)
    }
    return notebook
  }

  async deleteNotebook(notebookId: string, isUserAction = false) {
    this.log.debug('deleting notebook', notebookId)

    // Proceed with normal notebook deletion
    await this.resourceManager.deleteSpace(notebookId)

    this.log.debug('deleted notebook:', notebookId)

    this.notebooks.delete(notebookId)
    //const filtered = this.notebooks.filter((space) => space.id !== notebookId)
    //await Promise.all(filtered.map((space, idx) => space.updateIndex(idx)))

    await this.loadNotebooks()
    this.emit(NotebookManagerEvents.Deleted, notebookId)
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

    this.triggerUpdate()

    return space
  }

  async addResourcesToNotebook(
    notebookId: string,
    resourceIds: string[],
    origin: SpaceEntryOrigin = SpaceEntryOrigin.ManuallyAdded,
    isUserAction = false
  ) {
    this.log.debug('adding resources to notebook', notebookId, resourceIds, origin)

    const notebook = await this.getNotebook(notebookId)
    if (!notebook) {
      this.log.error('notebook not found:', notebookId)
      throw new Error('Notebook not found')
    }

    await notebook.addResources(resourceIds, origin, isUserAction)
    this.log.debug('added resources to notebook')
    //this.triggerStoreUpdate(notebook)

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
  async deleteResourcesFromSurf(resourceIds: string | string[], isUserAction = false) {
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
          spaceId: references[0]?.folderId,
          resourceIds: references.map((ref) => ref.resourceId)
        }
      })
      .filter((entry, index, self) => {
        return self.findIndex((e) => e.spaceId === entry.spaceId) === index
      })

    this.log.debug('deleting resource references from spaces', spacesWithReferences)
    await Promise.all(
      spacesWithReferences.map(async (entry) => {
        const notebook = await this.getNotebook(entry.spaceId!)
        if (notebook) {
          await notebook.removeResources(entry.resourceIds)
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

    if (isUserAction)
      validResources.forEach((resource) => {
        if (resource?.type !== ResourceTypes.DOCUMENT_SPACE_NOTE) return
      })

    this.log.debug('deleted resources:', resourceIds)
    return resourceIds
  }

  /** Removes the provided resources from the notebook */
  async removeResourcesFromNotebook(
    notebookId: string,
    resourceIds: string | string[],
    isUserAction = false
  ) {
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
      validResources.map((resource) => resource.id),
      isUserAction
    )
    this.log.debug('removed resource entries from notebook', removedResources)

    //this.triggerStoreUpdate(notebook)

    this.log.debug('resources removed from space:', resourceIds)
    return removedResources
  }

  /** Remove a resource from a specific notebook, or from Stuff entirely if no notebook is provided.
   * throws: Error in various failure cases.
   */
  async removeResources(resourceIds: string | string[], notebookId?: string, isUserAction = false) {
    resourceIds = Array.isArray(resourceIds) ? resourceIds : [resourceIds]
    this.log.debug('removing resources from', notebookId ?? 'oasis', resourceIds)

    if (!notebookId) {
      return this.deleteResourcesFromSurf(resourceIds, isUserAction)
    }
    return this.removeResourcesFromNotebook(notebookId, resourceIds, isUserAction)
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
          ...SearchResourceTags.NonHiddenDefaultTags({
            excludeAnnotations: excludeAnnotations
          })
          // ...conditionalArrayItem(selectedFilterType !== null, selectedFilterType?.tags ?? []),
        ],
        {
          includeAnnotations: true
          //excludeWithinSpaces: get(this.selectedNotebook) === 'inbox'
        }
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

  /** @deprecated */
  async moveNotebookToIndex(notebookId: string, targetIndex: number) {
    alert('deprecated')
    throw new Error('Dont use this!')
    //const notebook = await this.getNotebook(notebookId)
    //if (!notebook) {
    //  this.log.error('notebook not found:', notebookId)
    //  throw new Error('Notebook not found')
    //}

    //const notebooks = get(this.notebooks)
    //const currentIndex = notebooks.findIndex((s) => s.id === notebookId)

    //if (currentIndex === -1) {
    //  throw new Error('Notebook not found in notebooks array')
    //}

    //const clampedTargetIndex = Math.min(Math.max(0, targetIndex), notebooks.length - 1)

    //if (currentIndex === clampedTargetIndex) return

    //this.log.debug(
    //  'moving notebook',
    //  notebookId,
    //  'from index',
    //  currentIndex,
    //  'to index',
    //  clampedTargetIndex,
    //  targetIndex !== clampedTargetIndex ? `(clamped from ${targetIndex})` : ''
    //)

    //const newNotebooks = [...notebooks]
    //const [movedNotebook] = newNotebooks.splice(currentIndex, 1)
    //newNotebooks.splice(clampedTargetIndex, 0, movedNotebook!)

    //try {
    //  const updates = newNotebooks
    //    .map((notebook, index) => ({ notebook, index }))
    //    .filter(({ notebook, index }) => notebook.data.index !== index)

    //  await Promise.all(updates.map(({ notebook, index }) => notebook.updateIndex(index)))

    //  this.notebooks.set(newNotebooks)

    //  this.log.debug('moved notebook', notebookId, 'to index', targetIndex)
    //} catch (error) {
    //  this.log.error('failed to move notebook:', error)
    //  throw new Error('Failed to move notebook')
    //}
  }

  // Settings management methods
  async loadTitle(): Promise<string> {
    try {
      await this.settingsStore.ready
      const settings = await this.settingsStore.read('main')
      if (settings) {
        this.log.debug('Loaded title:', settings.title)
        return settings.title
      }
      this.log.debug('No saved title found, using default')
      return 'maxus notebook'
    } catch (error) {
      this.log.error('Failed to load notebook title:', error)
      return 'maxus notebook'
    }
  }

  async saveTitle(newTitle: string): Promise<void> {
    try {
      await this.settingsStore.ready
      const existingSettings = await this.settingsStore.read('main')

      if (existingSettings) {
        await this.settingsStore.update('main', { title: newTitle })
        this.log.debug('Updated title:', newTitle)
      } else {
        await this.settingsStore.create({
          id: 'main',
          title: newTitle
        })
        this.log.debug('Created new title setting:', newTitle)
      }
    } catch (error) {
      this.log.error('Failed to save notebook title:', error)
      throw error
    }
  }

  async getSettings(): Promise<NotebookSettings | undefined> {
    try {
      await this.settingsStore.ready
      return await this.settingsStore.read('main')
    } catch (error) {
      this.log.error('Failed to get settings:', error)
      return undefined
    }
  }

  static provide(
    resourceManager: ResourceManager,
    config: ConfigService,
    messagePort: MessagePortPrimary | MessagePortClient
  ) {
    const service = new NotebookManager(resourceManager, config, messagePort)
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
