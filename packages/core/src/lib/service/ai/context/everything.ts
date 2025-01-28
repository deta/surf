import { writable } from 'svelte/store'

import { ResourceTypes, ResourceTagsBuiltInKeys } from '../../../types'

import { ContextItemBase } from './base'
import type { ContextManager } from '../contextManager'
import { ContextItemTypes } from './types'
import { ResourceManager } from '../../resources'

export class ContextItemEverything extends ContextItemBase {
  type = ContextItemTypes.EVERYTHING

  constructor(manager: ContextManager) {
    super(manager, 'everything', 'save')

    this.label = writable('All My Stuff')
  }

  async getResourceIds(_prompt?: string) {
    const resourceIds = await this.manager.resourceManager.listResourceIDsByTags([
      ResourceManager.SearchTagDeleted(false),
      ResourceManager.SearchTagResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
      ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING),
      ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.SILENT),
      ResourceManager.SearchTagResourceType(ResourceTypes.ANNOTATION, 'ne')
    ])

    return resourceIds
  }

  async getInlineImages() {
    // TODO: in theory we could grab all image resources here
    return []
  }

  async generatePrompts() {
    return []
  }
}
