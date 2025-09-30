/// <reference types="svelte" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly P_VITE_API_BASE?: string
  readonly P_VITE_API_KEY?: string
  readonly P_VITE_APP_VERSION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
