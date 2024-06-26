/// <reference types="svelte" />
/// <reference types="vite/client" />

declare module 'svelte-autosize' {
  import type { Action } from 'svelte/action'

  export default Action<HTMLElement>
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
