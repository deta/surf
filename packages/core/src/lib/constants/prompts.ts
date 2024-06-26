import { markdown as INLINE_SUMMARIZER } from './prompts/inline-summarizer.md'
import { markdown as INLINE_EXPLAINER } from './prompts/inline-explainer.md'
import { markdown as INLINE_TRANSLATE } from './prompts/inline-translate.md'
import { markdown as INLINE_GRAMMAR } from './prompts/inline-grammar.md'
import { markdown as INLINE_TRANSFORM_USER } from './prompts/inline-transform-user.md'
import { markdown as LEGACY_PAGE_CITATIONS } from './prompts/page-citations.md'
import { markdown as PAGE_SUMMARIZE } from './prompts/page-summarize.md'
import { markdown as PAGE_TOC } from './prompts/page-toc.md'
import { markdown as PAGE_TRANSLATE } from './prompts/page-translate.md'

export const SIMPLE_SUMMARIZER_PROMPT = `You are a summarizer, summarize the text given to you. Only respond with the summarization.`
export const LEGACY_PAGE_CITATION_SUMMARY_PROMPT = LEGACY_PAGE_CITATIONS

export const INLINE_PROMPTS = {
  SUMMARIZE: INLINE_SUMMARIZER,
  EXPLAIN: INLINE_EXPLAINER,
  TRANSLATE: INLINE_TRANSLATE,
  GRAMMAR: INLINE_GRAMMAR,
  TRANSFORM_USER: INLINE_TRANSFORM_USER
}

export const PAGE_PROMPTS = {
  SUMMARIZE: PAGE_SUMMARIZE,
  TOC: PAGE_TOC,
  TRANSLATE: PAGE_TRANSLATE
}
