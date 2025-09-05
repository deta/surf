import { type MentionItem } from '@deta/editor'
import type { ActionProvider, TeletypeAction } from '../types'
import {
  generateUUID,
  useLogScope,
  optimisticCheckIfURLOrIPorFile,
  prependProtocol
} from '@deta/utils'
import { type TeletypeService } from '../teletypeService'

export class CurrentQueryProvider implements ActionProvider {
  readonly name = 'current-query'
  readonly isLocal = true // Instant, no async operations
  private readonly log = useLogScope('CurrentQueryProvider')
  private readonly service: TeletypeService

  constructor(service: TeletypeService) {
    this.service = service
  }

  canHandle(query: string): boolean {
    const trimmedQuery = query.trim()
    if (trimmedQuery.length < 2) return false

    // Don't show search action for URLs - let navigation providers handle those
    return !optimisticCheckIfURLOrIPorFile(trimmedQuery)
  }

  async getActions(query: string, _mentions: MentionItem[]): Promise<TeletypeAction[]> {
    const trimmedQuery = query.trim()
    if (trimmedQuery.length < 2) return []

    // Return only the current query as instant search action
    return [this.createSearchAction(trimmedQuery)]
  }

  private createSearchAction(query: string): TeletypeAction {
    return {
      id: generateUUID(),
      name: query,
      icon: 'search',
      section: 'Search',
      priority: 100, // Highest priority to appear at top
      keywords: ['search', 'current', 'query'],
      description: ``,
      buttonText: 'Search',
      handler: async () => {
        await this.searchGoogle(query)
      }
    }
  }

  private async searchGoogle(query: string): Promise<void> {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`

    await this.service.navigateToUrl(searchUrl)
  }
}
