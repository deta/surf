import { Resource } from '@deta/services/resources'
import type { HistoryEntry } from '@deta/types'

import { OasisSpace } from '../service/oasis'

export enum RenderableItemType {
  Resource = 'resource',
  Space = 'space',
  HistoryEntry = 'history_entry'
}

export interface BaseRenderableItem {
  id: string
  type: RenderableItemType
  updatedAt?: string
  createdAt?: string
  resource_added_to_space?: string
}

export interface ResourceRenderableItem extends BaseRenderableItem {
  id: string
  type: RenderableItemType.Resource
  data: Resource | null
}

export interface SpaceRenderableItem extends BaseRenderableItem {
  id: string
  type: RenderableItemType.Space
  data: OasisSpace
}

export interface HistoryEntryRenderableItem extends BaseRenderableItem {
  id: string
  type: RenderableItemType.HistoryEntry
  data: HistoryEntry
}

export type RenderableItem =
  | ResourceRenderableItem
  | SpaceRenderableItem
  | HistoryEntryRenderableItem
