import { Resource } from '../service/resources'
import { OasisSpace } from '../service/oasis'

export interface BaseRenderableItem {
  id: string
  type: 'resource' | 'space'
  updatedAt?: string
  createdAt?: string
  resource_added_to_space?: string
}

export interface ResourceRenderableItem extends BaseRenderableItem {
  id: string
  type: 'resource'
  data: Resource | null
}

export interface SpaceRenderableItem extends BaseRenderableItem {
  id: string
  type: 'space'
  data: OasisSpace
}

export type RenderableItem = ResourceRenderableItem | SpaceRenderableItem
