import { type Fn } from '@deta/types'
import { toggleTabOrientation } from '@deta/services/tabs'

import { setupDownloadEvents } from './downloadEvents'
import { setupTabViewEvents } from './tabViewEvents'
import { setupImportEvents } from './importerEvents'

// @ts-ignore
export type PreloadEvents = typeof window.preloadEvents

function setupPreloadEvents() {
  const unsubs: Fn[] = []

  // Proxy the preload events to ensure that we unsubscribe from them
  const horizonPreloadEvents: PreloadEvents = {} as PreloadEvents

  // @ts-ignore
  for (const [key, value] of Object.entries(window.preloadEvents)) {
    if (typeof value === 'function') {
      horizonPreloadEvents[key as keyof PreloadEvents] = (...args: any[]) => {
        // @ts-ignore
        const unsubscribe = (value as Function).apply(window.preloadEvents, args)
        if (typeof unsubscribe === 'function') {
          unsubs.push(unsubscribe)
        }
        return unsubscribe
      }
    } else {
      horizonPreloadEvents[key as keyof PreloadEvents] = value
    }
  }

  const unsubscribe = () => {
    unsubs.forEach((unsubscribe) => unsubscribe())
  }

  return { events: horizonPreloadEvents, unsubscribe }
}

export function handlePreloadEvents() {
  const { events, unsubscribe } = setupPreloadEvents()

  events.onBrowserFocusChange((_state) => {
    // no-op
  })

  events.onToggleTabsPosition(() => {
    toggleTabOrientation().catch((error) => {
      console.error('Failed to toggle tab orientation from menu:', error)
    })
  })

  setupTabViewEvents(events)
  setupDownloadEvents(events)
  setupImportEvents(events)

  return () => unsubscribe()
}
