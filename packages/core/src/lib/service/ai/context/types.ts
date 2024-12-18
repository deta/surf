import type { ContextItemActiveSpaceContext } from './activeSpaceContexts'
import type { ContextItemActiveTab } from './activeTab'
import type { ContextItemPageTab } from './pageTab'
import type { ContextItemResource } from './resource'
import type { ContextItemScreenshot } from './screenshot'
import type { ContextItemSpace } from './space'

export enum ContextItemTypes {
  RESOURCE = 'resource',
  SCREENSHOT = 'screenshot',
  SPACE = 'space',
  PAGE_TAB = 'page-tab',
  ACTIVE_TAB = 'active-tab',
  ACTIVE_SPACE = 'active-space'
}

export enum ContextItemIconTypes {
  IMAGE = 'image',
  ICON = 'icon',
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
  | ContextItemActiveSpaceContext
  | ContextItemPageTab
