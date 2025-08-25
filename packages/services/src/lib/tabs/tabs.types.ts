import type { WebContentsViewData } from "@deta/types";

import type { TabItem } from "./tabs.svelte";
import type { BaseKVItem } from "../kv";

export interface KVTabItem extends BaseKVItem {
  title: string;
  index: number;
  view: WebContentsViewData;
}

export type CreateTabOptions = {
  /**
   * Whether the tab should be active upon creation.
   * Defaults to `true`.
   */
  active: boolean;

  /**
   * Whether the tab and linked view should be immediately loaded
   * Defaults to `false`.
   */
  activate: boolean;
};

export enum TabItemEmitterNames {
  UPDATE = "update",
  DESTROY = "destroy",
}

export type TabItemEmitterEvents = {
  [TabItemEmitterNames.UPDATE]: (tab: TabItem) => void;
  [TabItemEmitterNames.DESTROY]: (tabId: string) => void;
};

export enum TabsServiceEmitterNames {
  CREATED = "created",
  DELETED = "deleted",
  ACTIVATED = "activated",
}

export type TabsServiceEmitterEvents = {
  [TabsServiceEmitterNames.CREATED]: (tab: TabItem) => void;
  [TabsServiceEmitterNames.DELETED]: (tabId: string) => void;
  [TabsServiceEmitterNames.ACTIVATED]: (tab: TabItem | null) => void;
};
