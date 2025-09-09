/// <reference types="svelte" />
/// <reference types="vite/client" />

import type { RendererType } from '@deta/types'

declare global {
  interface Window {
    RENDERER_TYPE: RendererType
  }
}
