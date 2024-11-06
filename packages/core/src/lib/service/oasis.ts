import { get, writable, type Writable } from 'svelte/store'
import { generateID, useLogScope } from '@horizon/utils'
import type { Resource, ResourceManager } from './resources'

import { SpaceEntryOrigin, type Optional, type Space, type SpaceData } from '../types'
import { getContext, setContext } from 'svelte'
import type { Telemetry } from './telemetry'
import { DeleteResourceEventTrigger } from '@horizon/types'
import type { TabsManager } from './tabs'

export class OasisService {
  spaces: Writable<Space[]>
  selectedSpace: Writable<string>

  stackKey: Writable<{}>
  pendingStackActions: Array<{ resourceId: string; origin: { x: number; y: number } }>

  tabsManager: TabsManager
  resourceManager: ResourceManager
  telemetry: Telemetry
  log: ReturnType<typeof useLogScope>

  constructor(resourceManager: ResourceManager, tabsManager: TabsManager) {
    this.log = useLogScope('OasisService')
    this.telemetry = resourceManager.telemetry
    this.resourceManager = resourceManager
    this.tabsManager = tabsManager

    this.spaces = writable<Space[]>([])
    this.selectedSpace = writable<string>('all')
    this.stackKey = writable({})
    this.pendingStackActions = []

    this.initSpaces()
  }

  async initSpaces() {
    try {
      const spaces = await this.loadSpaces()
      this.spaces.set(spaces)
    } catch (error) {
      this.log.error('Failed to load spaces:', error)
    }
  }

  async loadSpaces() {
    this.log.debug('loading spaces')
    let result = await this.resourceManager.listSpaces()

    // TODO: Felix — Continuation on felix/tempspace-removal: Remove all .tempspaces
    const filteredResult = result.filter((space) => space.name.folderName !== '.tempspace')
    result = filteredResult

    this.log.debug('loaded spaces:', result)
    this.spaces.set(result)
    return result
  }

  async createSpace(
    data: Optional<
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
  ) {
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
      sources: []
    }

    const fullData = Object.assign({}, defaults, data)

    if (fullData.folderName === '.tempspace') {
      const fakeSpace = {
        name: fullData,
        id: generateID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted: 0
      } as Space
      this.log.debug('created fake space:', fakeSpace)

      this.spaces.update((spaces) => {
        return [...spaces, fakeSpace]
      })

      return fakeSpace
    }

    const result = await this.resourceManager.createSpace(fullData)
    if (!result) {
      this.log.error('failed to create space')
      throw new Error('Failed to create space')
    }

    this.log.debug('created space:', result)
    this.spaces.update((spaces) => {
      return [...spaces, result]
    })

