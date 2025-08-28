import type { ActionProvider, TeletypeAction } from '../types'
import { generateUUID, useLogScope, prependProtocol } from '@deta/utils'

export class SearchProvider implements ActionProvider {
  readonly name = 'search'
  readonly isLocal = false // Async Google suggestions API calls
  private readonly log = useLogScope('SearchProvider')

  canHandle(query: string): boolean {
    return query.trim().length >= 2
  }

  async getActions(query: string): Promise<TeletypeAction[]> {
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

      const response = await fetch(
        `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'
          }
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

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

  private async navigateToUrl(url: string): Promise<void> {
    try {
      const fullUrl = prependProtocol(url, true)
      window.location.href = fullUrl
    } catch (error) {
      this.log.error('Failed to navigate to URL:', error)
    }
  }

  private async searchGoogle(query: string): Promise<void> {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`

    await this.navigateToUrl(searchUrl)
  }
}
