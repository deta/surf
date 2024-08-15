<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import type { AIChatMessageSource } from './types'
  import { useLogScope } from '../../utils/log'
  import { useDebounce } from '../../utils/debounce'

  export let content: string
  export let sources: AIChatMessageSource[] | undefined
  export let showSourcesAtEnd: boolean = false

  const log = useLogScope('ChatMessage')
  const dispatch = createEventDispatcher<{
    citationClick: { citationID: string; text: string; sourceUid?: string }
    citationHoverStart: string
    citationHoverEnd: string
  }>()

  let elem: HTMLDivElement
  let showCitationSource = false

  $: {
    debouncedRenderContent(content, sources)
  }

  const renderIDFromCitationID = (citationID: string | null, sources?: AIChatMessageSource[]) => {
    if (!citationID || !sources) return ''

    for (const source of sources) {
      if (source.all_chunk_ids.includes(citationID)) {
        return source.render_id
      }
    }
    return ''
  }

  const mapCitationsToText = (content: HTMLDivElement) => {
    let currentText = ''
    let result = new Map<number, string>()
    let lastCitationIndex = 0
    let lastTextIndex = 0

    const processNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        currentText += node.textContent || ''
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement
        if (element.tagName === 'CITATION') {
          const relevantText = currentText.slice(lastTextIndex).trim()
          result.set(lastCitationIndex, relevantText)
          lastTextIndex = currentText.length
          lastCitationIndex += 1
        } else {
          // Process child nodes recursively
          Array.from(element.childNodes).forEach(processNode)
        }
      }
    }

    Array.from(content.childNodes).forEach(processNode)

    return result
  }

  // format number to hh:mm:ss or mm:ss or ss (for seconds add "s" e.g. 5s)
  const formatTimestamp = (timestamp: number) => {
    const hours = Math.floor(timestamp / 3600)
    const minutes = Math.floor((timestamp % 3600) / 60)
    const seconds = Math.floor(timestamp % 60)

    let result = ''
    if (hours > 0) {
      result += hours.toString().padStart(2, '0') + ':'
    }

    if (minutes > 0 || hours > 0) {
      result += minutes.toString().padStart(2, '0') + ':'
    } else {
      result += '00:'
    }

    result += seconds.toString().padStart(2, '0')

    if (result === '') {
      result = '0'
    }

    return result
  }

  const renderContent = (content: string, sources?: AIChatMessageSource[]) => {
    if (!elem || !content) return

    elem.innerHTML = ''

    let tempDiv = document.createElement('div')
    tempDiv.innerHTML = content

    const citationsToText = mapCitationsToText(tempDiv)

    const links = tempDiv.querySelectorAll('a')
    links.forEach((link) => {
      link.setAttribute('target', '_blank')
    })

    const citations = tempDiv.querySelectorAll('citation')
    let seen_citations = new Set<string>()

    // only show if sources have unique urls and don't all come from the same URL or if they have timestamps
    const uniqueUrls = new Set((sources ?? []).map((source) => source.metadata?.url))
    showCitationSource =
      uniqueUrls.size > 1 || !!sources?.some((source) => source.metadata?.timestamp)

    citations.forEach((citation, index) => {
      const citationID = citation.textContent || ''
      const renderID = renderIDFromCitationID(citation.textContent, sources)
      if (!renderID) {
        citation.remove()
        return
      }

      const source = sources?.find((source) => source.render_id === renderID)
      log.debug('ChatMessage: source', source)

      let previousElementSibling = citation?.previousElementSibling
      if (
        previousElementSibling &&
        previousElementSibling.tagName === 'CITATION' &&
        previousElementSibling.textContent === renderID
      ) {
        citation.remove()
        return
      }

      if (source?.metadata?.timestamp) {
        citation.classList.add('wide')
        citation.innerHTML = `
            <img src="https://www.google.com/s2/favicons?domain=https://youtube.com&sz=40" alt="YouTube icon" />
            <div>${formatTimestamp(source.metadata.timestamp)}</div>
        `
      } else if (source?.metadata?.url) {
        citation.classList.add('wide')
        citation.innerHTML = `
            <img src="https://www.google.com/s2/favicons?domain=${source.metadata.url}&sz=40" alt="source icon" />
            <div>#${renderID}</div>
        `
      } else {
        citation.textContent = `#${renderID}`
      }

      seen_citations.add(renderID)
      citation.addEventListener('click', () => {
        if (!citation.textContent) return
        let text = citationsToText.get(index)
        if (!text) {
          console.debug(
            'ChatMessage: No text found for citation,',
            citationID,
            'trying to return previous index id'
          )
          text = citationsToText.get(index - 1)
          if (!text) {
            console.error('ChatMessage: No text found for citation, ', citationID)
            alert('Error: failed to get answer for citation')
            return
          }
        }
        citations.forEach((citation) => {
          citation.classList.remove('clicked')
        })
        document.querySelectorAll('.citation-item').forEach((citation) => {
          citation.classList.remove('clicked')
        })
        citation.classList.add('clicked')
        dispatch('citationClick', { citationID, text })
      })

      citation.addEventListener('mouseenter', () => {
        if (!citation.textContent) return
        dispatch('citationHoverStart', citationID)
      })

      citation.addEventListener('mouseleave', () => {
        if (!citation.textContent) return
        dispatch('citationHoverEnd', citationID)
      })
    })
    elem.appendChild(tempDiv)
  }

  const debouncedRenderContent = useDebounce(renderContent, 10)

  onMount(() => {
    renderContent(content, sources)
  })
