import { RightSidebarTab } from './browser.types'
import { WebViewEventTransform } from './ipc.webview.types'
import { AnnotationCommentData, AnnotationType } from './resources.types'

export enum TelemetryEventTypes {
  // --- OLD LEGACY EVENTS
  // CreateHorizon = 'Create Horizon',
  // DeleteHorizon = 'Delete Horizon',
  // ActivateHorizon = 'Activate Horizon',
  // AddCard = 'Add Card',
  // DeleteCard = 'Delete Card',
  // DuplicateCard = 'Duplicate Card',
  // UpdateCard = 'Update Card',
  // VisorSearch = 'Visor Search',
  // OasisOpen = 'Open Oasis',
  // OasisSearch = 'Search Oasis',
  // OasisDrag = 'Drag from Oasis',
  // OasisOpenResourceDetails = 'Open Oasis Resource Details',
  // CreateResource = 'Create Resource',
  // DeleteResource = 'Delete Resource',

  // --- NEW EVENTS
  CreateTab = 'Create Tab',
  ActivateTab = 'Activate Tab',
  ActivateTabSpace = 'Activate Tab Space',
  DeleteTab = 'Delete Tab',
  DeleteTabSpace = 'Delete Tab Space',
  MoveTab = 'Move Tab',

  // CreateResource = 'Create Resource',
  SaveToOasis = 'Save to Oasis',
  OpenOasis = 'Open Oasis',
  DeleteResource = 'Delete Resource',
  SearchOasis = 'Search Oasis',
  OpenResource = 'Open Resource',

  CreateSpace = 'Create Space',
  OpenSpace = 'Open Space',
  DeleteSpace = 'Delete Space',
  AddResourceToSpace = 'Add Resource to Space',
  UpdateSpaceSettings = 'Update Space Settings',
  RefreshSpaceContent = 'Refresh Space Content',
  ChatWithSpace = 'Chat with Space',

  UseInlineAI = 'Use Inline AI',
  CreateAnnotation = 'Create Annotation',
  DeleteAnnotation = 'Delete Annotation',
  OpenAnnotationSidebar = 'Open Annotations',
  OpenAnnotationResource = 'Open Annotation Resource',
  DropAnnotationResource = 'Drop Annotation Resource',
  PageChatMessageSent = 'Page Chat Message Sent',
  PageChatCitationClick = 'Page Chat Citation Click',
  PageChatCitationClickResourceFromSpace = 'Open Space Resource from Chat',
  PageChatClear = 'Page Chat Clear',
  PageChatContextUpdate = 'Page Chat Context Update',
  OpenPageChatSidebar = 'Open Page Chat',
  GoWildModifyPage = 'Go Wild Modify Page',
  GoWildCreateApp = 'Go Wild Create App',
  GoWildRerun = 'Go Wild Rerun',
  GoWildClear = 'Go Wild Clear',
  OpenGoWildSidebar = 'Open Go Wild',

  UpdatePrompt = 'Update Prompt',
  ResetPrompt = 'Reset Prompt',

  OpenRightSidebar = 'Open Right Sidebar',
  ToggleSidebar = 'Toggle Sidebar',
  ToggleTabsOrientation = 'Toggle Tabs Orientation',
  FileDownload = 'File Download',
  SetDefaultBrowser = 'Set Default Browser'
}

export enum CreateTabEventTrigger {
  /** Tab was created from the address bar */
  AddressBar = 'address_bar',
  /** Tab was created by clicking a link in a page */
  Page = 'page',
  /** Tab was created by opening the source of an item in Oasis */
  OasisItem = 'oasis_item',
  /** Tab was created by opening the source of a resource used in a chat */
  OasisChat = 'oasis_chat',
  /** Tab was created from the create menu in Oasis */
  OasisCreate = 'oasis_create',
  /** Tab was created by opening a item in the search */
  Search = 'search',
  /** Tab was created by dropping something in the tab list */
  Drop = 'drop',
  /** Tab was created by dropping something in the tab list */
  History = 'history',
  /** Tab was created because a URL was opened outside of the app / by the system */
  System = 'system',
  /** Tab was created by a unknown or other interaction */
  Other = 'Other'
}

export enum ActivateTabEventTrigger {
  /** Tab was activated by clicking on it in the tabs list */
  Click = 'click',
  /** Tab was activated by a keyboard shortcut */
  Shortcut = 'shortcut',
  /** Tab was activated by clicking a citation in the chat */
  ChatCitation = 'chat_citation',
  /** Tab was activated by opening a item in the search */
  Search = 'search'
}

export enum DeleteTabEventTrigger {
  /** Tab was deleted by clicking the close button */
  Click = 'click',
  /** Tab was deleted by a keyboard shortcut */
  Shortcut = 'shortcut',
  /** Tab was deleted using the command menu */
  CommandMenu = 'command_menu',
  /** Deleted from context menu */
  ContextMenu = 'context_menu'
}

export enum MoveTabEventAction {
  Pin = 'pin',
  Unpin = 'unpin',
  AddMagic = 'add_magic',
  RemoveMagic = 'remove_magic'
}

