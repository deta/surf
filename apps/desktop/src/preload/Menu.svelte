<script lang="ts">
  import { Icon } from '@horizon/icons'
  import { createEventDispatcher } from 'svelte'
  import './menu.css'

  export let text = ''

  let elem: HTMLDivElement
  let summarizing = false
  let showBookmarkingSuccess = false

  const dispatch = createEventDispatcher<{
    bookmark: void
    summarize: void
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
    dispatch('summarize')
  }

  const handleBookmark = () => {
    showBookmarkingSuccess = true
    dispatch('bookmark')

    setTimeout(() => {
      showBookmarkingSuccess = false
    }, 2000)
  }
</script>

<div bind:this={elem} class="webview-menu-wrapper">
  <button
    on:click|stopPropagation|preventDefault={handleSummarize}
    class="webview-menu-btn-primary"
  >
    {#if summarizing}
      <Icon name="spinner" /> Summarizing…
    {:else}
      <Icon name="sparkles" /> Summarize
    {/if}
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
</div>
