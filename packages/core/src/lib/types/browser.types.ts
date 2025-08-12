import type {
  CreateTabEventTrigger,
  DetectedWebApp,
  EventContext,
  PageChatUpdateContextEventTrigger
} from '@deta/types'
import type { Resource, ResourceHistoryEntry } from '../service/resources'
import type { ContextItem } from '../service/ai/context'
import type { AIChatMessageParsed, AIChatMessageSource } from '@deta/types/src/ai.types'

export interface BaseTab {
  id: string
  createdAt: string
  updatedAt: string
  section?: string
  title: string
  customTitle?: string
  icon: string
  type:
    | 'page'
    | 'horizon'
    | 'chat'
    | 'empty'
    | 'importer'
    | 'space'
    | 'history'
    | 'resource'
    | 'onboarding'
    | 'invites'
  archived: boolean
  index: number
  pinned: boolean
  magic: boolean
  scopeId?: string
}

export interface TabPage extends BaseTab {
  type: 'page'
  initialLocation: string
  currentLocation?: string
  historyStackIds: string[]
  currentHistoryIndex: number
  navigationHistory?: Electron.NavigationEntry[]
  resourceBookmark?: string | null
  resourceBookmarkedManually?: boolean
  chatResourceBookmark?: string | null
  chatId?: string | null
  appId?: string | null
  currentDetectedApp?: DetectedWebApp
}

export interface TabChat extends BaseTab {
  type: 'chat'
  query: string
  chatId?: string
  apiEndpoint?: string
  ragOnly?: boolean
}

export interface TabHorizon extends BaseTab {
  type: 'horizon'
  horizonId: string
}

export interface TabEmpty extends BaseTab {
  type: 'empty'
}

export interface TabImporter extends BaseTab {
  type: 'importer'
}

export interface TabSpace extends BaseTab {
  type: 'space'
  spaceId: string
  colors: [string, string]
}

export interface TabHistory extends BaseTab {
  type: 'history'
}

export interface TabResource extends BaseTab {
  type: 'resource'
  resourceId: string
  resourceType: string
}

export interface TabOnboarding extends BaseTab {
  type: 'onboarding'
  section?: string
}

export interface TabInvites extends BaseTab {
  type: 'invites'
}

export type Tab =
  | TabPage
  | TabChat
  | TabHorizon
  | TabEmpty
  | TabImporter
  | TabSpace
  | TabHistory
  | TabResource
  | TabOnboarding
  | TabInvites

export type PageMagicResponse = {
  id: string
  role: 'system' | 'user'
  query?: string
  status: 'success' | 'pending' | 'error'
  content: string
  citations: Record<string, { color: string; text: string }>
}

export type PageMagic = {
  chatId?: string
  showSidebar: boolean
  running: boolean
  initializing: boolean
  errors: string[]
  responses: AIChatMessageParsed[]
}

export type AppsSidebar = {
  showSidebar: boolean
  running: boolean
  code: string
}

export type PageHighlight = {
  type: 'important' | 'statistic' | 'pro' | 'contra' | 'quote'
  color?: string
  text: string
}

export type DroppedTabLocation = { dropZoneID: 'pinned-tabs' | 'tabs'; index: number }
export type DroppedTab = { from: DroppedTabLocation; to: DroppedTabLocation }

export type ResourceHistoryEntryWithLinkedResource = {
  id: string
  entryResource: ResourceHistoryEntry
  linkedResource: Resource | null
}

export type CreateTabOptions = {
  active?: boolean
  placeAtEnd?: boolean
  index?: number
  scopeId?: string
  trigger?: CreateTabEventTrigger
}

export type ControlWindow = 'minimize' | 'toggle-maximize' | 'close'

export type NewTabEvent = {
  url: string
  active: boolean
  trigger?: CreateTabEventTrigger
}

export type NewResourceTabEvent = {
  resourceId: string
  active: boolean
  trigger?: CreateTabEventTrigger
}

export type BookmarkTabState = 'idle' | 'in_progress' | 'success' | 'error' | 'saved'

export type AddContextItemEvent = {
  item: ContextItem
  trigger: PageChatUpdateContextEventTrigger
}

export type ChatWithSpaceEvent = {
  spaceId: string
  text?: string
}

export type HighlightWebviewTextEvent = {
  resourceId?: string
  answerText: string
  sourceUid?: string
  preview: boolean
  source?: AIChatMessageSource
  context?: EventContext
}
export type JumpToWebviewTimestampEvent = {
  resourceId?: string
  timestamp: number
  preview: boolean
  context?: EventContext
  sourceUid?: string
  source?: AIChatMessageSource
}

export type OpenAndChatEventObject = { type: 'resource' | 'tab'; id: string }
export type OpenAndChatEvent = string | string[] | OpenAndChatEventObject | OpenAndChatEventObject[]

export const BROWSER_CONTEXT_KEY = 'browser-utils'
