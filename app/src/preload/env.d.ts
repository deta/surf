/// <reference types="svelte" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly P_VITE_API_BASE?: string
  readonly P_VITE_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
