<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte'
  import { Icon } from '@horizon/icons'
  import type { WebViewEventTransform } from '@horizon/types'
  import './menu.css'
  import { useClipboard } from '@horizon/core/src/lib/utils/clipboard'
  import { derived, writable } from 'svelte/store'
  import { tooltip } from '@svelte-plugins/tooltips'

  export let text = ''

  let output = ''
  let elem: HTMLDivElement
  let inputElem: HTMLInputElement
  let running = false
  let showBookmarkingSuccess = false
  let showInput = false
  let inputValue = ''
  let insertingText = false

  const runningAction = writable<WebViewEventTransform['type'] | null>(null)

  const dispatch = createEventDispatcher<{
    bookmark: string
    transform: { query?: string; type: WebViewEventTransform['type'] }
    copy: void
    highlight: void
    comment: void
    link: void
    insert: string
  }>()

  const { copy, copied } = useClipboard()

  const runningText = derived(runningAction, (runningAction) => {
    switch (runningAction) {
      case 'summarize':
        return 'Summarizing selection…'
      case 'explain':
        return 'Explaining selection…'
      case 'grammar':
        return 'Improving selection…'
      case 'translate':
        return 'Translating selection…'
      default:
        return ''
    }
  })

  export const handleOutput = (text: string) => {
    running = false
    inputValue = ''
    output = text
  }

  const handleDragStart = (event: DragEvent) => {
    event.stopPropagation()
    if (!event.dataTransfer) return

    event.dataTransfer.setData('text/plain', text)
    event.dataTransfer.setData('text/space-source', window.location.href)

    const rect = elem.getBoundingClientRect()

    event.dataTransfer.setDragImage(elem, event.clientX - rect.left, event.clientY - rect.top)
  }

  const handleAISubmit = () => {
    running = true
    dispatch('transform', { query: inputValue, type: 'custom' })
  }

  const runAIAction = (type: WebViewEventTransform['type']) => {
    running = true
    $runningAction = type
    dispatch('transform', { type: type })
  }

  const handleBookmark = () => {
    showBookmarkingSuccess = true
    dispatch('bookmark', output ? output : text)

    setTimeout(() => {
      showBookmarkingSuccess = false
    }, 2000)
  }

  const showAIMenu = async () => {
    showInput = true
    await tick()
    inputElem.focus()
  }

  const handleInsert = () => {
    insertingText = true
    dispatch('insert', output)
  }
</script>

<div bind:this={elem} class="webview-menu-wrapper">
  {#if showInput}
    <form on:submit|stopPropagation|preventDefault={handleAISubmit}>
      <input
        bind:this={inputElem}
        bind:value={inputValue}
        type="text"
        placeholder={running ? $runningText : 'What do you want to do?'}
      />

      <button type="submit" disabled={running} class="webview-menu-btn-primary">
        {#if running}
          <Icon name="spinner" />
        {:else}
          <Icon name="sparkles" />
        {/if}
      </button>
    </form>

    {#if !running && !output}
      <div class="webview-menu-transform-actions">
        <button on:click|preventDefault|stopPropagation={() => runAIAction('summarize')}>
          <div>Summarize</div>
          <Icon name="arrow.right" />
        </button>

        <button on:click|preventDefault|stopPropagation={() => runAIAction('explain')}>
          <div>Explain</div>
          <Icon name="arrow.right" />
        </button>

        <button on:click|preventDefault|stopPropagation={() => runAIAction('grammar')}>
          <div>Improve Writing</div>
          <Icon name="arrow.right" />
        </button>

        <button on:click|preventDefault|stopPropagation={() => runAIAction('translate')}>
          <div>Translate</div>
          <Icon name="arrow.right" />
        </button>
      </div>
    {:else if output}
      <div class="webview-menu-output">
        {@html output}
      </div>

      <div class="webview-menu-output-actions">
        <button
          title="Copy to Clipboard"
          on:click|stopPropagation|preventDefault={() => copy(output)}
          use:tooltip={{
            content: 'Copy to Clipboard',
            action: 'hover',
            position: 'top',
            animation: 'fade',
            delay: 500
          }}
        >
          {#if $copied}
            <Icon name="check" />
          {:else}
            <Icon name="copy" />
          {/if}
        </button>

        <button
          title="Save to Oasis"
          on:click|stopPropagation|preventDefault={handleBookmark}
          use:tooltip={{
            content: 'Save to Oasis',
            action: 'hover',
            position: 'top',
            animation: 'fade',
            delay: 500
          }}
        >
          {#if showBookmarkingSuccess}
            <Icon name="check" />
          {:else}
            <Icon name="quote" />
          {/if}
        </button>

        <button
          title="Replace Selection with Text"
          on:click|stopPropagation|preventDefault={handleInsert}
          use:tooltip={{
            content: 'Replace Selection with Text',
            action: 'hover',
            position: 'top',
            animation: 'fade',
            delay: 500
          }}
        >
          {#if insertingText}
            <Icon name="check" />
          {:else}
            <Icon name="textInsert" />
          {/if}
        </button>
      </div>
    {/if}
  {:else}
    <div class="webview-menu-row">
      <button
        on:click|stopPropagation|preventDefault={() => showAIMenu()}
        class="webview-menu-btn-primary"
      >
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

      <div class="webview-menu-divider"></div>

      <!-- svelte-ignore a11y-unknown-role -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div draggable="true" on:dragstart={handleDragStart} class="webview-menu-drag">
        <Icon name="grip.vertical" />
      </div>
    </div>
  {/if}
</div>
