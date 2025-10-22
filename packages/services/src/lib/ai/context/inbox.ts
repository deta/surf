import { writable } from 'svelte/store'

import { ContextItemBase } from './base'
import type { ContextService } from '../contextManager'
import { ContextItemTypes } from './types'
import { SearchResourceTags } from '@deta/utils/formatting'
import { TabItem } from '../../tabs'

export class ContextItemInbox extends ContextItemBase {
  type = ContextItemTypes.INBOX

  constructor(service: ContextService) {
    super(service, 'inbox', 'circle-dot')

    this.label = writable('Inbox')
  }

  async getResourceIds(_prompt?: string) {
    const unscopedTabs = this.service.tabsManager.tabsValue

    const preparedResources = await Promise.all(
      unscopedTabs.map((tab) => this.service.preparePageTab(tab))
    )
    const scopedTabResourceIds = preparedResources.filter(Boolean).map((resource) => resource!.id)

    const resourceIds = await this.service.resourceManager.listResourceIDsByTags(
      [...SearchResourceTags.NonHiddenDefaultTags()],
      true
    )

    return [...new Set([...resourceIds, ...scopedTabResourceIds])]
  }

  async getInlineImages() {
    // TODO: in theory we could grab all image resources here
    return []
  }

  async generatePrompts() {
    return []
  }
}
