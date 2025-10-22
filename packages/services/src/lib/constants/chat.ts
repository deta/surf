import { MentionItemType, type MentionItem } from '@deta/editor'

export enum ContextItemTypes {
  RESOURCE = 'resource',
  SCREENSHOT = 'screenshot',
  SPACE = 'space',
  PAGE_TAB = 'page-tab',
  ACTIVE_TAB = 'active-tab',
  ACTIVE_SPACE = 'active-context',
  INBOX = 'inbox',
  EVERYTHING = 'everything',
  WIKIPEDIA = 'wikipedia',
  WEB_SEARCH = 'web-search',
  BROWSING_HISTORY = 'browsing-history'
}

export const NO_CONTEXT_MENTION = {
  id: 'general',
  label: 'No Context',
  suggestionLabel: 'No Context',
  aliases: ['general', 'none', 'no context'],
  icon: 'icon;;circle',
  type: MentionItemType.BUILT_IN
} as MentionItem

export const EVERYTHING_MENTION = {
  id: ContextItemTypes.EVERYTHING,
  label: 'Surf',
  suggestionLabel: 'All my Stuff',
  aliases: ['everything', 'all my stuff', 'all your stuff', 'surf'],
  icon: 'icon;;save',
  type: MentionItemType.BUILT_IN
} as MentionItem

export const INBOX_MENTION = {
  id: ContextItemTypes.INBOX,
  label: 'Inbox',
  suggestionLabel: 'Inbox',
  aliases: ['inbox', 'home', 'stuff', 'surf', 'recent'],
  icon: 'icon;;circle-dot',
  type: MentionItemType.BUILT_IN
} as MentionItem

export const ACTIVE_CONTEXT_MENTION = {
  id: ContextItemTypes.ACTIVE_SPACE,
  label: 'Active',
  suggestionLabel: 'Active Context',
  icon: 'icon;;sparkles',
  type: MentionItemType.BUILT_IN
} as MentionItem

export const ACTIVE_TAB_MENTION = {
  id: ContextItemTypes.ACTIVE_TAB,
  label: 'Active Tab',
  suggestionLabel: 'Active Tab',
  aliases: ['tab', 'active'],
  icon: 'icon;;sparkles',
  type: MentionItemType.BUILT_IN
} as MentionItem

export const TABS_MENTION = {
  id: 'tabs',
  label: 'Tabs',
  suggestionLabel: 'Open Tabs',
  aliases: ['tabs', 'context', 'active'],
  icon: 'icon;;world',
  type: MentionItemType.BUILT_IN
} as MentionItem

export const WIKIPEDIA_SEARCH_MENTION = {
  id: ContextItemTypes.WIKIPEDIA,
  label: 'Wikipedia',
  suggestionLabel: 'Ask Wikipedia',
  aliases: ['wiki'],
  icon: 'image;;https://en.wikipedia.org/static/favicon/wikipedia.ico',
  type: MentionItemType.BUILT_IN
} as MentionItem

export const BROWSER_HISTORY_MENTION = {
  id: ContextItemTypes.BROWSING_HISTORY,
  label: 'Browsing History',
  suggestionLabel: 'Browsing History',
  aliases: ['history', 'browser history', 'tabs'],
  icon: 'icon;;history',
  type: MentionItemType.BUILT_IN
} as MentionItem

export const WEB_SEARCH_MENTION = {
  id: ContextItemTypes.WEB_SEARCH,
  label: 'Web Search',
  suggestionLabel: 'Web Search',
  aliases: ['web', 'web search'],
  icon: 'icon;;world',
  type: MentionItemType.BUILT_IN
} as MentionItem

export const MODEL_CLAUDE_MENTION = {
  id: 'model-anthropic',
  label: 'Claude',
  suggestionLabel: 'Ask Claude',
  aliases: ['anthropic', 'claude', 'sonnet'],
  icon: 'icon;;claude',
  type: MentionItemType.MODEL,
  hideInSearch: false
} as MentionItem

export const MODEL_GPT_MENTION = {
  id: 'model-openai',
  label: 'ChatGPT',
  suggestionLabel: 'Ask ChatGPT',
  aliases: ['openai', 'gpt', 'gpt-4o'],
  icon: 'icon;;open-ai',
  type: MentionItemType.MODEL,
  hideInSearch: false
} as MentionItem

export const MODEL_GEMINI_MENTION = {
  id: 'model-gemini',
  label: 'Gemini',
  suggestionLabel: 'Ask Gemini',
  aliases: ['gemini', 'flash'],
  icon: 'icon;;gemini',
  type: MentionItemType.MODEL,
  hideInSearch: false
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
  TABS_MENTION,
  EVERYTHING_MENTION,
  MODEL_CLAUDE_MENTION,
  MODEL_GPT_MENTION,
  MODEL_GEMINI_MENTION
  //NO_CONTEXT_MENTION
  // WIKIPEDIA_SEARCH_MENTION // This is a conditional mention, depends on user settings
]
