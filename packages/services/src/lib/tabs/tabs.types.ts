import type { PageHighlightSelectionData, WebContentsViewData } from '@deta/types'

import type { TabItem } from './tabs.svelte'
import type { BaseKVItem } from '../kv'

export interface KVTabItem extends BaseKVItem {
  title: string
  index: number
  view: WebContentsViewData
  pinned?: boolean
}

export type CreateTabOptions = {
  /**
   * Whether the tab should be active upon creation.
   * Defaults to `true`.
   */
  active: boolean

  /**
   * Whether the tab and linked view should be immediately loaded
   * Defaults to `false`.
   */
  activate: boolean

  /**
   * The initial selection highlight for the tab.
   */
  selectionHighlight?: PageHighlightSelectionData
}

export enum TabItemEmitterNames {
  UPDATE = 'update',
  DESTROY = 'destroy'
}

export type TabItemEmitterEvents = {
  [TabItemEmitterNames.UPDATE]: (tab: TabItem) => void
  [TabItemEmitterNames.DESTROY]: (tabId: string) => void
}

export enum TabsServiceEmitterNames {
  CREATED = 'created',
  DELETED = 'deleted',
  ACTIVATED = 'activated',
  REORDERED = 'reordered'
}

export type TabsServiceEmitterEvents = {
  [TabsServiceEmitterNames.CREATED]: (tab: TabItem) => void
  [TabsServiceEmitterNames.DELETED]: (tabId: string) => void
  [TabsServiceEmitterNames.ACTIVATED]: (tab: TabItem | null) => void
  [TabsServiceEmitterNames.REORDERED]: (data: {
    tabId: string
    oldIndex: number
    newIndex: number
  }) => void
}
