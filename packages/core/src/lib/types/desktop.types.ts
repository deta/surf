import type { DesktopBackgroundData } from '../service/desktop'

export interface GridRect {
  x: number
  y: number
  width: number
  height: number
}

export type DesktopItemData = DesktopResourceItemData | DesktopSpaceItemData

export interface DesktopBaseItemData {
  id: string

  // Position
  x: number
  y: number
  z: number
  width: number
  height: number

  type: 'resource' | 'space' | 'command_menu_item'
}
export interface DesktopResourceItemData extends DesktopBaseItemData {
  type: 'resource'
  resourceId: string
}

export interface DesktopSpaceItemData extends DesktopBaseItemData {
  type: 'space'
  spaceId: string
  viewLayout: 'list' | 'masonry'
}

export interface DesktopData {
  id: string
  createdAt: string
  updatedAt: string
  items: DesktopItemData[]
  background_image?: DesktopBackgroundData
}