    return result
  }

  getSpace(spaceId: string, fresh = false) {
    const storedSpace = get(this.spaces).find((space) => space.id === spaceId)
    if (storedSpace && !fresh) {
      return storedSpace
    }

    return this.resourceManager.getSpace(spaceId)
  }

  async deleteSpace(spaceId: string) {
    this.log.debug('deleting space', spaceId)
    await this.resourceManager.deleteSpace(spaceId)

    this.log.debug('deleted space:', spaceId)
    this.spaces.update((spaces) => {
      return spaces.filter((space) => space.id !== spaceId)
    })
  }

  async updateSpaceData(id: string, updates: Partial<SpaceData>) {
    this.log.debug('updating space', id, updates)

    const space = await this.getSpace(id)
    if (!space) {
      this.log.error('space not found:', id)
      throw new Error('Space not found')
    }

    const data = { ...space.name, ...updates }

    await this.resourceManager.updateSpace(id, data)

    this.spaces.update((spaces) => {
      return spaces.map((space) => {
        if (space.id === id) {
          return { ...space, name: data }
        }
        return space
      })
    })
  }

  async addResourcesToSpace(spaceId: string, resourceIds: string[], origin: SpaceEntryOrigin) {
    this.log.debug('adding resources to space', spaceId, resourceIds)
    await this.resourceManager.addItemsToSpace(spaceId, resourceIds, origin)

    this.log.debug('added resources to space, reloading spaces')
    await this.loadSpaces()
  }

  async getSpaceContents(spaceId: string) {
    this.log.debug('getting space contents', spaceId)
    const result = await this.resourceManager.getSpaceContents(spaceId)

    this.log.debug('got space contents:', result)
    return result
  }

  /** Remove a resource from a specific space, or from Stuff entirely if no space is provided.
   * throws: Error in various failure cases.
   */
  async removeResourceFromSpace(resourceIds: string | string[], spaceId?: string) {
    const isEverythingSpace = spaceId === undefined || spaceId === 'all'
    const space = isEverythingSpace ? null : await this.getSpace(spaceId)
    resourceIds = Array.isArray(resourceIds) ? resourceIds : [resourceIds]
    this.log.debug('removing resources', resourceIds)

    const resources = await Promise.all(
      resourceIds.map((id) => this.resourceManager.getResource(id))
    )
    const validResources = resources.filter((resource) => resource !== null) as Resource[]

    if (validResources.length === 0) {
      this.log.error('No valid resources found')
      return
    }

    const allReferences = await Promise.all(
      validResources.map((resource) =>
        this.resourceManager.getAllReferences(resource.id, get(this.spaces))
      )
    )

    let totalNumberOfReferences = 0
    if (isEverythingSpace) {
      totalNumberOfReferences = allReferences.reduce((sum, refs) => sum + refs.length, 0)
    }

    const confirmMessage = !isEverythingSpace
      ? `Remove ${validResources.length > 1 ? 'these resources' : 'this resource'} from '${space?.name.folderName}'? \n${validResources.length > 1 ? 'They' : 'It'} will still be in 'All my Stuff'.`
      : totalNumberOfReferences > 0
        ? `These ${validResources.length} resources will be removed from ${totalNumberOfReferences} space${totalNumberOfReferences > 1 ? 's' : ''} and deleted permanently.`
        : `This resource will be deleted permanently.`

    const confirm = window.confirm(confirmMessage)

    if (!confirm) {
      return
    }

    try {
      if (!isEverythingSpace) {
        this.log.debug('removing resource entries from space...', validResources)

        const referencesToRemove = allReferences.flatMap((refs, index) =>
          refs.filter((x) => x.folderId === spaceId && x.resourceId === validResources[index].id)
        )

        if (referencesToRemove.length === 0) {
          this.log.error('References not found')
          throw new Error('References not found')
        }

        await this.resourceManager.deleteSpaceEntries(referencesToRemove.map((ref) => ref.entryId))

        await this.resourceManager.addItemsToSpace(
          spaceId,
          referencesToRemove.map((ref) => ref.resourceId),
          SpaceEntryOrigin.Blacklisted
        )
      }
    } catch (error) {
      this.log.error('Error removing references:', error)
      throw new Error('Error removing references' + error)
    }

    if (isEverythingSpace) {
      this.log.debug('deleting resources from oasis', resourceIds)
      await Promise.all(resourceIds.map((id) => this.resourceManager.deleteResource(id)))

      // update tabs to remove any links to the resources
      await Promise.all(resourceIds.map((id) => this.tabsManager.removeResourceBookmarks(id)))

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
    } else {
      await Promise.all(
        validResources.map((resource) =>
          this.telemetry.trackDeleteResource(
            resource.type,
            !isEverythingSpace,
            validResources.length > 1
              ? DeleteResourceEventTrigger.OasisMultiSelect
              : DeleteResourceEventTrigger.OasisItem
          )
        )
      )
    }

    this.log.debug('Resources removed:', resourceIds)
  }

  async resetSelectedSpace() {
    this.selectedSpace.set('all')
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

  static provide(resourceManager: ResourceManager, tabsManager: TabsManager) {
    const service = new OasisService(resourceManager, tabsManager)

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

export const useOasis = OasisService.use
export const provideOasis = OasisService.provide
