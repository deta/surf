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
      const suggestions = await this.fetchGoogleSuggestions(trimmedQuery)
      suggestions.forEach((suggestion, index) => {
        actions.push(
          this.createSearchAction(suggestion, 80 - index, ['search', 'suggestion', 'google'])
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
      section: 'Search',
      priority,
      keywords,
      description: ``,
      buttonText: 'Search',
      handler: async () => {
        await this.searchGoogle(query)
      }
    }
  }

  private async fetchGoogleSuggestions(query: string): Promise<string[]> {
    try {
      if (typeof window === 'undefined' || typeof fetch === 'undefined') {
        this.log.warn('fetch API not available')
        return []
      }

      // @ts-ignore
      const data = await window.api.fetchJSON(
        `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(
          query
        )}`,
        {
          // HACK: this is needed to get Google to properly encode the suggestions, without this Umlaute are not encoded properly
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'
          }
        }
      )

      // Google returns an array where the second element contains the suggestions
      const suggestions = data[1] || []

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

  private async searchGoogle(query: string): Promise<void> {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`

    await this.browser.navigateToUrl(searchUrl, { target: 'active_tab' })
  }
}
