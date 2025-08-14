import { ElectronAPI } from '@electron-toolkit/preload'
import type { API, PreloadEventHandlers } from './core'

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
    preloadEvents: PreloadEventHandlers
    backend: {
      sffs: any
      resources: any
    }
  }
}
