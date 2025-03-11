import type { API, PreloadEventHandlers } from './setup'

declare global {
  interface Window {
    api: API
    preloadEvents: PreloadEventHandlers
    initialView: string
  }
}
