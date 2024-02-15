/// <reference types="svelte" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly M_VITE_BUILD_TAG?: string
  readonly M_VITE_APP_VERSION?: string
  readonly M_VITE_PRODUCT_NAME?: string
  readonly M_VITE_USE_TMP_DATA_DIR?: string
  readonly M_VITE_DISABLE_AUTO_UPDATE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
