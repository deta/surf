import { type MentionItem } from '@deta/editor'
import type { ActionProvider, TeletypeAction } from '../types'
import { generateUUID, useLogScope, prependProtocol, getFileKind, normalizeURL } from '@deta/utils'
import { useResourceManager } from '../../resources'
import { type HistoryEntry } from '@deta/types'
import { useBrowser } from '../../browser'

export class HostnameProvider implements ActionProvider {
  readonly name = 'hostname-search'
  readonly isLocal = false // Async Google suggestions API calls
  private readonly log = useLogScope('HostnameProvider')
  private readonly resourceManager = useResourceManager()
  private readonly browser = useBrowser()

  canHandle(query: string): boolean {
    return query.trim().length >= 2
  }

  async getActions(query: string, _mentions: MentionItem[]): Promise<TeletypeAction[]> {
    const actions: TeletypeAction[] = []
    const trimmedQuery = query.trim()

    if (trimmedQuery.length < 2) return actions

    try {
      const results = await this.searchHostnames(trimmedQuery)
      if (results.length > 0) {
        const historyEntry = results[0]
        const normalizedUrl = normalizeURL(historyEntry.url!)
        actions.push(
          this.createHistoryEntryAction(historyEntry, normalizedUrl.startsWith(query) ? 110 : 90, [
            'history',
            'suggestion',
            'hostname'
          ])
        )
      }
    } catch (error) {
      this.log.error('Failed to fetch search suggestions:', error)
    }

    return actions
  }

  private createHistoryEntryAction(
    entry: HistoryEntry,
    priority: number,
    keywords: string[]
  ): TeletypeAction {
    const url = entry.url ? prependProtocol(entry.url) : null
    return {
      id: `hostname-${generateUUID()}`,
      name: `Go to ${normalizeURL(url!)}`,
      icon: url ? `favicon;;${url}` : `file;;${getFileKind(entry.type)}`,
      section: 'Navigation',
      priority,
      keywords,
      // description: `Navigate to ${normalizeURL(url!)}`,
      buttonText: 'Navigate',
      handler: async ({ viewId }) => {
        await this.browser.handleTeletypeNavigateURL(entry.url!, 'active_tab', viewId)
      }
    }
  }

  private async searchHostnames(query: string): Promise<HistoryEntry[]> {
    try {
      const now = new Date()
      const since = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 90) // 90 days
      const historyEntries = await this.resourceManager.searchHistoryEntriesByHostnamePrefix(
        query,
        since
      )

      return historyEntries
    } catch (error) {
      this.log.error('Error fetching Google suggestions:', error)
      return []
    }
  }
}
