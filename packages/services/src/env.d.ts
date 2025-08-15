/// <reference types="vite/client" />
/// <reference path="../../web-parser/src/vite-env.d.ts" />

declare global {
  interface Window {
    electron: any
    api: any
    preloadEvents: any
    backend: {
      sffs: any
      resources: any
    }
  }
}

export {}
