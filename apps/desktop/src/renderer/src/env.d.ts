/// <reference types="svelte" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly R_VITE_BUILD_TAG?: string
  readonly R_VITE_APP_VERSION?: string
  readonly R_VITE_TELEMETRY_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
