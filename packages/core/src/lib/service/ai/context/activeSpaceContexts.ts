import { tick } from 'svelte'
import { type Writable, type Readable, writable, derived, get } from 'svelte/store'

import type { TabPage, TabResource } from '../../../types'
import type { OasisSpace } from '../../oasis'

import { ContextItemBase } from './base'
import type { ContextService } from '../contextManager'
import { ContextItemSpace } from './space'
import { ContextItemTypes, ContextItemIconTypes, type ContextItemIcon } from './types'
import {
  PageChatUpdateContextEventAction,
  PageChatUpdateContextEventTrigger,
  PageChatUpdateContextItemType
} from '@horizon/types'
import { SearchResourceTags } from '@horizon/core/src/lib/utils/tags'

export type ActiveSpaceContextInclude = 'everything' | 'tabs' | 'resources'

export class ContextItemActiveSpaceContext extends ContextItemBase {
  type = ContextItemTypes.ACTIVE_SPACE
  activeSpace: Readable<OasisSpace | null>
  include: ActiveSpaceContextInclude

  currentSpaceId: Writable<string | null>
  item: Writable<ContextItemSpace | null>

  activeSpaceUnsub: () => void

  constructor(service: ContextService, include: ActiveSpaceContextInclude = 'everything') {
    super(service, ContextItemTypes.ACTIVE_SPACE, 'sparkles')

    this.include = include
    this.item = writable(null)
    this.currentSpaceId = writable(null)

    this.activeSpace = derived(
      [service.tabsManager.activeScopeId, service.tabsManager.oasis.spaces],
      ([activeScopeId, spaces]) => {
        if (!activeScopeId) {
          this.item.set(null)
          this.currentSpaceId.set(null)
          return null
        }

        const activeSpace = spaces.find((space) => space.id === activeScopeId)
        if (!activeSpace) {
          this.item.set(null)
          this.currentSpaceId.set(null)
          return null
        }

        if (activeSpace.id !== get(this.currentSpaceId)) {
          this.updateItem(activeSpace)
          return activeSpace
        } else {
          return null
        }
      }
    )

    this.label = derived([this.item], ([item]) => {
      if (item) {
        return item.labelValue
      } else {
        return 'Active Context'
      }
    })

    this.icon = derived([this.item], ([item]) => {
      return { type: ContextItemIconTypes.ICON, data: this.fallbackIcon } as ContextItemIcon
      // if (item) {
      //   return item.iconValue
      // } else {
      //   return { type: ContextItemIconTypes.ICON, data: this.fallbackIcon } as ContextItemIcon
      // }
    })

    this.iconString = derived([this.icon], ([icon]) => {
      return this.contextItemIconToString(icon, this.fallbackIcon)
    })

    // This is a hack to make sure the derived function above actually runs
    this.activeSpaceUnsub = this.activeSpace.subscribe(async (activeSpace) => {
      if (activeSpace) {
        this.log.debug('Active space changed', activeSpace.id)
        await tick()
      }
    })
  }

  get itemValue() {
    return get(this.item)
  }

  async updateItem(space: OasisSpace) {
    const existingItem = this.itemValue

    this.currentSpaceId.set(space.id)
    const newItem = new ContextItemSpace(this.service, space)
    this.item.set(newItem)

    // Only track if the item is new
    if (existingItem) {
      this.service.telemetry.trackPageChatContextUpdate(
        PageChatUpdateContextEventAction.ActiveContextChanged,
        1, // TODO: figure out how to get the correct count
        1,
        PageChatUpdateContextItemType.Space,
        PageChatUpdateContextEventTrigger.ContextSwitch
      )
    }
  }

  async getResourceIds(_prompt?: string) {
    const item = get(this.item)
    if (item) {
      let contentResources: string[] = []
      let tabResources: string[] = []

      if (this.include === 'everything' || this.include === 'resources') {
        const spaceResources = await item.getResourceIds()
        contentResources.push(...spaceResources)
      }

      if (this.include === 'everything' || this.include === 'tabs') {
        const scopedTabs = this.service.tabsManager.tabsValue.filter(
          (tab) => tab.scopeId === item.id && (tab.type === 'page' || tab.type === 'resource')
        ) as Array<TabPage | TabResource>

        const preparedResources = await Promise.all(
          scopedTabs.map(async (tab) => {
            if (tab.type === 'page') {
              const resource = await this.service.preparePageTab(tab)
              if (resource) {
                return resource.id
              } else {
                return null
              }
            } else {
              return tab.resourceId
            }
          })
        )

        const tabResourceIds = preparedResources.filter(Boolean) as string[]
        tabResources.push(...tabResourceIds)
      }

      return [...new Set([...contentResources, ...tabResources])]
    } else {
      let contentResources: string[] = []
      let tabResources: string[] = []

      if (this.include === 'everything' || this.include === 'resources') {
        const resourceIds = await this.service.resourceManager.listResourceIDsByTags(
          [...SearchResourceTags.NonHiddenDefaultTags()],
          true
        )
        contentResources.push(...resourceIds)
      }

      if (this.include === 'everything' || this.include === 'tabs') {
        const unscopedTabs = this.service.tabsManager.tabsValue.filter(
          (tab) => !tab.scopeId && (tab.type === 'page' || tab.type === 'resource')
        ) as Array<TabPage | TabResource>

        const preparedResources = await Promise.all(
          unscopedTabs.map(async (tab) => {
            if (tab.type === 'page') {
              const resource = await this.service.preparePageTab(tab)
              if (resource) {
                return resource.id
              } else {
                return null
              }
            } else {
              return tab.resourceId
            }
          })
        )

        const tabResourceIds = preparedResources.filter(Boolean) as string[]
        tabResources.push(...tabResourceIds)
      }

      return [...new Set([...contentResources, ...tabResources])]
    }
  }

  async getInlineImages() {
    const item = get(this.item)
    if (item) {
      return item.getInlineImages()
    } else {
      return []
    }
  }

  async generatePrompts() {
    const item = get(this.item)
    if (item) {
      return item.generatePrompts()
    } else {
      return []
    }
  }

  onDestroy() {
    this.log.debug('Destroying active space context item')
    this.activeSpaceUnsub()
  }
}
