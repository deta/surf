export { markdown as CLASSIFY_CHAT_MODE } from './prompts/classify-chat-mode.md'
export { markdown as CLASSIFY_NOTE_CHAT_MODE } from './prompts/classify-note-chat-mode.md'
export { markdown as PAGE_PROMPTS_GENERATOR_PROMPT } from './prompts/page-prompts-generator.md'
export { markdown as SMART_NOTES_SUGGESTIONS_GENERATOR_PROMPT } from './prompts/smart-note-suggestions-generator.md'
export { markdown as INLINE_TRANSFORM } from './prompts/inline-transform.md'
export { markdown as WIKIPEDIA_TITLE_EXTRACTOR_PROMPT } from './prompts/wikipedia-title-extractor.md'
export { markdown as CHAT_TITLE_GENERATOR_PROMPT } from './prompts/chat-title-generator.md'
export { markdown as FILENAME_CLEANUP_PROMPT } from './prompts/filename-cleanup.md'
export { markdown as BROWSER_HISTORY_QUERY_PROMPT } from './prompts/browser-history-query.md'
export declare const SIMPLE_SUMMARIZER_PROMPT =
  'You are a summarizer, summarize the text given to you. Only respond with the summarization.'
export declare const LEGACY_PAGE_CITATION_SUMMARY_PROMPT: any
export declare const INLINE_PROMPTS: {
  SUMMARIZE: any
  EXPLAIN: any
  TRANSLATE: any
  GRAMMAR: any
  TRANSFORM_USER: any
}
export declare const PAGE_PROMPTS: {
  SUMMARIZE: any
  TOC: any
  TRANSLATE: any
}
export declare const BUILT_IN_PAGE_PROMPTS: {
  label: string
  prompt: string
}[]
