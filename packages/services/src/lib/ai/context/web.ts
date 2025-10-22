import { writable } from 'svelte/store'

import { ContextItemBase } from './base'
import type { ContextService } from '../contextManager'
import { ContextItemTypes } from './types'
import { ResourceTag } from '@deta/utils/formatting'
import { extractAndCreateWebResource } from '../../mediaImporter'
import type { SearchResultLink } from '@deta/web-parser'

export class ContextItemWebSearch extends ContextItemBase {
  type = ContextItemTypes.WEB_SEARCH

  createdResourceIds: string[] = []
  links: SearchResultLink[] = []

  constructor(service: ContextService, links: SearchResultLink[] = []) {
    super(service, 'web_search', 'world')

    this.label = writable('Web Search')
    this.links = links
  }

  async getResourceIds() {
    if (this.links.length === 0) {
      this.log.debug('No links provided for web search context item, skipping resource creation')
      return []
    }
    this.log.debug('Creating resources from web links', this.links)

    const resourceIds = await Promise.all(
      this.links.map(async (link) => {
        try {
          const { resource } = await extractAndCreateWebResource(
            this.service.resourceManager,
            link.url,
            { name: link.title, sourceURI: link.url },
            [ResourceTag.silent(), ResourceTag.createdForChat()]
          )

          this.log.debug('Created resource for page', link, resource)

          return resource.id
        } catch (error) {
          this.log.error('Error creating resource for page', link, error)
          return null
        }
      })
    )

    const filteredResourceIds = resourceIds.filter((id) => id !== null) as string[]

    this.createdResourceIds.push(...filteredResourceIds)

    return filteredResourceIds
  }

  async getInlineImages() {
    // TODO: in theory we could grab all image resources here
    return []
  }

  async generatePrompts() {
    return []
  }

  onDestroy(): void {
    this.log.debug('Destroying web search context item, cleaning up', this.createdResourceIds)

    if (this.createdResourceIds.length > 0) {
      this.service.resourceManager.deleteResources(this.createdResourceIds)
    }
  }
}
