import { type CitationClickEvent, type Fn } from '@deta/types'
import { useLogScope } from '@deta/utils/io'
import { useTabs } from '@deta/services/tabs'

export function handlePreloadEvents() {
  const log = useLogScope('PreloadEvents')
  const tabsManager = useTabs()

  const unsubs: Fn[] = []

  // Proxy the preload events to ensure that we unsubscribe from them
  // @ts-ignore
  const horizonPreloadEvents: typeof window.preloadEvents = {} as typeof window.preloadEvents

  // @ts-ignore
  for (const [key, value] of Object.entries(window.preloadEvents)) {
    if (typeof value === 'function') {
      // @ts-ignore
      horizonPreloadEvents[key as keyof typeof window.preloadEvents] = (...args: any[]) => {
        // @ts-ignore
        const unsubscribe = (value as Function).apply(window.preloadEvents, args)
        if (typeof unsubscribe === 'function') {
          unsubs.push(unsubscribe)
        }
        return unsubscribe
      }
    } else {
      // @ts-ignore
      horizonPreloadEvents[key as keyof typeof window.preloadEvents] = value
    }
  }

  horizonPreloadEvents.onBrowserFocusChange((state) => {
    // no-op
  })

  horizonPreloadEvents.onNewWindowRequest((details) => {
    log.debug('new window request', details)

    const { disposition, url } = details
    if (disposition === 'new-window') {
      // TODO: open in overlay
      return
    }

    const active = disposition === 'foreground-tab'
    tabsManager.create(url, { active })
  })

  horizonPreloadEvents.onOpenURL((details) => {
    log.debug('open URL request', details)
    tabsManager.create(details.url, { active: details.active })
  })

  horizonPreloadEvents.onCopyActiveTabURL(() => {
    const activeTab = tabsManager.activeTabValue
    if (activeTab) {
      activeTab.view.copyURL()
    }
  })

  horizonPreloadEvents.onOpenDevtools(() => {
    const activeTab = tabsManager.activeTabValue
    if (activeTab && activeTab.view.webContents) {
      activeTab.view.webContents.openDevTools()
    }
  })

  horizonPreloadEvents.onCloseActiveTab(() => {
    const activeTab = tabsManager.activeTabValue
    if (activeTab) {
      tabsManager.delete(activeTab.id)
    }
  })

  horizonPreloadEvents.onReloadActiveTab((force) => {
    const activeTab = tabsManager.activeTabValue
    if (activeTab && activeTab.view.webContents) {
      if (force) {
        activeTab.view.webContents.forceReload()
      } else {
        activeTab.view.webContents.reload()
      }
    }
  })

  horizonPreloadEvents.onCitationClick((data: CitationClickEvent) => {
    // TODO: handle highlighting
    tabsManager.openOrCreate(data.url, {
      active: true,
      ...(data.skipHighlight ? {} : { selectionHighlight: data.selection })
    })
  })

  return () => {
    unsubs.forEach((unsubscribe) => unsubscribe())
  }
}
