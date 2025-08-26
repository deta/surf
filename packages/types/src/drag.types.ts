export enum DragTypeNames {
  SURF_TAB = 'vnd/surf/tab',
  SURF_TAB_ID = 'application/vnd.space.dragcula.tabId',

  SURF_RESOURCE = 'vnd/surf/resource',
  SURF_RESOURCE_ID = 'application/vnd.space.dragcula.resourceId',
  ASYNC_SURF_RESOURCE = 'vnd/async/surf/resource',

  SURF_SPACE = 'vnd/surf/space',

  DESKTOP_ITEM = 'vnd/surf/desktop_item',

  SURF_HISTORY_ENTRY = 'vnd/surf/history_entry',
  SURF_HISTORY_ENTRY_ID = 'application/vnd.space.dragcula.historyEntryId'
}

export type DragTypes = Record<keyof typeof DragTypeNames, any>
