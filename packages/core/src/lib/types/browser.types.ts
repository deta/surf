import type {
  CreateTabEventTrigger,
  DetectedWebApp,
  PageChatUpdateContextEventTrigger
} from '@horizon/types'
import type { Resource, ResourceHistoryEntry } from '../service/resources'
import type { OasisSpace } from '../service/oasis'

export interface BaseTab {
  id: string
  createdAt: string
  updatedAt: string
  section?: string
  title: string
  icon: string
  type:
    | 'page'
    | 'horizon'
    | 'chat'
    | 'empty'
    | 'importer'
    | 'space'
    | 'oasis-discovery'
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

export interface TabOasisDiscovery extends BaseTab {
  type: 'oasis-discovery'
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
  | TabOasisDiscovery
  | TabHistory
  | TabResource
  | TabOnboarding
  | TabInvites

export type AIChat = {
  id: string
  messages: AIChatMessage[]
}

export type AIDocsSimilarity = {
  index: number
  similarity: number
}

export type AIChatMessageRole = 'user' | 'system' | 'assistant'

export type AIChatMessage = {
  role: AIChatMessageRole
  status: 'success' | 'pending' | 'error'
  query: string
  content: string
  sources?: AIChatMessageSource[]
}

export type AIChatMessageParsed = {
  id: string
  role: AIChatMessageRole
  query: string
  content: string
  contentItems?: ChatMessageContentItem[]
  sources?: AIChatMessageSource[]
  usedPageScreenshot?: boolean
  usedInlineScreenshot?: boolean
  status?: 'success' | 'pending' | 'error'
}

export type AIChatMessageSource = {
  id: string
  all_chunk_ids: string[]
  render_id: string
  resource_id: string
  content: string
  uid?: string
  metadata?: {
    timestamp?: number
    url?: string
    page?: number
  }
}

export type ChatMessageContentItem = {
  type: 'text' | 'citation'
  content: string
}

export type YoutubeTranscriptPiece = {
  text: string
  start: number
  duration: number
}

export type YoutubeTranscript = {
  transcript: string
  metadata: {
    source: string
    transcript_pieces: YoutubeTranscriptPiece[]
  }
}

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

export type BookmarkTabState = 'idle' | 'in_progress' | 'success' | 'error'

export type ContextItem =
  | ContextItemScreenshot
  | ContextItemTab
  | ContextItemResource
  | ContextItemSpace

export type ContextItemScreenshot = {
  id: string
  type: 'screenshot'
  data: Blob
}

export type ContextItemTab = {
  id: string
  type: 'tab'
  data: Tab
}

export type ContextItemResource = {
  id: string
  type: 'resource'
  data: Resource
}

export type ContextItemSpace = {
  id: string
  type: 'space'
  data: OasisSpace
}

export type AddContextItemEvent = {
  item: ContextItem
  trigger: PageChatUpdateContextEventTrigger
}

export type ChatWithSpaceEvent = {
  spaceId: string
  text?: string
}
