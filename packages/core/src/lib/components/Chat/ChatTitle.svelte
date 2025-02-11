<script lang="ts">
  import { useDebounce } from '@horizon/utils'
  import type { AIChat } from '@horizon/core/src/lib/service/ai/chat'

  export let chat: AIChat
  export let small: boolean = false
  export let fallback = 'New Chat'

  $: title = chat.title
  $: generatingTitle = chat.generatingTitle

  let showReveal = false
  let startedGenerating = false

  $: if ($generatingTitle) {
    startedGenerating = true
  }

  $: if (startedGenerating && !$generatingTitle) {
    showReveal = true
    startedGenerating = false

    setTimeout(() => {
      showReveal = false
    }, 400)
  }

  let inputElem: HTMLInputElement

  const handleUpdateTitle = useDebounce((e) => {
    const value = e.target.value
    if (!value || value === title) return

    chat.changeTitle(value)
  }, 500)

  const handleBlur = async (e) => {
    const value = e.target.value
    if (!value) {
      const generatedTitle = await chat.generateTitle()
      if (generatedTitle) {
        inputElem.value = generatedTitle
      }
    }
  }
</script>

<div class="chat-title" class:small class:reveal={showReveal}>
  <input
    bind:this={inputElem}
    type="text"
    value={$title || fallback}
    placeholder={$generatingTitle ? 'Generating title…' : 'Chat title'}
    on:input={handleUpdateTitle}
    on:blur={handleBlur}
  />
</div>

<style lang="scss">
  .chat-title {
    width: fit-content;

    input {
      font-size: 1.2em;
      font-weight: 450;
      border: none;
      outline: none;
      background: transparent;
      field-sizing: content;
      transition: filter 0.3s ease;
    }

    &.small {
      input {
        font-size: 1em;
        font-weight: normal;
        letter-spacing: 0.01em;
      }
    }

    &.reveal {
      animation: textReveal 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;

      input {
        animation: glowEffect 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      }
    }
  }

  @keyframes textReveal {
    0% {
      transform: translateX(-15px) scale(0.95);
      opacity: 0;
    }
    30% {
      opacity: 0.3;
    }
    100% {
      transform: translateX(0) scale(1);
      opacity: 1;
    }
  }

  @keyframes glowEffect {
    0% {
      filter: blur(4px) brightness(1);
    }
    30% {
      filter: blur(2px) brightness(1.2);
    }
    60% {
      filter: blur(1px) brightness(1.1);
    }
    100% {
      filter: blur(0) brightness(1);
    }
  }
</style>
