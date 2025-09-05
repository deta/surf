import type { MentionProvider, MentionItem, MentionType } from '../mention.types'
import { MentionTypes } from '../mention.types'
import { filterAndSortMentions } from '../mentionUtils'
import type { TabsService, TabItem } from '../../tabs/tabs.svelte'
import { useLogScope } from '@deta/utils'

export class TabsMentionProvider implements MentionProvider {
  readonly name = 'tabs'
  readonly type: MentionType = MentionTypes.TAB
  readonly isLocal = true
  private readonly log = useLogScope('TabsMentionProvider')

  private tabsService?: TabsService

  constructor(tabsService?: TabsService) {
    this.tabsService = tabsService
  }

  async initialize(): Promise<void> {
    // Initialize with tabs manager if not provided in constructor
    this.log.debug('Initialized')
  }

  canHandle(query: string): boolean {
    return true // Always handle queries, including empty ones to show all tabs
  }

  async getMentions(query: string): Promise<MentionItem[]> {
    if (!this.tabsService) {
      this.log.warn('No tabs service available')
      return []
    }

    try {
      const tabs = this.tabsService.tabsValue
      const activeTab = this.tabsService.activeTabValue

      if (!tabs || tabs.length === 0) {
        return []
      }

      const activeTabItem: MentionItem = {
        id: 'active_tab',
        type: MentionTypes.ACTIVE_TAB,
        name: `Active Tab`,
        icon: 'sparkles',
        description: `Currently active tab`,
        priority: 200,
        keywords: ['active', 'tab', 'current', 'focused'],
        metadata: {
          isAllTabs: false
        }
      }

      // Add default "All Tabs" action
      const allTabsItem: MentionItem = {
        id: 'all_tabs',
        type: MentionTypes.ALL_TABS,
        name: `All Tabs (${tabs.length})`,
        icon: 'world',
        description: `All ${tabs.length} open tabs`,
        priority: 200,
        keywords: ['all', 'tabs', 'every', 'everything', 'surf'],
        metadata: {
          isAllTabs: true,
          tabCount: tabs.length
        }
      }

      const mentionItems: MentionItem[] = [
        activeTabItem,
        allTabsItem,
        ...tabs
          .filter((tab: TabItem) => {
            const title = tab.view.titleValue || 'Untitled Tab'
            return title !== 'Untitled Tab'
          })
          .map((tab: TabItem) => {
            const isActive = activeTab?.id === tab.id
            const title = tab.view.titleValue || 'Untitled Tab'
            const url = tab.view.urlValue || ''
            const favicon = tab.view.faviconURLValue || ''

            return {
              id: tab.id,
              type: MentionTypes.TAB,
              name: title,
              icon: favicon,
              description: url ? `${url}` : undefined,
              priority: isActive ? 100 : 50,
              keywords: [
                'tab',
                title.toLowerCase(),
                url.toLowerCase(),
                isActive ? 'active' : 'inactive',
                url ? new URL(url).hostname.toLowerCase() : ''
              ].filter(Boolean),
              metadata: {
                tabId: tab.id,
                url: url,
                isActive,
                favicon: favicon,
                title: title
              }
            }
          })
      ]

      // Strip the @ character from the query for filtering
      const searchQuery = query.startsWith('@') ? query.slice(1) : query

      // Filter and sort by query relevance
      return filterAndSortMentions(mentionItems, searchQuery)
    } catch (error) {
      this.log.error('Error fetching tabs for mentions:', error)
      return []
    }
  }

  destroy(): void {
    // Cleanup if needed
    this.tabsService = undefined
  }

  /**
   * Update the tabs service reference
   */
  setTabsService(tabsService: TabsService): void {
    this.tabsService = tabsService
  }
}
