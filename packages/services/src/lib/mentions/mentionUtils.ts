import Fuse from 'fuse.js'
import { generateUUID } from '@deta/utils'
import type { MentionItem, MentionType } from './mention.types'

/**
 * Create a new mention item with a unique ID
 */
export function createMentionItem(
  type: MentionType,
  name: string,
  options: Partial<MentionItem> = {}
): MentionItem {
  return {
    id: generateUUID(),
    type,
    name,
    icon: 'squircle',
    ...options
  }
}

/**
 * Filter and sort mention items using Fuse.js fuzzy search
 */
export function filterAndSortMentions(
  items: MentionItem[],
  query: string,
  maxResults?: number
): MentionItem[] {
  if (!query.trim()) {
    return maxResults ? items.slice(0, maxResults) : items
  }

  const fuse = new Fuse(items, {
    keys: [
      { name: 'name', weight: 0.7 },
      { name: 'description', weight: 0.2 },
      { name: 'keywords', weight: 0.1 }
    ],
    threshold: 0.3,
    includeScore: true,
    shouldSort: true
  })

  const results = fuse.search(query)
  const filtered = results
    .map((result) => result.item)
    .filter((item) => item.name !== 'Untitled Tab')

  return maxResults ? filtered.slice(0, maxResults) : filtered
}
