import { type MentionItem } from '@deta/editor'
import type { ActionProvider, TeletypeAction } from '../types'
import {
  normalizeURL,
  generateUUID,
  useLogScope,
  parseStringIntoBrowserLocation
} from '@deta/utils'
import { type TeletypeService } from '../teletypeService'

export class NavigationProvider implements ActionProvider {
  readonly name = 'navigation'
  readonly isLocal = true // Local URL validation and navigation

  private readonly service: TeletypeService
  private readonly log = useLogScope('NavigationProvider')

  constructor(service: TeletypeService) {
    this.service = service
  }

  canHandle(query: string): boolean {
    const url = parseStringIntoBrowserLocation(query)
    return !!url || query.trim().length > 0
  }

  async getActions(query: string, _mentions: MentionItem[]): Promise<TeletypeAction[]> {
    const actions: TeletypeAction[] = []
    const trimmedQuery = query.trim()

    if (!trimmedQuery) return actions

    const url = parseStringIntoBrowserLocation(query)

    // If it looks like a URL, provide navigation action
    if (url) {
      const normalizedUrl = normalizeURL(url)

      actions.push({
        id: `navigation-${generateUUID()}`,
        name: `Go to ${normalizedUrl}`,
        icon: `favicon;;${url}`,
        section: 'Navigation',
        priority: 100,
        keywords: ['navigate', 'go', 'visit', 'url', 'website'],
        buttonText: 'Navigate',
        // description: `Navigate to ${normalizedUrl}`,
        handler: async () => {
          await this.service.navigateToUrlOrSearch(url)
        }
      })
    }

    // Always provide a search action as fallback
    // actions.push({
    //   id: generateUUID(),
    //   name: `Search for "${trimmedQuery}"`,
    //   icon: 'search',
    //   section: 'Search',
    //   priority: 50,
    //   keywords: ['search', 'find', 'web'],
    //   buttonText: 'Search',
    //   description: `Search the web for "${trimmedQuery}"`,
    //   handler: async () => {
    //     await this.service.navigateToUrlOrSearch(trimmedQuery)
    //   }
    // })

    return actions
  }
}
