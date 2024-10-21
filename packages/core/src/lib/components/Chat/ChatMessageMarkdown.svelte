<script lang="ts" context="module">
  export type MarkdownComponentEventCitationClick = {
    type: 'citation-click'
    data: string
  }

  export type MarkdownComponentEvent = MarkdownComponentEventCitationClick

  export const CITATION_HANDLER_CONTEXT = 'citation-handler'

  export type CitationClickData = { citationID: string; uniqueID: string }

  export type CitationHandlerContext = {
    citationClick: (data: CitationClickData) => void
    getCitationInfo: (
      id: string
    ) => { id: string; source?: AIChatMessageSource; renderID: string; text?: string }
    highlightedCitation: Writable<string | null>
  }
</script>

<script lang="ts">
  import { createEventDispatcher, onMount, setContext } from 'svelte'
  import { useLogScope } from '@horizon/utils'

  import type { AIChatMessageSource } from '../../types/browser.types'
  import CitationItem from './CitationItem.svelte'
  import MarkdownRenderer from './MarkdownRenderer.svelte'
  import { writable, type Writable } from 'svelte/store'

  export let id: string = ''
  export let content: string
  export let sources: AIChatMessageSource[] | undefined
  export let showSourcesAtEnd: boolean = false
  export let inline: boolean = false

  const log = useLogScope('ChatMessage')
  const dispatch = createEventDispatcher<{
    citationClick: { citationID: string; text: string; sourceUid?: string }
    citationHoverStart: string
    citationHoverEnd: string
  }>()

  const highlightedCitation = writable<string | null>(null)

  const MAX_SOURCES = 8

  let contentElem: HTMLDivElement

  // combine sources from the same resource
  $: collapsedSources = (sources ?? []).reduce((acc, source) => {
    const existing = acc.find((s) => s.resource_id === source.resource_id)

    if (existing) {
      return acc
    }

    return [...acc, source]
  }, [] as AIChatMessageSource[])

  $: filteredSources = collapsedSources.slice(0, MAX_SOURCES)

  // $: log.debug('ChatMessageMarkdown', sources, collapsedSources)

  const renderIDFromCitationID = (citationID: string | null, sources?: AIChatMessageSource[]) => {
    if (!citationID || !sources) return ''

    for (const source of sources) {
      if (source.all_chunk_ids.includes(citationID)) {
        return source.render_id
      }
    }
    return ''
  }

  const getCitationInfo = (id: string) => {
    const renderID = renderIDFromCitationID(id, sources)
    const source = sources?.find((source) => source.render_id === renderID)

    return {
      id,
      source,
      renderID
    }
  }

  const aggregateTextNodes = (node: Node, text: string, stopCitationId: string) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node as Text
      text += textNode.textContent
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const elem = node as HTMLElement

      if (elem.tagName === 'CITATION') {
        const uid = elem.getAttribute('data-uid')
        if (uid === stopCitationId) {
          return text
        }
      } else {
        for (const child of elem.childNodes) {
          text = aggregateTextNodes(child, text, stopCitationId)
        }
      }
    }

    return text
  }

  // concatenate text nodes that come before the citation node within the same parent node
  const getCitationParentTextContent = (citation: HTMLElement) => {
    let text = ''

    const parent = citation.parentNode

    if (!parent) {
      return ''
    }

    for (const child of parent.childNodes) {
      if (child === citation) {
        break
      }

      text = aggregateTextNodes(child, text, citation.id)
    }

    return text
  }

  const mapCitationsToText = (content: HTMLDivElement) => {
    log.debug('Mapping citations to text', content)
    let citationsToText = new Map<string, string>()

    /*
        For each citation node, we need to find the text that corresponds to it.
        We do this by finding the text node that comes before the citation node.
        We need to make sure we only use the relevant text not the entire text content between the last citation and the current citation.
        We do this by only taking the text nodes of elements that are directly in front of the citation node.

        Example:
        <p>First text with a citation <citation>1</citation></p>
        <p>Second text with a citation <citation>2</citation></p>
        <p>Third text with no citation</p>
        <p>Forth <strong>text</strong> with a citation <citation>3</citation></p>

        Parsed mapping:

        1: First text with a citation
        2: Second text with a citation
        3: Forth text with a citation
    */

    let lastText = ''

    /*
        loop through all child nodes to find the citation node
        take all text nodes that come before the citation within the same parent node and concatenate them
        if the citation node is inside a styled node like <strong> or <em> we need to take the text node of the styled node
    */

    const mapCitationsToTextRecursive = (node: Node, citationsToText: Map<string, string>) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const elem = node as HTMLElement

        if (elem.tagName === 'CITATION') {
          const citationID = elem.getAttribute('data-uid')
          const text = getCitationParentTextContent(elem)

          if (!citationID) {
            log.error('ChatMessage: No citation ID found for citation', elem)
            return
          }

          if (text) {
            if (citationsToText.has(citationID)) {
              citationsToText.set(citationID, citationsToText.get(citationID) + ' | ' + text)
            } else {
              citationsToText.set(citationID, text)
            }
          }
        } else {
          for (const child of elem.childNodes) {
            mapCitationsToTextRecursive(child, citationsToText)
          }
        }
      }
    }

    mapCitationsToTextRecursive(content, citationsToText)

    log.debug('Mapped citations to text', citationsToText)

    log.debug('Mapping sources', sources)

    return citationsToText
  }

  const handleCitationClick = (data: CitationClickData) => {
    const { citationID, uniqueID } = data
    log.debug('Citation clicked', citationID, uniqueID)

    const citationsToText = mapCitationsToText(contentElem)
    const text = citationsToText.get(uniqueID)

    log.debug('Citation text', text)

    if (!text) {
      log.debug('ChatMessage: No text found for citation, ', citationID)

      const source = sources?.find((source) => source.all_chunk_ids.includes(citationID))
      dispatch('citationClick', { citationID: citationID, text: '', sourceUid: source?.uid })

      return
    }

    // citation.classList.add('clicked')

    highlightedCitation.set(uniqueID)
    dispatch('citationClick', { citationID: citationID, text })
  }

  setContext<CitationHandlerContext>(CITATION_HANDLER_CONTEXT, {
    citationClick: handleCitationClick,
    getCitationInfo: getCitationInfo,
    highlightedCitation: highlightedCitation
  })

  onMount(() => {
    log.debug('ChatMessageMarkdown mounted', sources, content)
  })
