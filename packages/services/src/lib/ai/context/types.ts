import type { ContextItemActiveTab } from './activeTab'
import type { ContextItemEverything } from './everything'
import type { ContextItemInbox } from './inbox'
import type { ContextItemPageTab } from './pageTab'
import type { ContextItemResource } from './resource'
import type { ContextItemScreenshot } from './screenshot'
import type { ContextItemSpace } from './space'

export enum ContextItemTypes {
  RESOURCE = 'resource',
  SCREENSHOT = 'screenshot',
  SPACE = 'space',
  NOTEBOOK = 'notebook',
  PAGE_TAB = 'page-tab',
  ACTIVE_TAB = 'active-tab',
  ACTIVE_SPACE = 'active-context',
  INBOX = 'inbox',
  EVERYTHING = 'everything',
  WIKIPEDIA = 'wikipedia',
  WEB_SEARCH = 'web-search',
  BROWSING_HISTORY = 'browsing-history'
}

export enum ContextItemIconTypes {
  IMAGE = 'image',
  ICON = 'icon',
  ICON_FILE = 'icon-file',
  EMOJI = 'emoji',
  COLORS = 'colors'
}

export type ContextItemIconColors = {
  type: ContextItemIconTypes.COLORS
  data: string[]
}

export type ContextItemIconIcon = {
  type: ContextItemIconTypes.ICON
  data: string
}

export type ContextItemIconFile = {
  type: ContextItemIconTypes.ICON_FILE
  data: string
}

export type ContextItemIconImage = {
  type: ContextItemIconTypes.IMAGE
  data: string
}

export type ContextItemIconEmoji = {
  type: ContextItemIconTypes.EMOJI
  data: string
}

export type ContextItemIcon =
  | ContextItemIconColors
  | ContextItemIconIcon
  | ContextItemIconImage
  | ContextItemIconEmoji
  | ContextItemIconFile

export type StoredContextItem = {
  id: string
  type: string
  data?: string
}

export type ContextItem =
  | ContextItemResource
  | ContextItemScreenshot
  | ContextItemSpace
  | ContextItemActiveTab
  | ContextItemPageTab
  | ContextItemEverything
  | ContextItemInbox
