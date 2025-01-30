<script lang="ts" context="module">
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
</script>

<script lang="ts">
  import { createEventDispatcher, onMount, setContext } from 'svelte'
  import { tooltip, useLogScope } from '@horizon/utils'

  import type { AIChatMessageSource } from '../../types/browser.types'
  import CitationItem, { type CitationClickData, type CitationInfo } from './CitationItem.svelte'
  import CodeRenderer from './CodeRenderer.svelte'
  import MarkdownRenderer from '@horizon/editor/src/lib/components/MarkdownRenderer.svelte'
  import { writable, type Writable } from 'svelte/store'
  import {
    mapCitationsToText,
    renderIDFromCitationID
  } from '@horizon/core/src/lib/service/ai/helpers'

  export let id: string = ''
  export let content: string
  export let sources: AIChatMessageSource[] | undefined
  export let showSourcesAtEnd: boolean = false
  export let inline: boolean = false
  export let usedPageScreenshot = false
  export let usedInlineScreenshot = false

  const log = useLogScope('ChatMessage')

  const dispatch = createEventDispatcher<{
    citationClick: { citationID: string; text: string; sourceUid?: string; preview?: boolean }
    citationHoverStart: string
    citationHoverEnd: string
    removeScreenshot: void
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

  const getCitationInfo = (id: string) => {
    const renderID = renderIDFromCitationID(id, sources)
    const source = sources?.find((source) => source.render_id === renderID)

    return {
      id,
      source,
      renderID
    }
  }

  const handleCitationClick = (data: CitationClickData) => {
    const { citationID, uniqueID, preview } = data
    log.debug('Citation clicked', citationID, uniqueID)

    const citationsToText = mapCitationsToText(contentElem)
    const text = citationsToText.get(uniqueID)
    const source = sources?.find((source) => source.all_chunk_ids.includes(citationID))

    log.debug('Citation text', text)

    if (!text) {
      log.debug('ChatMessage: No text found for citation, ', citationID)

      dispatch('citationClick', {
        citationID: citationID,
        text: '',
        sourceUid: source?.uid,
        preview
      })

      return
    }

    // citation.classList.add('clicked')

    highlightedCitation.set(uniqueID)
    dispatch('citationClick', { citationID: citationID, text, preview, sourceUid: source?.uid })
  }

  const handleRemoveScreenshot = () => {
    dispatch('removeScreenshot')
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

<div
  class=" {inline
    ? '!prose-sm !dark:prose-invert'
    : 'py-5 px-6 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 rounded-2xl flex flex-col gap-4'}"
>
  {#if filteredSources && filteredSources.length > 0 && showSourcesAtEnd}
    <div class="flex flex-col gap-2">
      <!-- <h3 class="text-md font-semibold my-1">Sources</h3> -->

      <!--
        Don't ask...
        Without this when selecting the previous chat message by tripple clicking (expanding the text selection) it will select the content of each citation which means when pasting into our input field (or other ones that support HTML) it will paste the citation content. Haven't found a better way to prevent this yet other than placing a invisible character in between. huere schiss!
      -->
      <div class="opacity-0 w-0 h-0">x</div>

      <div class="citations-list flex flex-wrap gap-y-2 gap-x-1">
        {#if usedPageScreenshot}
          <div class="group/citation">
            <CitationItem
              className="w-fit"
              type="image"
              skipParsing
              allowRemove
              on:rerun-without-source={handleRemoveScreenshot}
            >
              <div class="flex items-center gap-1">
                <div class="text-sm">Page Screenshot</div>

                <!-- <button
                  on:click|stopPropagation={handleRemoveScreenshot}
                  use:tooltip={{ text: 'Remove', position: 'left' }}
                  class="hidden opacity-0 group-hover/citation:block group-hover/citation:opacity-100 transition-opacity"
                >
                  <Icon name="close" size="16px" />
                </button> -->
              </div>
            </CitationItem>
          </div>
        {/if}

        {#if usedInlineScreenshot}
          <CitationItem className="w-fit" type="image" skipParsing>
            <div class="flex items-center gap-1">
              <div class="text-sm">Inline Screenshot</div>
            </div>
          </CitationItem>
        {/if}

        {#each filteredSources as source}
          <CitationItem
            id={source.id}
            general
            className="w-fit"
            maxTitleLength={filteredSources.length > 1 ? 25 : 42}
          ></CitationItem>
        {/each}

        {#if collapsedSources.length > filteredSources.length}
          <div class="text-gray-500 text-sm">
            +{collapsedSources.length - filteredSources.length} more sources
          </div>
        {/if}
      </div>
    </div>
    <!-- <h3 class="text-2xl font-semibold">Answer</h3> -->
  {/if}

  <MarkdownRenderer
    bind:element={contentElem}
    {content}
    {id}
    size={inline ? 'sm' : 'lg'}
    citationComponent={CitationItem}
    codeBlockComponent={CodeRenderer}
  />
</div>

<style lang="scss">
  :global(.chat-message-content div) {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  :global(.chat-message-content li) {
    margin-top: 1rem;
    margin-bottom: 1rem;
    display: block;
  }

  :global(.chat-message-content h2) {
    font-size: 1.6rem;
    font-weight: 600;
    margin-top: 1.5rem;
    margin-bottom: 1.5rem;
  }

  :global(.chat-message-content h3) {
    font-size: 1.4rem;
    font-weight: 600;
    margin-top: 1.5rem;
    margin-bottom: 1.5rem;
  }

  :global(.chat-message-content a) {
    color: rgb(255, 164, 164);
    text-decoration: none;
    border-bottom: 1px solid rgb(255, 164, 164);
  }

  :global(citation) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    width: 1.75rem;
    height: 1.75rem;
    font-size: 0.9rem;
    border-radius: 100%;
    user-select: none;
    cursor: default;

    @apply border-[1px] border-gray-200 dark:bg-[#006eff] dark:border-[#006eff];
  }

  :global(citation.wide:hover) {
    background: rgb(214, 234, 255);
  }

  :global(citation.wide),
  .citation-item.wide {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    flex-shrink: 0;
    gap: 0.5rem;
    padding: 0.1rem 0.4rem;
    font-size: 0.9rem;
    font-weight: 500;
    border-radius: 10px;
    user-select: none;
    cursor: default;
    width: fit-content;
    height: auto;

    :global(.dark) & {
      background: #111827;
      border: 1px solid #374151;
    }
  }

  :global(citation.wide) {
    margin-top: -4px;
    margin-bottom: -4px;
    position: relative;
    top: 2px;
  }

  :global(citation img),
  .citation-item img {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
    border-radius: 5px;
  }

  :global(citation div),
  .citation-item div {
    font-size: 0.9rem;
    font-weight: 500;
  }

  :global(citation.clicked),
  :global(.citation-item.clicked) {
    background: #e4d3fd !important;
  }
</style>
