<script lang="ts">
  import './index.css'

  import { createEventDispatcher, tick } from 'svelte'
  import { derived, writable } from 'svelte/store'
  import autosize from 'svelte-autosize'

  import { Icon, IconConfirmation } from '@horizon/icons'
  import type { WebViewEventTransform } from '@horizon/types'

  import AiPrompts from './AIPrompts.svelte'
  import AiOutput from './AIOutput.svelte'
  import Wrapper from './Wrapper.svelte'
  import Button from './Button.svelte'
  import { Editor } from '@horizon/editor'
  import '@horizon/editor/src/editor.scss'

  export let text = ''

  let output = ''
  let inputValue = ''
  let running = false
  let expandedInput = false
  let elem: HTMLDivElement
  let inputElem: HTMLInputElement | HTMLTextAreaElement
  let markerIcon: IconConfirmation

  const view = writable<'initial' | 'ai' | 'comment'>('initial')
  const runningAction = writable<WebViewEventTransform['type'] | null>(null)

  const dispatch = createEventDispatcher<{
    save: string
    transform: { query?: string; type: WebViewEventTransform['type'] }
    copy: void
    highlight: void
    comment: string
    link: void
    insert: string
  }>()

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

  export const handleMarker = () => {
    markerIcon.showConfirmation()
    dispatch('highlight')
  }

  const handleDragStart = (event: DragEvent) => {
    event.stopPropagation()
    if (!event.dataTransfer) return

    event.dataTransfer.setData('text/plain', text)
    event.dataTransfer.setData('text/space-source', window.location.href)

    const rect = elem.getBoundingClientRect()

    event.dataTransfer.setDragImage(elem, event.clientX - rect.left, event.clientY - rect.top)
  }

  const resetMenu = () => {
    $view = 'initial'
    running = false
    inputValue = ''
    output = ''
    expandedInput = false
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

  const handleSaveOutput = () => {
    dispatch('save', output ? output : text)
  }

  const showAIMenu = async () => {
    $view = 'ai'
    await tick()
    inputElem.focus()
  }

  const showCommentMenu = async () => {
    $view = 'comment'
    await tick()
    // inputElem.focus()
  }

  const handleInsert = () => {
    dispatch('insert', output)
  }

  // const handleExpandInput = () => {
  //   expandedInput = true
  //   inputElem.focus()
  // }

  const handleComment = () => {
    running = true
    dispatch('comment', inputValue)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    const shortcutCombo = (e.metaKey || e.ctrlKey) && e.shiftKey
    if (e.key === 'Escape') {
      e.preventDefault()
      resetMenu()
    } else if (shortcutCombo && e.key === 'h') {
      e.preventDefault()
      handleMarker()
    } else if (shortcutCombo && e.key === 'm') {
      e.preventDefault()
      showCommentMenu()
    } else if (shortcutCombo && e.key === 'k') {
      e.preventDefault()
      // showLinkMenu()
    } else if (shortcutCombo && e.key === 'b') {
      if ($view === 'ai' && output) {
        e.preventDefault()
        handleSaveOutput()
      }
    } else if (shortcutCombo && e.key === 'i') {
      e.preventDefault()
      handleInsert()
    }
  }

  const handleInputKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // if (!expandedInput) {
        //   expandedInput = true
        // }

        return
      }

      e.preventDefault()
      handleComment()
    }
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<Wrapper bind:elem expanded={$view === 'comment'}>
  {#if $view === 'initial'}
    <div class="btn-row">
      <Button on:click={() => showAIMenu()} kind="secondary">
        <Icon name="sparkles" /> Ask AI
      </Button>

      <div class="divider"></div>

      <Button on:click={handleMarker} tooltip="Highlight and Save (⌘+Shift+H)">
        <IconConfirmation bind:this={markerIcon} name="marker" />
      </Button>

      <Button on:click={() => showCommentMenu()} icon="message" tooltip="Add Comment (⌘+Shift+M)" />

      <Button icon="link" tooltip="Add Link (⌘+Shift+K)" />

      <div class="divider"></div>

      <!-- svelte-ignore a11y-unknown-role -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div draggable="true" on:dragstart={handleDragStart} class="menu-drag-handle">
        <Icon name="grip.vertical" />
      </div>
    </div>
  {:else if $view === 'ai'}
    <form on:submit|stopPropagation|preventDefault={handleAISubmit}>
      <input
        bind:this={inputElem}
        bind:value={inputValue}
        disabled={running}
        type="text"
        placeholder={running ? $runningText : 'What do you want to do?'}
      />

      <Button
        type="submit"
        disabled={running}
        tooltip={running ? 'Generating…' : 'Ask AI (↵)'}
        kind="secondary"
      >
        {#if running}
          <Icon name="spinner" />
        {:else}
          <Icon name="sparkles" />
        {/if}
      </Button>
    </form>

    {#if !running && !output}
      <AiPrompts on:click={(e) => runAIAction(e.detail)} />
    {:else if output}
      <AiOutput {output} on:save={handleSaveOutput} on:insert={handleInsert} />
    {/if}
  {:else if $view === 'comment'}
    <form on:submit|stopPropagation|preventDefault={handleComment}>
      <div class="editor-wrapper">
        <Editor bind:content={inputValue} placeholder="Jot down your thoughts…" autofocus />
      </div>
      <!-- <textarea
        bind:this={inputElem}
        bind:value={inputValue}
        on:keydown={handleInputKeydown}
        use:autosize
        rows={1}
        disabled={running}
        placeholder="Jot down your thoughts…"
      /> -->

      <!-- {#if !expandedInput}
        <Button
          on:click={handleExpandInput}
          disabled={running}
          tooltip="Expand Input"
          icon="arrowHorizontal"
        />
      {/if} -->

      <Button
        type="submit"
        disabled={running}
        tooltip={running ? 'Saving…' : 'Add Comment (↵)'}
        kind="primary"
      >
        {#if running}
          <Icon name="spinner" />
        {:else}
          <Icon name="arrow.right" />
        {/if}
      </Button>
    </form>
  {/if}
</Wrapper>

<style lang="scss">
  .divider {
    width: 1px;
    background: #f0f0f0;
  }

  .btn-row {
    display: flex;
    align-items: stretch;
    gap: 8px;
  }

  .menu-drag-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 8px;
    cursor: grab;
    pointer-events: auto;
  }

  form {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  input {
    padding: 8px;
    border: 1px solid #f0f0f0;
    background: #ebebeb;
    border-radius: 8px;
    font-size: 16px;
    width: 100%;
    pointer-events: auto;
    min-width: 350px;

    &:focus {
      outline: none;
      border-color: #fd1bdf;
    }
  }

  textarea {
    padding: 10px;
    border: 1px solid #f0f0f0;
    background: #ebebeb;
    border-radius: 8px;
    font-size: 16px;
    width: 100%;
    pointer-events: auto;
    min-width: 350px;
    resize: vertical;
    font-family: inherit;

    &:focus {
      outline: none;
      border-color: #fd1bdf;
    }
  }

  .editor-wrapper {
    padding: 10px;
    border: 1px solid #f0f0f0;
    background: #ebebeb;
    border-radius: 8px;
    font-size: 16px;
    width: 100%;
    pointer-events: auto;
    min-width: 350px;
    resize: vertical;
    font-family: inherit;

    &:focus {
      outline: none;
      border-color: #fd1bdf;
    }
  }
</style>
