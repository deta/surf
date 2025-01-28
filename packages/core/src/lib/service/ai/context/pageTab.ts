import { get } from 'svelte/store'
import { type Writable, writable, derived } from 'svelte/store'

import type { TabPage } from '../../../types'

import { ContextItemResource } from './resource'
import type { ContextManager } from '../contextManager'
import { ContextItemIconTypes, ContextItemTypes, type ContextItemIcon } from './types'
import { ContextItemBase } from './base'

export class ContextItemPageTab extends ContextItemBase {
  type = ContextItemTypes.PAGE_TAB
  data: Writable<TabPage | null>

  item: Writable<ContextItemResource | null>

  constructor(manager: ContextManager, tab: TabPage) {
    super(manager, tab.id, 'browser')

    this.data = writable(tab)
    this.item = writable(null)

    this.label = derived([this.item], ([item]) => {
      if (item) {
        return item.labelValue
      } else {
        return 'Tab'
      }
    })

    this.icon = derived([this.item], ([item]) => {
      if (item) {
        return item.iconValue
      }

      const tab = this.dataValue
      if (tab) {
        return { type: ContextItemIconTypes.IMAGE, data: this.dataValue.icon } as ContextItemIcon
      }

      return { type: ContextItemIconTypes.ICON, data: this.fallbackIcon } as ContextItemIcon
    })

    this.initPageTab()
  }

  get dataValue() {
    return get(this.data)
  }

  async initPageTab() {
    const tab = this.dataValue
    if (!tab || tab.type !== 'page') {
      this.log.debug('Invalid tab', tab)
      this.item.set(null)
      return
    }

    const resource = await this.manager.preparePageTab(tab)
    if (!resource) {
      this.log.error('Failed to prepare page tab', tab.id)
      this.item.set(null)
      return
    }

    const newItem = new ContextItemResource(this.manager, resource, tab)
    this.item.set(newItem)
  }

  async getResourceIds(prompt?: string) {
    const item = get(this.item)
    if (item) {
      return item.getResourceIds(prompt)
    } else {
      return []
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