</script>

<div bind:this={elem} class="message max-w-screen-2xl chat-message-content"></div>

{#if sources && sources.length > 0 && showSourcesAtEnd}
  <div class="citations-list">
    {#each sources as source, idx}
      {#if idx <= 9}
        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
        <div
          class="citation-item"
          class:wide={source.metadata?.timestamp || source.metadata?.url}
          on:click={(e) => {
            document.querySelectorAll('citation').forEach((citation) => {
              citation.classList.remove('clicked')
            })
            document.querySelectorAll('.citation-item').forEach((citation) => {
              citation.classList.remove('clicked')
            })
            e.currentTarget.classList.add('clicked')
            dispatch('citationClick', { citationID: source.id, text: '', sourceUid: source.uid })
          }}
          on:mouseenter={() => dispatch('citationHoverStart', source.id)}
          on:mouseleave={() => dispatch('citationHoverEnd', source.id)}
        >
          {#if source.metadata?.timestamp}
            <img
              src="https://www.google.com/s2/favicons?domain=https://youtube.com&sz=40"
              alt="YouTube icon"
            />
            <div>{formatTimestamp(source.metadata.timestamp)}</div>
          {:else if source.metadata?.url}
            <img
              src={`https://www.google.com/s2/favicons?domain=${source.metadata.url}&sz=40`}
              alt="source icon"
            />
            <div>#{source.render_id}</div>
          {:else}
            #{source.render_id}
          {/if}
        </div>
      {/if}
    {/each}
  </div>
{/if}

<style lang="scss">
  .message {
    letter-spacing: 0.01em;
    margin-bottom: 1.5rem;
    line-height: 1.45;
  }

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
    background: rgb(226 240 255);
    border: 1px solid rgb(183 198 218);
    border-radius: 100%;
    user-select: none;
    cursor: pointer;
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
    background: rgb(226 240 255);
    border: 1px solid rgb(183 198 218);
    border-radius: 10px;
    user-select: none;
    cursor: pointer;
    width: fit-content;
    height: auto;
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

  .citations-list {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #ddd;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .citation-item {
    cursor: pointer;
    color: #333;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 0.5rem;
    background: rgb(226 240 255);
    border: 1px solid rgb(183 198 218);
    border-radius: 100%;
    font-size: 0.9rem;
    font-weight: 500;
    width: 2rem;
    height: 2rem;
    text-align: center;
  }

  .citation-item:hover {
    background: rgb(214, 234, 255);
  }
</style>
