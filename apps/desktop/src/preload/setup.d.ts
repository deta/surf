import type { API } from './horizon'

declare global {
  interface Window {
    api: API
  }
}
