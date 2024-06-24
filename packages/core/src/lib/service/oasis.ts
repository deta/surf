import { writable, type Writable } from 'svelte/store'
import { useLogScope } from '../utils/log'
import type { ResourceManager } from './resources'

import type { Space, SpaceName } from '../types'
import { getContext, setContext } from 'svelte'

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
    const everything = [
      {
        id: 'all',
        name: { folderName: 'Everything', colors: ['#76E0FF', '#4EC9FB'] },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted: 0,
        type: 'space'
      },
      ...result
    ]

    this.log.debug('loaded spaces:', everything)
    this.spaces.set(everything)
    return everything
  }

  async createSpace(name: SpaceName) {
    this.log.debug('creating space')
    const result = await this.resourceManager.createSpace(name)
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

  async deleteSpace(spaceId: string) {
    this.log.debug('deleting space', spaceId)
    await this.resourceManager.deleteSpace(spaceId)

    this.log.debug('deleted space:', spaceId)
    this.spaces.update((spaces) => {
      return spaces.filter((space) => space.id !== spaceId)
    })
  }


  async renameSpace(id: string, name: SpaceName) {
    this.log.debug('renaming space', id, name)
    await this.resourceManager.updateSpace(id, name)

    this.spaces.update((spaces) => {
      return spaces.map((space) => {
        if (space.id === id) {
          return { ...space, name }
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
