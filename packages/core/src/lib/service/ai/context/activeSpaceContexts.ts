import { tick } from 'svelte'
import { type Writable, type Readable, writable, derived, get } from 'svelte/store'

import type { TabPage } from '../../../types'
import type { OasisSpace } from '../../oasis'

import { ContextItemBase } from './base'
import type { ContextManager } from '../contextManager'
import { ContextItemSpace } from './space'
import { ContextItemTypes, ContextItemIconTypes, type ContextItemIcon } from './types'
import {
  PageChatUpdateContextEventAction,
  PageChatUpdateContextEventTrigger,
  PageChatUpdateContextItemType
} from '@horizon/types'

export class ContextItemActiveSpaceContext extends ContextItemBase {
  type = ContextItemTypes.ACTIVE_SPACE
  activeSpace: Readable<OasisSpace | null>

  currentSpaceId: Writable<string | null>
  item: Writable<ContextItemSpace | null>

  constructor(manager: ContextManager) {
    super(manager, ContextItemTypes.ACTIVE_SPACE, 'browser')

    this.item = writable(null)
    this.currentSpaceId = writable(null)

    this.activeSpace = derived(
      [manager.tabsManager.activeScopeId, manager.tabsManager.oasis.spaces],
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
      if (item) {
        return item.iconValue
      } else {
        return { type: ContextItemIconTypes.ICON, data: this.fallbackIcon } as ContextItemIcon
      }
    })

    this.activeSpace.subscribe(async (activeSpace) => {
      if (activeSpace) {
        await tick()
        this.log.debug('Active space changed', activeSpace.id)
      }
    })
  }

  get itemValue() {
    return get(this.item)
  }

  async updateItem(space: OasisSpace) {
    const existingItem = this.itemValue

    this.currentSpaceId.set(space.id)
    const newItem = new ContextItemSpace(this.manager, space)
    this.item.set(newItem)

    // Only track if the item is new
    if (existingItem) {
      this.manager.telemetry.trackPageChatContextUpdate(
        PageChatUpdateContextEventAction.ActiveContextChanged,
        this.manager.itemsValue.length,
        1,
        PageChatUpdateContextItemType.Space,
        PageChatUpdateContextEventTrigger.ContextSwitch
      )
    }
  }

  async getResourceIds() {
    const item = get(this.item)
    if (item) {
      const spaceResources = await item.getResourceIds()

      // Combine the saved resources with the resources from the tabs that are open in the context
      const scopedTabs = this.manager.tabsManager.tabsValue.filter(
        (tab) => tab.type === 'page' && tab.scopeId === item.id
      ) as TabPage[]

      const preparedResources = await Promise.all(
        scopedTabs.map((tab) => this.manager.preparePageTab(tab))
      )
      const scopedTabResourceIds = preparedResources.filter(Boolean).map((resource) => resource!.id)

      return [...new Set([...spaceResources, ...scopedTabResourceIds])]
    } else {
      const unscopedTabs = this.manager.tabsManager.tabsValue.filter(
        (tab) => tab.type === 'page' && !tab.scopeId
      ) as TabPage[]

      const preparedResources = await Promise.all(
        unscopedTabs.map((tab) => this.manager.preparePageTab(tab))
      )
      const scopedTabResourceIds = preparedResources.filter(Boolean).map((resource) => resource!.id)

      // TODO: use resources from the home context i.e. all resources that are not in a context

      return scopedTabResourceIds
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
}