</script>

<div class=" {inline ? '!prose-sm' : 'py-5 px-6 bg-white rounded-2xl flex flex-col gap-4'}">
  {#if filteredSources && filteredSources.length > 0 && showSourcesAtEnd}
    <div class="flex flex-col gap-2">
      <!-- <h3 class="text-md font-semibold my-1">Sources</h3> -->

      <!--
        Don't ask...
        Without this when selecting the previous chat message by tripple clicking (expanding the text selection) it will select the content of each citation which means when pasting into our input field (or other ones that support HTML) it will paste the citation content. Haven't found a better way to prevent this yet other than placing a invisible character in between. huere schiss!
      -->
      <div class="opacity-0 w-0 h-0">x</div>

      <div class="citations-list flex flex-wrap gap-y-2 gap-x-1">
        {#each filteredSources as source}
          <CitationItem
            id={source.id}
            general
            className="w-fit"
            maxTitleLength={filteredSources.length > 1 ? 25 : 42}
          ></CitationItem>
        {/each}

        {#if collapsedSources.length > filteredSources.length}
          <div class="text-slate-500 text-sm">
            +{collapsedSources.length - filteredSources.length} more sources
          </div>
        {/if}
      </div>
    </div>
    <!-- <h3 class="text-2xl font-semibold">Answer</h3> -->
  {/if}

  <MarkdownRenderer bind:element={contentElem} {content} {id} size={inline ? 'sm' : 'lg'} />
</div>
