import { writable } from 'svelte/store'

import { type TabPage, ResourceTypes, ResourceTagsBuiltInKeys } from '../../../types'

import { ContextItemBase } from './base'
import type { ContextService } from '../contextManager'
import { ContextItemTypes } from './types'
import { ResourceManager } from '../../resources'

export class ContextItemInbox extends ContextItemBase {
  type = ContextItemTypes.INBOX

  constructor(service: ContextService) {
    super(service, 'inbox', 'circle-dot')

    this.label = writable('Inbox')
  }

  async getResourceIds(_prompt?: string) {
    const unscopedTabs = this.service.tabsManager.tabsValue.filter(
      (tab) => tab.type === 'page' && !tab.scopeId
    ) as TabPage[]

    const preparedResources = await Promise.all(
      unscopedTabs.map((tab) => this.service.preparePageTab(tab))
    )
    const scopedTabResourceIds = preparedResources.filter(Boolean).map((resource) => resource!.id)

    const resourceIds = await this.service.resourceManager.listResourceIDsByTags(
      [
        ResourceManager.SearchTagDeleted(false),
        ResourceManager.SearchTagResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
        ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING),
        ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.SILENT),
        ResourceManager.SearchTagResourceType(ResourceTypes.ANNOTATION, 'ne')
      ],
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
