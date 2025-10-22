import type { CreateTabEventTrigger, EventContext } from '@deta/types'
import type { AIChatMessageSource } from '@deta/types/src/ai.types'

export enum RendererType {
  Main = 'main',
  WebContentsView = 'webContentsView'
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

/**
 * @deprecated Use `CreateTabOptions` from @deta/services instead
 */
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

export type PageHighlightSelectionData = {
  source: AIChatMessageSource
  sourceUid: string
  text?: string
  timestamp?: number
}

export type CitationClickEvent = {
  resourceId?: string
  url?: string
  preview: boolean | OpenTarget
  skipHighlight: boolean
  selection?: PageHighlightSelectionData
}

export type OpenAndChatEventObject = { type: 'resource' | 'tab'; id: string }
export type OpenAndChatEvent = string | string[] | OpenAndChatEventObject | OpenAndChatEventObject[]

export const BROWSER_CONTEXT_KEY = 'browser-utils'

export type RightSidebarTab = 'chat' | 'annotations' | 'root'

export type OpenTarget = 'tab' | 'background_tab' | 'active_tab' | 'sidebar' | 'auto'

export type OpenResourceOptions = {
  resourceId: string
  target?: OpenTarget
  offline?: boolean
  from_notebook_tree_sidebar?: boolean
}

export type OpenNotebookOptions = {
  notebookId: string
  target?: OpenTarget
  from_notebook_tree_sidebar?: boolean
}

export type NavigateURLOptions = {
  url: string
  target?: OpenTarget
}

export enum ViewType {
  /**
   * External web pages
   * @example https://example.com
   */
  Page = 'page',
  /**
   * A specific notebook
   * @example surf://surf/notebook/:id
   */
  Notebook = 'notebook',
  /**
   * The notebooks home/root view
   * @example surf://surf/notebook
   */
  NotebookHome = 'notebook_home',
  /**
   * A specific resource (most likely note)
   * @example surf://surf/resource/:id
   */
  Resource = 'resource',
  /**
   * Some other internal page
   */
  Internal = 'internal'
}

export type ViewTypeData = {
  /**
   * The type of view
   */
  type: ViewType
  /**
   * Unique identifier for the resource or notebook displayed in the view
   */
  id: string | null
  /**
   * Weather the view is in `raw` mode e.g. for a resource or is PDF viewer
   */
  raw?: boolean
}

export enum ViewLocation {
  Tab = 'tab',
  Sidebar = 'sidebar'
}
