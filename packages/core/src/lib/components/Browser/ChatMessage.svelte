<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import type { AIChatMessageSource } from './types'
  import Search from '@horizon/drawer/src/lib/Search.svelte'

  export let content: string
  export let sources: AIChatMessageSource[] | undefined
  export let showSourcesAtEnd: boolean = false

  const dispatch = createEventDispatcher<{
    citationClick: { citationID: string; text: string }
    citationHoverStart: string
    citationHoverEnd: string
  }>()

  let elem: HTMLDivElement

  $: {
    renderContent(content, sources)
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

  const renderContent = (content: string, sources?: AIChatMessageSource[]) => {
    console.log('TMP: renderContent', content)
    if (!elem || !content) return

    elem.innerHTML = ''

    let tempDiv = document.createElement('div')
    tempDiv.innerHTML = content

    const citationsToText = mapCitationsToText(tempDiv)
    console.log('TMP: citationsToText', citationsToText)

    const links = tempDiv.querySelectorAll('a')
    links.forEach((link) => {
      link.setAttribute('target', '_blank')
    })

    const citations = tempDiv.querySelectorAll('citation')
    let seen_citations = new Set<string>()

    citations.forEach((citation, index) => {
      const citationID = citation.textContent || ''
      const renderID = renderIDFromCitationID(citation.textContent, sources)
      if (!renderID) {
        citation.remove()
        return
      }

      let previousElementSibling = citation?.previousElementSibling
      if (
        previousElementSibling &&
        previousElementSibling.tagName === 'CITATION' &&
        previousElementSibling.textContent === renderID
      ) {
        citation.remove()
        return
      }

      citation.textContent = renderID
      seen_citations.add(renderID)
      citation.addEventListener('click', () => {
        if (!citation.textContent) return
        const text = citationsToText.get(index)
        if (!text) {
          console.error('ChatMessage: No text found for citation', citationID)
          alert('Error: No text found for citation')
          return
        }
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

  onMount(() => {
    renderContent(content, sources)
  })
</script>

<div bind:this={elem} class="message chat-message-content"></div>

{#if sources && sources.length > 0 && showSourcesAtEnd}
  <div class="citations-list">
    {#each sources as source, idx}
      <div
        class="citation-item"
        on:click={() => dispatch('citationClick', source.id)}
        on:mouseenter={() => dispatch('citationHoverStart', source.id)}
        on:mouseleave={() => dispatch('citationHoverEnd', source.id)}
      >
        {idx + 1}
      </div>
    {/each}
  </div>
{/if}

<style lang="scss">
  .message {
    letter-spacing: 0.01em;
    margin-bottom: 1.5rem;
    line-height: 1.45;
    max-width: 640px;
    margin: 0 auto;
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
    width: 1.75rem;
    height: 1.75rem;
    font-size: 1rem;
    background: rgb(255, 164, 164);
    border-radius: 100%;
    user-select: none;
    cursor: pointer;
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
    padding: 0.5rem;
    background: rgb(255, 164, 164);
    border-radius: 100%;
    font-size: 1rem;
    width: 2rem;
    height: 2rem;
    text-align: center;
  }

  .citation-item:hover {
    text-decoration: underline;
  }
</style>
