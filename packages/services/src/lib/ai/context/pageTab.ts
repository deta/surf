import { get } from 'svelte/store'
import { type Writable, writable, derived } from 'svelte/store'

import { ContextItemResource } from './resource'
import type { ContextService } from '../contextManager'
import { ContextItemIconTypes, ContextItemTypes, type ContextItemIcon } from './types'
import { ContextItemBase } from './base'
import { TabItem } from '../../tabs'
import { tick } from 'svelte'
import { wait } from '@deta/utils'

export class ContextItemPageTab extends ContextItemBase {
  type = ContextItemTypes.PAGE_TAB
  data: Writable<TabItem | null>

  item: Writable<ContextItemResource | null>
  private initializationPromise: Promise<void> | null = null

  constructor(service: ContextService, tab: TabItem) {
    super(service, tab.id, 'browser')

    this.data = writable(tab)
    this.item = writable(null)

    this.label = derived([this.item, this.data], ([item, data]) => {
      if (item) {
        return item.labelValue
      } else if (data) {
        return data.titleValue
      } else {
        return 'Tab'
      }
    })

    this.icon = derived([this.item, this.data], ([item, data]) => {
      if (item) {
        return item.iconValue
      }

      if (data) {
        return {
          type: ContextItemIconTypes.IMAGE,
          data: data.view.faviconURLValue
        } as ContextItemIcon
      }

      return { type: ContextItemIconTypes.ICON, data: this.fallbackIcon } as ContextItemIcon
    })

    this.iconString = derived([this.icon], ([icon]) => {
      return this.contextItemIconToString(icon, this.fallbackIcon)
    })

    this.initPageTab()
  }

  get dataValue() {
    return get(this.data)
  }

  get itemValue() {
    return get(this.item)
  }

  async initPageTab() {
    this.initializationPromise = (async () => {
      try {
        const tab = this.dataValue
        if (!tab) {
          this.log.debug('Invalid tab', tab)
          this.item.set(null)
          throw new Error('Invalid tab')
        }

        const resource = await this.service.preparePageTab(tab)
        if (!resource) {
          this.log.error('Failed to prepare page tab', tab.id)
          this.item.set(null)
          throw new Error('Failed to prepare page tab')
        }

        const newItem = new ContextItemResource(this.service, resource, tab)
        this.item.set(newItem)
      } catch (error) {
        this.initializationPromise = null
        throw error
      }
    })()

    try {
      await this.initializationPromise
    } catch (error) {
      this.initializationPromise = null
      throw error
    }
  }

  async getResourceIds(prompt?: string) {
    if (this.initializationPromise) {
      await this.initializationPromise

      // wait for store to update
      await tick()

      // make sure resource has time to initialize / kick off post processing
      await wait(200)
    }

    const item = get(this.item)
    if (item) {
      return item.getResourceIds(prompt)
    } else {
      this.log.warn('No item found for getting resource ids')
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
