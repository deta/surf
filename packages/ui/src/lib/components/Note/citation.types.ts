import type { Writable } from "svelte/store"
import type { CitationClickData, CitationInfo } from "@deta/types"

export type MarkdownComponentEventCitationClick = {
    type: 'citation-click'
    data: string
  }

  export type MarkdownComponentEvent = MarkdownComponentEventCitationClick

  export const CITATION_HANDLER_CONTEXT = 'citation-handler'

  export type CitationHandlerContext = {
    citationClick: (data: CitationClickData) => void
    getCitationInfo: (id: string) => CitationInfo
    highlightedCitation: Writable<string | null>
  }