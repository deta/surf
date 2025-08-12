/// <reference types="svelte" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly R_VITE_BUILD_TAG?: string
  readonly R_VITE_APP_VERSION?: string
  readonly R_VITE_TELEMETRY_ENABLED?: string
  readonly R_VITE_TELEMETRY_API_KEY?: string
  readonly R_VITE_TELEMETRY_PROXY_URL?: string
  readonly R_VITE_CHEATSHEET_URL?: string
  readonly R_VITE_SENTRY_DSN?: string
  readonly R_VITE_CHEAT_SHEET_URL?: string
  readonly R_VITE_SHORTCUTS_PAGE_URL?: string
  readonly R_VITE_MAIN_ONBOARDING_VIDEO_URL?: string
  readonly R_VITE_CHANGELOG_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Types for vite-plugin-markdown
declare module '*.md' {
  // "unknown" would be more detailed depends on how you structure frontmatter
  const attributes: Record<string, unknown>

  // When "Mode.TOC" is requested
  const toc: { level: string; content: string }[]

  // When "Mode.HTML" is requested
  const html: string

  // When "Mode.MARKDOWN" is requested
  const markdown: string

  // When "Mode.RAW" is requested
  const raw: string

  // Modify below per your usage
  export { attributes, toc, html, markdown, raw }
}
