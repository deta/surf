<script lang="ts">
  import { Icon } from '@horizon/icons'
  import { createEventDispatcher, tick } from 'svelte'
  import './menu.css'

  export let text = ''

  let elem: HTMLDivElement
  let inputElem: HTMLInputElement
  let summarizing = false
  let showBookmarkingSuccess = false
  let showInput = false
  let inputValue = ''

  const dispatch = createEventDispatcher<{
    bookmark: void
    transform: { query?: string; type: string }
    copy: void
    highlight: void
    comment: void
    link: void
  }>()

  const handleDragStart = (event: DragEvent) => {
    event.stopPropagation()
    if (!event.dataTransfer) return

    event.dataTransfer.setData('text/plain', text)
    event.dataTransfer.setData('text/space-source', window.location.href)

    const rect = elem.getBoundingClientRect()

    event.dataTransfer.setDragImage(elem, event.clientX - rect.left, event.clientY - rect.top)
  }

  const handleSummarize = () => {
    summarizing = true
    dispatch('transform', { query: inputValue, type: 'custom' })
  }

  const handleBookmark = () => {
    showBookmarkingSuccess = true
    dispatch('bookmark')

    setTimeout(() => {
      showBookmarkingSuccess = false
    }, 2000)
  }

  const handleAskAI = async () => {
    showInput = true
    await tick()
    inputElem.focus()
  }
</script>

<div bind:this={elem} class="webview-menu-wrapper">
  {#if showInput}
    <form on:submit|stopPropagation|preventDefault={handleSummarize}>
      <input
        bind:this={inputElem}
        bind:value={inputValue}
        type="text"
        placeholder="What do you want to do?"
      />

      <button type="submit" disabled={summarizing} class="webview-menu-btn-primary">
        {#if summarizing}
          <Icon name="spinner" />
        {:else}
          <Icon name="sparkles" />
        {/if}
      </button>
    </form>
  {:else}
    <button on:click|stopPropagation|preventDefault={handleAskAI} class="webview-menu-btn-primary">
      <Icon name="sparkles" /> Ask AI
    </button>

    <div class="webview-menu-divider"></div>

    <button on:click|stopPropagation|preventDefault={handleBookmark}>
      {#if showBookmarkingSuccess}
        <Icon name="check" />
      {:else}
        <Icon name="quote" />
      {/if}
    </button>

    <button>
      <Icon name="marker" />
    </button>

    <button>
      <Icon name="message" />
    </button>

    <button>
      <Icon name="link" />
    </button>

    <!-- <button on:click|stopPropagation|preventDefault={() => dispatch('copy')}>
                <Icon name="copy" />
            </button> -->

    <div class="webview-menu-divider"></div>

    <!-- svelte-ignore a11y-unknown-role -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div draggable="true" on:dragstart={handleDragStart} class="webview-menu-drag">
      <Icon name="grip.vertical" />
    </div>
  {/if}
</div>
