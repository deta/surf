import { ElectronAPI } from '@electron-toolkit/preload'
import type { API, PreloadEventHandlers } from './core'
import { RendererType } from '@deta/types'

declare global {
  interface Window {
    RENDERER_TYPE: RendererType
    electron: ElectronAPI
    api: API
    preloadEvents: PreloadEventHandlers
    backend: {
      sffs: any
      resources: any
    }
  }
}
