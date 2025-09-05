import { useTabs } from '@deta/services/tabs'
import { useViewManager } from '@deta/services/views'
import type { CitationClickEvent } from '@deta/types'
import { useLogScope } from '@deta/utils/io'
import type { PreloadEvents } from './preloadEvents'

export const setupTabViewEvents = (events: PreloadEvents) => {
  const log = useLogScope('Preload TabViewEvents')
  const tabsManager = useTabs()
  const viewManager = useViewManager()

  events.onNewWindowRequest((details) => {
    log.debug('new window request', details)

    const { disposition, url } = details
    if (disposition === 'new-window') {
      // TODO: open in overlay
      return
    }

    const active = disposition === 'foreground-tab'
    tabsManager.create(url, { active })
  })

  events.onOpenURL((details) => {
    log.debug('open URL request', details)
    tabsManager.create(details.url, { active: details.active })
  })

  events.onCopyActiveTabURL(() => {
    const activeTab = tabsManager.activeTabValue
    if (activeTab) {
      activeTab.copyURL()
    }
  })

  events.onOpenDevtools(() => {
    const activeTab = tabsManager.activeTabValue
    if (activeTab && activeTab.view.webContents) {
      activeTab.view.webContents.openDevTools()
    }
  })

  events.onCloseActiveTab(() => {
    const activeTab = tabsManager.activeTabValue
    if (activeTab) {
      tabsManager.delete(activeTab.id)
    }
  })

  events.onReloadActiveTab((force) => {
    const activeTab = tabsManager.activeTabValue
    if (activeTab && activeTab.view.webContents) {
      if (force) {
        activeTab.view.webContents.reload(true)
      } else {
        activeTab.view.webContents.reload()
      }
    }
  })

  events.onCitationClick((data: CitationClickEvent) => {
    // TODO: handle highlighting
    tabsManager.openOrCreate(data.url, {
      active: true,
      ...(data.skipHighlight ? {} : { selectionHighlight: data.selection })
    })
  })

  events.onUpdateViewBounds((viewId, bounds) => {
    viewManager.updateViewBounds(viewId, bounds)
  })
}
