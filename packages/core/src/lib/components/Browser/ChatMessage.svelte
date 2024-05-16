<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import type { AIChatMessage } from './types'

  export let message: AIChatMessage

  const dispatch = createEventDispatcher<{
    citationClick: string
    citationHoverStart: string
    citationHoverEnd: string
  }>()

  let elem: HTMLDivElement

  $: content = message.content
  $: console.log('content', content)

  $: {
    renderContent(content)
  }

  const renderContent = (content: string) => {
    console.log('render content', content)
    if (!elem || !content) return

    elem.innerHTML = ''

    let tempDiv = document.createElement('div')
    tempDiv.innerHTML = content

    const links = tempDiv.querySelectorAll('a')
    links.forEach((link) => {
      link.setAttribute('target', '_blank')
    })

    const citations = tempDiv.querySelectorAll('citation')
    citations.forEach((citation) => {
      citation.addEventListener('click', () => {
        if (!citation.textContent) return
        dispatch('citationClick', citation.textContent)
      })

      citation.addEventListener('mouseenter', () => {
        if (!citation.textContent) return
        dispatch('citationHoverStart', citation.textContent)
      })

      citation.addEventListener('mouseleave', () => {
        if (!citation.textContent) return
        dispatch('citationHoverEnd', citation.textContent)
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
    color: rgba(70, 2, 51, 0.7);
    font-size: 1.5rem;
    letter-spacing: 0.01em;
    margin-bottom: 1.5rem;
    line-height: 1.45;
    max-width: 640px;
    margin: 0 auto;
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
