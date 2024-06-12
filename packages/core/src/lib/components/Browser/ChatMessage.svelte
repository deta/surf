<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import type { AIChatMessageSource } from './types'

  export let content: string
  export let sources: AIChatMessageSource[] | undefined

  const dispatch = createEventDispatcher<{
    citationClick: string
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

  // TODO: come up with a better way to render these things as this is not very performant when the content gets streamed in
  const renderContent = (content: string, sources?: AIChatMessageSource[]) => {
    if (!elem || !content) return

    elem.innerHTML = ''

    let tempDiv = document.createElement('div')
    tempDiv.innerHTML = content

    const links = tempDiv.querySelectorAll('a')
    links.forEach((link) => {
      link.setAttribute('target', '_blank')
    })

    const citations = tempDiv.querySelectorAll('citation')
    let seen_citations = new Set<string>()

    citations.forEach((citation) => {
      const citationID = citation.textContent || ''
      const renderID = renderIDFromCitationID(citation.textContent, sources)
      if (!renderID) {
        citation.remove()
        return
      }

      // remove consecutive citations with the same render id
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
        dispatch('citationClick', citationID)
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
    renderContent(content)
  })
</script>

<div bind:this={elem} class="message chat-message-content"></div>

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
</style>
