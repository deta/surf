import { useDownloadsManager } from '@deta/services'
import type { PreloadEvents } from './preloadEvents'

export const setupDownloadEvents = (events: PreloadEvents) => {
  const downloadsManager = useDownloadsManager()
  events.onRequestDownloadPath(async (data) => {
    return downloadsManager.handleRequestDownloadPath(data)
  })

  events.onDownloadUpdated((data) => {
    return downloadsManager.handleDownloadUpdated(data)
  })

  events.onDownloadDone(async (data) => {
    return downloadsManager.handleDownloadDone(data)
  })
}
