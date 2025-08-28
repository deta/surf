import { writable } from 'svelte/store'

import { optimisticParseJSON } from '@deta/utils'
import { ModelTiers } from '@deta/types/src/ai.types'

import { ContextItemBase } from './base'
import type { ContextService } from '../contextManager'
import { ContextItemIconTypes, ContextItemTypes } from './types'
import { ResourceManager } from '../../resources'
import { ResourceTag } from '@deta/utils/formatting'
import { BROWSER_HISTORY_QUERY_PROMPT } from '../../constants/prompts'
import { extractAndCreateWebResource } from '../../mediaImporter'
import { type HistoryEntry } from '@deta/types'

export type BrowserHistoryQuery = {
  query: string
  type: 'prefix' | 'keyword'
  since?: Date
}

export class ContextItemBrowsingHistory extends ContextItemBase {
  type = ContextItemTypes.BROWSING_HISTORY

  resourceManager: ResourceManager

  createdResourceIds: string[] = []

  constructor(service: ContextService) {
    super(service, 'browser history', 'history', {
      type: ContextItemIconTypes.ICON,
      data: 'history'
    })

    this.label = writable('Browsing History')

    this.resourceManager = service.resourceManager
  }

  async getResourceIds(prompt?: string) {
    if (!prompt) {
      this.log.debug('No prompt provided')
      return []
    }

    this.log.debug('Getting history query from prompt:', prompt)
    const completion = await this.service.ai.createChatCompletion(
      prompt,
      BROWSER_HISTORY_QUERY_PROMPT.replace('$DATE', new Date().toISOString()),
      { tier: ModelTiers.Standard }
    )

    let queries: BrowserHistoryQuery[] = [{ query: prompt, type: 'keyword', since: undefined }]
    if (!completion.error && completion.output) {
      const clean = completion.output
        .replace('```json\n', '')
        .replace('```json', '')
        .replace('\n```', '')
        .replace('```', '')

      const parsed = optimisticParseJSON(clean)
      this.log.debug('Parsed JSON from completion:', parsed)
      if (parsed && Array.isArray(parsed)) {
        // make sure all items are of type BrowserHistoryQuery
        queries = parsed
          .map((item) => {
            if (typeof item === 'string') {
              return { query: item, type: 'keyword', since: undefined }
            } else if (typeof item === 'object' && item.query && item.type) {
              return {
                query: item.query,
                type: item.type,
                since: item.since ? new Date(item.since) : undefined
              }
            } else {
              return undefined
            }
          })
          .filter((item) => item !== undefined)
          .slice(0, 5) // limit to 5 queries
      } else {
        queries = [{ query: completion.output, type: 'keyword', since: undefined }]
      }
    }

    this.log.debug('Searching history for:', queries)

    const historyEntriesRaw = await Promise.all(
      queries.map(async (item) => {
        let items: HistoryEntry[]
        if (item.type === 'prefix') {
          items = await this.resourceManager.searchHistoryEntriesByHostnamePrefix(
            item.query,
            item.since
          )
        } else {
          items = await this.resourceManager.searchHistoryEntriesByUrlAndTitle(
            item.query,
            item.since
          )
        }

        this.log.debug('Got history entries:', items)
        return items
      })
    )

    const historyEntries = historyEntriesRaw
      .flat()
      .filter((entry) => entry !== null)
      .filter((entry, index, self) => self.findIndex((e) => e.id === entry.id) === index)
      .filter((entry) => entry.url) // filter out entries without URL
      .slice(0, 5) // limit to 5 entries

    if (historyEntries.length === 0) {
      this.log.debug('No history entries found')
      return []
    }

    this.log.debug('Creating resources for history entry:', historyEntries)

    const resourceIds = await Promise.all(
      historyEntries.map(async (entry) => {
        try {
          const { resource } = await extractAndCreateWebResource(
            this.resourceManager,
            entry.url!,
            { name: entry.title, sourceURI: entry.url },
            [ResourceTag.silent(), ResourceTag.createdForChat()]
          )

          this.log.debug('Created resource for history entry', entry, resource)

          return resource.id
        } catch (error) {
          this.log.error('Error creating resource for history entry', entry, error)
          return null
        }
      })
    )

    const filteredResourceIds = resourceIds.filter((id) => id !== null) as string[]

    this.createdResourceIds.push(...filteredResourceIds)

    return filteredResourceIds
  }

  async getInlineImages() {
    return []
  }

  async generatePrompts() {
    return []
  }

  onDestroy(): void {
    this.log.debug('Destroying BrowsingHistory context item, cleaning up', this.createdResourceIds)

    if (this.createdResourceIds.length > 0) {
      this.service.resourceManager.deleteResources(this.createdResourceIds)
    }
  }
}
