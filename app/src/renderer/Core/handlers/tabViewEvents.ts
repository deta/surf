import { useTabs } from '@deta/services/tabs'
import { useViewManager } from '@deta/services/views'
import type { PreloadEvents } from './preloadEvents'
import { useBrowser } from '@deta/services/browser'

export const setupTabViewEvents = (events: PreloadEvents) => {
  const tabsManager = useTabs()
  const viewManager = useViewManager()
  const browser = useBrowser()

  events.onNewWindowRequest((details) => {
    browser.handleNewWindowRequest(details)
  })

  events.onOpenURL((details) => {
    browser.handleOpenURLRequest(details)
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

  events.onUpdateViewBounds((viewId, bounds) => {
    viewManager.updateViewBounds(viewId, bounds)
  })

  events.onSaveLink((url, notebookId) => {
    browser.saveLink(url, notebookId)
  })

  /*
  events.onCreateNewTab(() => {
    tabsManager.openNewTabPage()
  })

  events.onToggleRightSidebar(() => {
    viewManager.toggleSidebar()
  })
  */
}
