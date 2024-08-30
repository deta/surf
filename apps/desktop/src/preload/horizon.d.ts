import { ElectronAPI } from '@electron-toolkit/preload'
import type { API } from './horizon'

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
    backend: {
      sffs: any
      resources: any
    }
  }
}
