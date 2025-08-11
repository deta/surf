export interface UpdatesAPI {
  onUpdateProgress: (callback: (progress: number) => void) => void
  removeUpdateProgressListener: () => void
}

declare global {
  interface Window {
    updatesAPI: UpdatesAPI
  }
}
