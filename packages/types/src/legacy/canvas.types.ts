import type { Instance } from './instance.types'
import type { App } from './app.types'

export enum CanvasItemType {
  SYSTEM_APP = 'system_app',
  PROJECT = 'project',
  INSTANCE = 'instance'
}

export interface CanvasItemBase {
  id: string
  index_number: number
  item_id: string
  item_type: CanvasItemType
  data: unknown
}

export interface CanvasItemProject extends CanvasItemBase {
  item_type: CanvasItemType.PROJECT
  data: App
}

export interface CanvasItemInstance extends CanvasItemBase {
  item_type: CanvasItemType.INSTANCE
  data: Instance
}

export interface CanvasItemSystemApp extends CanvasItemBase {
  item_type: CanvasItemType.SYSTEM_APP
  item_id: 'builder' | 'collections' | 'docs' | 'discovery' | 'legacy_cloud'
  data: null
}

export type CanvasItem = CanvasItemSystemApp | CanvasItemInstance | CanvasItemProject

export interface ILegacyCanvas {
  items: CanvasItem[]
  pagination: {
    count: number
    last: string | null
  }
}
