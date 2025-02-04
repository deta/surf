import type { MentionItem } from '@horizon/editor'
import { generalContext } from './browsingContext'

export const GENERAL_CONTEXT_MENTION = {
  id: generalContext.id,
  label: generalContext.label,
  suggestionLabel: 'Home Context',
  aliases: ['inbox', 'general'],
  icon: 'icon;;circle-dot',
  type: 'built-in'
} as MentionItem

export const EVERYTHING_MENTION = {
  id: 'everything',
  label: 'Surf',
  suggestionLabel: 'Everything in Surf',
  aliases: ['everything', 'all my stuff', 'all your stuff', 'surf'],
  icon: 'icon;;save',
  type: 'built-in'
} as MentionItem

export const TABS_MENTION = {
  id: 'tabs',
  label: 'Tabs',
  suggestionLabel: 'Your Tabs',
  aliases: ['tabs', 'context', 'active'],
  icon: 'icon;;world',
  type: 'built-in'
} as MentionItem

export const WEB_SEARCH_MENTION = {
  id: 'wikipedia',
  label: 'Wikipedia',
  suggestionLabel: 'Search Wikipedia',
  aliases: ['wiki'],
  icon: 'favicon;;https://wikipedia.org',
  type: 'built-in'
} as MentionItem

export const BUILT_IN_MENTIONS_BASE = [
  GENERAL_CONTEXT_MENTION,
  EVERYTHING_MENTION,
  TABS_MENTION
  // WEB_SEARCH_MENTION // This is a conditional mention, depends on user settings
]
