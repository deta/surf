import type { ActionProvider, TeletypeAction } from '../types'
import {
  optimisticCheckIfUrl,
  normalizeURL,
  generateUUID,
  prependProtocol,
  useLogScope
} from '@deta/utils'

export class NavigationProvider implements ActionProvider {
  readonly name = 'navigation'
  readonly isLocal = true // Local URL validation and navigation
  private readonly log = useLogScope('NavigationProvider')

  canHandle(query: string): boolean {
    return optimisticCheckIfUrl(query) || query.trim().length > 0
  }

  async getActions(query: string): Promise<TeletypeAction[]> {
    const actions: TeletypeAction[] = []
    const trimmedQuery = query.trim()

    if (!trimmedQuery) return actions

    // If it looks like a URL, provide navigation action
    if (optimisticCheckIfUrl(trimmedQuery)) {
      const normalizedUrl = normalizeURL(trimmedQuery)

      actions.push({
        id: generateUUID(),
        name: `Go to ${normalizedUrl}`,
        icon: 'world',
        section: 'Navigation',
        priority: 100,
        keywords: ['navigate', 'go', 'visit', 'url', 'website'],
        buttonText: 'Go',
        description: `Navigate to ${normalizedUrl}`,
        handler: async () => {
          await this.navigateToUrl(normalizedUrl)
        }
      })
    }

    // Always provide a search action as fallback
    actions.push({
      id: generateUUID(),
      name: `Search for "${trimmedQuery}"`,
      icon: 'search',
      section: 'Search',
      priority: 50,
      keywords: ['search', 'find', 'google'],
      description: `Search Google for "${trimmedQuery}"`,
      handler: async () => {
        await this.searchGoogle(trimmedQuery)
      }
    })

    return actions
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
