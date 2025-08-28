import { writable } from 'svelte/store'

import { SearchResourceTags } from '@deta/utils/formatting'

import { ContextItemBase } from './base'
import type { ContextService } from '../contextManager'
import { ContextItemTypes } from './types'

export class ContextItemEverything extends ContextItemBase {
  type = ContextItemTypes.EVERYTHING

  constructor(service: ContextService) {
    super(service, 'everything', 'save')

    this.label = writable('All my Stuff')
  }

  async getResourceIds(_prompt?: string) {
    const resourceIds = await this.service.resourceManager.listResourceIDsByTags([
      ...SearchResourceTags.NonHiddenDefaultTags()
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
