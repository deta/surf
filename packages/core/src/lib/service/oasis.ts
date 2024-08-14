import { get, writable, type Writable } from 'svelte/store'
import { useLogScope } from '../utils/log'
import type { ResourceManager } from './resources'

import type { Optional, Space, SpaceData } from '../types'
import { getContext, setContext } from 'svelte'
import { useLocalStorageStore } from '../utils/localstorage'

export class OasisService {
  spaces: Writable<Space[]>
  selectedSpace: Writable<string>

  resourceManager: ResourceManager
  log: ReturnType<typeof useLogScope>

  constructor(resourceManager: ResourceManager) {
    this.log = useLogScope('OasisService')
    this.resourceManager = resourceManager

    this.spaces = writable<Space[]>([])
    this.selectedSpace = writable<string>('all')

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
    const result = await this.resourceManager.listSpaces()

    this.log.debug('loaded spaces:', result)
    this.spaces.set(result)
    return result
  }

  async createSpace(
    data: Optional<
      SpaceData,
      'showInSidebar' | 'liveModeEnabled' | 'hideViewed' | 'smartFilterQuery' | 'sortBy' | 'sources'
    >
  ) {
    this.log.debug('creating space')

    const defaults = {
      showInSidebar: false,
      liveModeEnabled: false,
      hideViewed: false,
      smartFilterQuery: null,
      sortBy: 'created_at',
      sources: []
    }

    const fullData = Object.assign({}, defaults, data)

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

  async addResourcesToSpace(spaceId: string, resourceIds: string[]) {
    this.log.debug('adding resources to space', spaceId, resourceIds)
    await this.resourceManager.addItemsToSpace(spaceId, resourceIds)

    this.log.debug('added resources to space, reloading spaces')
    await this.loadSpaces()
  }

  async getSpaceContents(spaceId: string) {
    this.log.debug('getting space contents', spaceId)
    const result = await this.resourceManager.getSpaceContents(spaceId)

    this.log.debug('got space contents:', result)
    return result
  }

  static provide(resourceManager: ResourceManager) {
    const service = new OasisService(resourceManager)

    setContext('oasis', service)

    return service
  }

  static use() {
    return getContext<OasisService>('oasis')
  }
}

export const useOasis = OasisService.use
export const provideOasis = OasisService.provide