export enum OpenResourceEventFrom {
  Space = 'space',
  SpaceLive = 'space/live',
  Oasis = 'oasis',
  OasisChat = 'chat',
  History = 'history',
  NewTab = 'new_tab',
  Page = 'page',
  CommandMenu = 'command_menu'
}

export enum SaveToOasisEventTrigger {
  /** Page was saved by clicking the save button */
  Click = 'click',
  /** Page was saved by a keyboard shortcut */
  Shortcut = 'shortcut',
  /** Resource was created from the create menu */
  CreateMenu = 'create_menu',
  /** Page was saved from the command menu */
  CommandMenu = 'command_menu',
  /** Page was saved by dropping into Oasis or a Space */
  Drop = 'drop',
  /** Saved from context menu */
  ContextMenu = 'context_menu'
}

export enum SearchOasisEventTrigger {
  /** Search was done from the new tab command menu */
  CommandMenu = 'command_menu',
  /** Search was done from the oasis search input */
  Oasis = 'Oasis'
}

export enum CreateSpaceEventFrom {
  /** Space was created from the spaces view in Oasis */
  OasisSpacesView = 'oasis_spaces_view',
  /** Space was created from the space hover menu in the sidebar */
  SpaceHoverMenu = 'space_hover_menu',
  /** Space was created from the create live space button of a tab */
  TabLiveSpaceButton = 'tab_live_space_button',
  /** Created from context menu */
  ContextMenu = 'context_menu' // TODO: ctx impl
}

export enum RefreshSpaceEventTrigger {
  /** Space was renamed and processed with AI */
  RenameSpaceWithAI = 'rename_space_with_ai',
  /** Live space was opened and refreshed */
  LiveSpaceAutoRefreshed = 'live_space_auto_refreshed',
  /** Live space was manually refreshed */
  LiveSpaceManuallyRefreshed = 'live_space_manually_refreshed'
}

export enum UpdateSpaceSettingsEventTrigger {
  /** Space settings were changed from the settings menu */
  SettingsMenu = 'settings_menu',
  /** Space settings were changed from the space preview in Oasis */
  SpacePreview = 'space_preview',
  /** Space settings were changed when adding the tab as a source to the space */
  TabLiveSpaceButton = 'tab_live_space_button'
}

export enum OpenSpaceEventTrigger {
  /** Space was opened from the spaces view in Oasis */
  SpacesView = 'spaces_view',
  /** Space was opened from the hover menu in the sidebar */
  SidebarMenu = 'sidebar_menu'
}

export enum AddResourceToSpaceEventTrigger {
  /** Resource was dropped into the space */
  Drop = 'drop',
  /** Resource was moved by selecting the space from the tab context menu */
  TabMenu = 'tab_menu'
}

export enum DeleteSpaceEventTrigger {
  /** Space was deleted from the spaces view in Oasis */
  SpacesView = 'spaces_view',
  /** Space was deleted from its settings */
  SpaceSettings = 'space_settings',
  /** Deleted from context menu */
  ContextMenu = 'context_menu' // TODO: ctx impl
}

export enum CreateAnnotationEventTrigger {
  /** Annotation created from within the page */
  PageInline = 'page_inline',
  /** Annotation created from the sidebar */
  PageSidebar = 'page_sidebar',
  /** Annotation created by saving inline AI output */
  InlinePageAI = 'inline_page_ai',
  /** Annotation created by saving sidebar chat output */
  PageChatMessage = 'page_chat_message'
}

export enum DeleteAnnotationEventTrigger {
  /** Annotation deleted from within the page */
  PageInline = 'page_inline',
  /** Annotation deleted from the sidebar */
  PageSidebar = 'page_sidebar'
}

export enum PageChatUpdateContextEventAction {
  /** A tab was added to the context */
  Add = 'add',
  /** A tab was removed from the context */
  Remove = 'remove',
  /** All other tabs were removed except one */
  ExcludeOthers = 'exclude_others',
  /** The active tab changed and was added to the context */
  ActiveChanged = 'active_changed',
  /** Multiple tabs were selected */
  MultiSelect = 'multi_select'
}

export enum PageChatMessageSentEventError {
  RAGEmptyContext = 'RAG_EMPTY_CONTEXT',
  Other = 'OTHER'
}

export type UpdateSpaceSettingsEventChange = {
  setting: 'name' | 'live_mode' | 'sort_by' | 'source' | 'hide_viewed' | 'smart_filter'
  change: boolean | null | 'added' | 'removed' | 'created_at' | 'source_published_at'
}

export type InlineAIEventPromptType = WebViewEventTransform['type']

export type CreateAnnotationEventType = AnnotationType
export type DeleteAnnotationEventType = AnnotationType

export type OpenRightSidebarEventTab = RightSidebarTab

export interface ElectronAppInfo {
  version: string
  platform: string
}

export type EditablePrompt = {
  id: string
  kind: 'inline' | 'page'
  title: string
  description: string
  content: string
  createdAt: string
  updatedAt: string
}
