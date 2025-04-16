import { MentionItemType, type MentionItem } from '@horizon/editor'
import { generalContext } from './browsingContext'

export const NO_CONTEXT_MENTION = {
  id: 'general',
  label: 'No Context',
  suggestionLabel: 'No Context',
  aliases: ['general', 'none', 'no context'],
  icon: 'icon;;circle',
  type: MentionItemType.BUILT_IN
} as MentionItem

export const GENERAL_CONTEXT_MENTION = {
  id: generalContext.id,
  label: generalContext.label,
  suggestionLabel: 'Home Context',
  aliases: ['inbox', 'general'],
  icon: 'icon;;circle-dot',
  type: MentionItemType.BUILT_IN
} as MentionItem

export const EVERYTHING_MENTION = {
  id: 'everything',
  label: 'Surf',
  suggestionLabel: 'Everything in Surf',
  aliases: ['everything', 'all my stuff', 'all your stuff', 'surf'],
  icon: 'icon;;save',
  type: MentionItemType.BUILT_IN
} as MentionItem

export const ACTIVE_CONTEXT_MENTION = {
  id: 'active-context',
  label: 'Active',
  suggestionLabel: 'Active Context',
  icon: 'icon;;sparkles',
  type: MentionItemType.BUILT_IN
} as MentionItem

export const TABS_MENTION = {
  id: 'tabs',
  label: 'Tabs',
  suggestionLabel: 'Your Tabs',
  aliases: ['tabs', 'context', 'active'],
  icon: 'icon;;world',
  type: MentionItemType.BUILT_IN
} as MentionItem

export const WIKIPEDIA_SEARCH_MENTION = {
  id: 'wikipedia',
  label: 'Wikipedia',
  suggestionLabel: 'Ask Wikipedia',
  aliases: ['wiki'],
  icon: 'favicon;;https://wikipedia.org',
  type: MentionItemType.BUILT_IN
} as MentionItem

export const MODEL_CLAUDE_MENTION = {
  id: 'model-anthropic',
  label: 'Anthropic',
  suggestionLabel: 'Ask Anthropic',
  aliases: ['anthropic', 'claude', 'sonnet'],
  icon: 'icon;;claude',
  type: MentionItemType.MODEL,
  hideInSearch: true
} as MentionItem

export const MODEL_GPT_MENTION = {
  id: 'model-openai',
  label: 'OpenAI',
  suggestionLabel: 'Ask OpenAI',
  aliases: ['openai', 'gpt', 'gpt-4o'],
  icon: 'icon;;open-ai',
  type: MentionItemType.MODEL,
  hideInSearch: true
} as MentionItem

export const NOTE_MENTION = {
  id: 'note',
  label: 'Note',
  suggestionLabel: 'This Note',
  aliases: ['this', 'myself', 'active'],
  icon: 'icon;;docs',
  type: MentionItemType.BUILT_IN
} as MentionItem

export const BUILT_IN_MENTIONS_BASE = [
  GENERAL_CONTEXT_MENTION,
  EVERYTHING_MENTION,
  TABS_MENTION,
  MODEL_CLAUDE_MENTION,
  MODEL_GPT_MENTION
  //NO_CONTEXT_MENTION
  // WIKIPEDIA_SEARCH_MENTION // This is a conditional mention, depends on user settings
]
