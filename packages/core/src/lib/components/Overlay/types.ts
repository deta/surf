export interface CMDMenuItem {
  id: string
  label: string
  value?: string
  type: string
  icon?: string
  iconUrl?: string
  iconColors?: string[]
  score?: number
  description?: string
  shortcut?: string
}

export type OverlayEvents = {
  'copy-active-url': void
  'close-active-tab': void
  bookmark: void
  'toggle-horizontal': void
  'toggle-sidebar': void
  'reload-window': void
  'create-history-tab': void
  zoom: void
  'zoom-out': void
  'reset-zoom': void
  'open-url': string
  'activate-tab': string
  'create-chat': string
  'open-space': Space
  'create-note': string
  'toggle-homescreen': void
  open: string
  'create-resource-from-oasis': string
  'create-tab-from-space': { tab: TabSpace; active: boolean }
  deleted: string
}
