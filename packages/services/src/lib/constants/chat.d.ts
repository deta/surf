import { type MentionItem } from '@deta/editor'
export declare enum ContextItemTypes {
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
export declare const NO_CONTEXT_MENTION: MentionItem
export declare const EVERYTHING_MENTION: MentionItem
export declare const INBOX_MENTION: MentionItem
export declare const ACTIVE_CONTEXT_MENTION: MentionItem
export declare const ACTIVE_TAB_MENTION: MentionItem
export declare const TABS_MENTION: MentionItem
export declare const WIKIPEDIA_SEARCH_MENTION: MentionItem
export declare const BROWSER_HISTORY_MENTION: MentionItem
export declare const WEB_SEARCH_MENTION: MentionItem
export declare const MODEL_CLAUDE_MENTION: MentionItem
export declare const MODEL_GPT_MENTION: MentionItem
export declare const MODEL_GEMINI_MENTION: MentionItem
export declare const NOTE_MENTION: MentionItem
export declare const BUILT_IN_MENTIONS_BASE: MentionItem[]
