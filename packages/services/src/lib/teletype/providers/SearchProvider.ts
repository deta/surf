import { type MentionItem } from '@deta/editor'
import type { ActionProvider, TeletypeAction } from '../types'
import { generateUUID, useLogScope } from '@deta/utils'
import { useBrowser } from '../../browser'

export class SearchProvider implements ActionProvider {
  readonly name = 'search'
  readonly isLocal = false // Async Google suggestions API calls
  private readonly browser = useBrowser()
  private readonly log = useLogScope('SearchProvider')

  canHandle(query: string): boolean {
    return query.trim().length >= 2
  }

  async getActions(query: string, _mentions: MentionItem[]): Promise<TeletypeAction[]> {
    const actions: TeletypeAction[] = []
    const trimmedQuery = query.trim()

    if (trimmedQuery.length < 2) return actions

    // Only return Google suggestions - current query is handled by CurrentQueryProvider
    try {
      const suggestions = await this.fetchSuggestions(trimmedQuery)
      suggestions.forEach((suggestion, index) => {
        actions.push(
          this.createSearchAction(suggestion, 80 - index, [
            'search',
            'suggestion',
            'google',
            'web search'
          ])
        )
      })
    } catch (error) {
      this.log.error('Failed to fetch search suggestions:', error)
    }

    return actions
  }

  private createSearchAction(query: string, priority: number, keywords: string[]): TeletypeAction {
    return {
      id: generateUUID(),
      name: query,
      icon: 'search',
      section: 'Search Suggestions',
      priority,
      keywords,
      description: ``,
      buttonText: 'Search Web',
      handler: async ({ viewId }) => {
        await this.browser.handleTeletypeNavigateURL(query, 'active_tab', viewId)
      }
    }
  }

  private async fetchSuggestions(query: string): Promise<string[]> {
    try {
      if (typeof window === 'undefined' || typeof fetch === 'undefined') {
        this.log.warn('fetch API not available')
        return []
      }

      const suggestions = await this.browser.getSearchSuggestions(query)

      // Filter out duplicates of the original query and limit to 2 suggestions
      // (since we already add the current query as top result)
      return suggestions
        .filter(
          (suggestion: string) => suggestion.toLowerCase().trim() !== query.toLowerCase().trim()
        )
        .slice(0, 2)
    } catch (error) {
      this.log.error('Error fetching Google suggestions:', error)
      return []
    }
  }
}
