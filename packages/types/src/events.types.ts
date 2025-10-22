import { type RightSidebarTab } from './browser.types'
import { type ContextViewDensity, type ContextViewType } from './contexts.types'
import { type WebViewEventTransform } from './ipc.webview.types'
import { type AnnotationType } from './resources.types'

/** @deprecated - OLD SURF-alpha TYPES ==================== */

export type AIMessageContext = 'inline' | 'chat'
export type AIMessageBaseMedia = 'image' | 'text' | 'webpage' | 'pdf'

export enum CreateTabEventTrigger {
  /** Tab was created from the address bar */
  AddressBar = 'address_bar',
  /** Tab was created by clicking a link in a page */
  Page = 'page',
  /** Tab was created by opening the source of an item in Oasis */
  OasisItem = 'oasis_item',
  /** Tab was created by opening multiple sources in Oasis */
  OasisMultiSelect = 'oasis_multi_select',
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
  /** Tab was created by opening the source of a item from the stack */
  StackItem = 'stack_item',
  /** Tab was created because a URL was opened outside of the app / by the system */
  System = 'system',
  /** Tab was created from the context menu */
  ContextMenu = 'context_menu',
  /** Tab was created from the homescreen */
  Homescreen = 'homescreen',
  /** Tab was created from inside a space on the homescreen */
  HomescreenSpace = 'homescreen_space',
  /** Tab was created from a note */
  NoteCitation = 'note_citation',
  /** Tab was created from a link in a note */
  NoteLink = 'note_link',
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
  Search = 'search',
  /** Tab was activated by clicking it in Oasis */
  Oasis = 'oasis',
  /** Tab was activated by selecting inside the command menu */
  CommandMenu = 'command_menu'
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

export enum ChangeContextEventTrigger {
  ContextSwitcher = 'context_switcher',
  Tab = 'tab',
  SpaceInOasis = 'space_in_oasis',
  CommandMenu = 'command_menu',
  Homescreen = 'homescreen',
  Note = 'note'
}

export enum BrowserContextScope {
  General = 'general',
  Space = 'space'
}

export enum OpenResourceEventFrom {
  Space = 'space',
  SpaceLive = 'space/live',
  Oasis = 'oasis',
  OasisChat = 'chat',
  History = 'history',
  NewTab = 'new_tab',
  Page = 'page',
  CommandMenu = 'command_menu',
  Stack = 'stack',
  Homescreen = 'homescreen'
}

export enum OpenInMiniBrowserEventFrom {
  Oasis = 'oasis',
  Stack = 'stack',
  Chat = 'chat',
  PinnedTab = 'pinned_tab',
  WebPage = 'web_page',
  Homescreeen = 'homescreen',
  CommandMenu = 'command_menu',
  Note = 'note',
  NoteLink = 'note_link'
}

export enum DeleteResourceEventTrigger {
  /** Resource was deleted from the resource view in Oasis */
  OasisItem = 'oasis',
  /** Resource was deleted by selecting multiple in Oasis */
  OasisMultiSelect = 'oasis_multi_select'
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
  ContextMenu = 'context_menu',
  /** Saved from the mini browser */
  MiniBrowser = 'mini_browser',
  /* When dropped onto homescreen -> Saving */
  Homescreen = 'homescreen',
  /* Saved from the space tab bar */
  SpaceTabBar = 'space_tab_bar'
}

export enum EventContext {
  /** Inline menu */
  Inline = 'inline',
  /** Sidebar chat */
  Chat = 'chat',
  /** Tab items */
  Tabs = 'tabs',
  /** Stuff Overlay */
  StuffOverlay = 'stuff_overlay',
  /** Resource Overlay aka Mini Browser */
  ResourceOverlay = 'resource_overlay',
  /** Homescreen */
  Homescreen = 'homescreen',
  /** Command menu */
  CommandMenu = 'command_menu',
  /** Space View  */
  Space = 'space',
  /** Notes */
  Note = 'note',
  /** Within a webpage */
  Webpage = 'webpage',
  /** Shortcut */
  Shortcut = 'shortcut'
}

export enum SearchOasisEventTrigger {
  /** Search was done from the new tab command menu */
  CommandMenu = 'command_menu',
  /** Search was done from the oasis search input */
  Oasis = 'Oasis'
}

export enum CreateSpaceEventFrom {
  // Created from context switcher inside tabs
  ContextSwitcher = 'context_switcher',
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
  TabMenu = 'tab_menu',
  /** Tab was saved to a space from the space tab bar */
  SpaceTabBar = 'space_tab_bar',
  /** Resource was moved by dropping it on the space's homescreen */
  DropHomescreen = 'drop_homescreen',
  /** Resource was saved to the space by selecting it when saving chat output */
  Chat = 'chat'
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
  /** The active context changed or was added to the context */
  ActiveContextChanged = 'active_context_changed',
  /** Multiple tabs were selected */
  MultiSelect = 'multi_select',
  /** Context was cleared completely */
  Clear = 'clear'
}

export enum PageChatUpdateContextEventTrigger {
  DragAndDrop = 'drag_and_drop',
  TabSelection = 'tab_selection',
  ChatAddContextMenu = 'chat_add_context_menu',
  ChatContextItem = 'chat_context_item',
  Onboarding = 'onboarding',
  ContextSwitch = 'context_switch',
  ActiveTabChanged = 'active_tab_changed',
  EditorMention = 'editor_mention',
  StuffContext = 'stuff_context'
}

export enum PageChatUpdateContextItemType {
  PageTab = 'page_tab',
  Resource = 'resource',
  Space = 'space',
  Screeenshot = 'screenshot',
  ActiveTab = 'active_tab',
  ActiveSpace = 'active_space'
}

export enum SelectTabEventAction {
  /** A tab was added to the selection */
  Add = 'add',
  /** A tab was removed from the selection */
  Remove = 'remove',
  /** Multiple tabs were added to/removed from the selection */
  MultiSelect = 'multi_select'
}

export enum MultiSelectResourceEventAction {
  OpenAsTab = 'open_as_tab',
  AddToChat = 'add_to_chat',
  AddToSpace = 'add_to_space',
  Delete = 'delete'
}

export enum PageChatMessageSentEventError {
  APIKeyMissing = 'api_key_missing',
  BadRequest = 'bad_request',
  Unauthorized = 'unauthorized',
  RAGEmptyContext = 'rag_empty_context',
  TooManyRequests = 'too_many_requests',
  Other = 'other'
}

export enum PageChatMessageSentEventTrigger {
  SidebarChat = 'sidebar_chat',
  InlineAI = 'inline_ai',
  NoteAutocompletion = 'note_autocompletion',
  NoteUseSuggestion = 'note_use_suggestion',
  NoteRewrite = 'note_rewrite',
  NoteSimilaritySearch = 'note_similarity_search',
  NoteChatInput = 'note_chat_input',
  NoteWebSearch = 'note_web_search',
  TeletypeAsk = 'teletype_ask'
}

export enum PromptType {
  BuiltIn = 'built_in',
  Custom = 'custom',
  Generated = 'generated'
}

export enum GeneratePromptsEventTrigger {
  ActiveTabChange = 'active_tab_change',
  Click = 'click',
  Shortcut = 'shortcut'
}

export type UpdateSpaceSettingsEventChange = {
  setting:
    | 'name'
    | 'live_mode'
    | 'sort_by'
    | 'sort_order'
    | 'source'
    | 'hide_viewed'
    | 'smart_filter'
    | 'view_type'
    | 'view_density'
  change:
    | (
        | boolean
        | null
        | 'added'
        | 'removed'
        | 'resource_created'
        | 'resource_updated'
        | 'resource_added_to_space'
        | 'resource_source_published'
        | 'name'
        | 'asc'
        | 'desc'
      )
    | ContextViewType
    | ContextViewDensity
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

export enum OpenHomescreenEventTrigger {
  /** Open from "home" button in sidebar */
  Click = 'click',
  /** Open from keyboard shortcut */
  Shortcut = 'shortcut',
  /** Open from command menu */
  CommandMenu = 'command_menu',
  /** By dragging over the home button / possible another drag touchpoint in the future */
  DragOver = 'drag_over',
  /** Onboarding */
  Onboarding = 'onboarding'
}

export enum AddHomescreenItemEventTrigger {
  /** Place by dropping */
  Drop = 'drop'
  /** Pin from command menu */
  //CommandMenu = 'command_menu'
  /* Right click menu e.g. inside stuff */
  //ContextMenu = 'context_menu',
}

export enum AddHomescreenItemEventSource {
  Tabs = 'tabs',
  Stack = 'stack',
  CommandMenu = 'command_menu',
  Stuff = 'stuff',
  Chat = 'chat',
  NativeDrop = 'native_drop'
  // Webpage = 'webpage',
}

export enum RemoveHomescreenItemEventTrigger {
  /* Right click menu */
  ContextMenu = 'context_menu'
  /* Possible trashbin area in the future? */
  //TrashBin = 'trash_bin'
}

export enum UpdateHomescreenEventAction {
  MoveItem = 'move_item',
  ResizeItem = 'resize_item',
  SetBackground = 'set_background'
}

export enum MentionEventType {
  Context = 'context',
  GeneralContext = 'general_context',
  ActiveContext = 'active_context',
  Everything = 'everything',
  Tabs = 'tabs',
  Resource = 'resource',
  BUILT_IN = 'built-in'
}

export enum SummarizeEventContentSource {
  Resource = 'resource',
  Citation = 'citation'
}

export enum NoteCreateCitationEventTrigger {
  Drop = 'drop'
}

export type PageChatMessageSentData = {
  contextSize: number
  numSpaces: number
  numTabs: number
  numResources: number
  numScreenshots: number
  numPreviousMessages: number
  tookPageScreenshot: boolean
  embeddingModel?: string
  chatModelProvider?: string
  chatModelName?: string
  error?: PageChatMessageSentEventError
  trigger?: PageChatMessageSentEventTrigger
  onboarding?: boolean
  generatedArtifact?: boolean
}
