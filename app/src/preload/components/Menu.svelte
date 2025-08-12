<script lang="ts">
  import './index.css'

  import { createEventDispatcher, tick } from 'svelte'
  import { derived, writable } from 'svelte/store'

  import { Icon, IconConfirmation } from '@deta/icons'
  import type { WebViewEventTransform } from '@deta/types'

  import AiPrompts from './AIPrompts.svelte'
  import Wrapper from './Wrapper.svelte'
  import Button from './Button.svelte'
  import { Editor, getEditorContentText } from '@deta/editor'
  import '@deta/editor/src/editor.scss'
  import MarkdownRenderer from '@deta/editor/src/lib/components/MarkdownRenderer.svelte'
  import { onMount } from 'svelte'

  export let text = ''

  let output = ''
  let inputValue = ''
  let running = false
  let includePageContext = false
  let tags: string[] = []
  let elem: HTMLDivElement
  let inputElem: HTMLInputElement | HTMLTextAreaElement
  let markerIcon: IconConfirmation
  let editorFocused = true
  let editor: Editor
  let menuItems = [
    { name: 'Save...', icon: 'save' },
    { name: 'Copy', icon: 'copy' }
  ]

  let lastPrompt = ''

  const view = writable<'initial' | 'ai' | 'comment'>('initial')
  const runningAction = writable<WebViewEventTransform['type'] | null>(null)

  const dispatch = createEventDispatcher<{
    save: string
    transform: {
      query?: string
      type: WebViewEventTransform['type']
      includePageContext: boolean
      isFollowUp?: boolean
    }
    copy: void
    highlight: void
    comment: { plain: string; html: string; tags: string[] }
    link: void
    insert: string
    addToChat: string
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

  export const canClose = () => {
    if ($view === 'comment') {
      return inputValue === '' || inputValue === '<p></p>'
    } else if ($view === 'ai') {
      return !running
    }

    return true
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
    lastPrompt = ''
  }

  const handleAISubmit = () => {
    const savedInputValue = inputValue.trim().replace('<p>', '').replace('</p>', '')
    running = true
    dispatch('transform', {
      query: inputValue,
      type: 'custom',
      includePageContext: includePageContext,
      isFollowUp: lastPrompt !== ''
    })
    lastPrompt = savedInputValue
  }

  const handleAddToChat = () => {
    if (text && text.length > 0) {
      dispatch('addToChat', text)
      text = ''
    }
  }

  const runAIAction = (type: WebViewEventTransform['type']) => {
    output = ''
    running = true
    $runningAction = type
    lastPrompt = type
    inputValue = ''
    dispatch('transform', { type: type, includePageContext: includePageContext })
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

    const html = inputValue
    const text = getEditorContentText(html)
    dispatch('comment', { plain: text, html, tags: tags })
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
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'l' && e.shiftKey) {
      e.preventDefault()
      handleAddToChat()
    } else if (shortcutCombo && e.key === 'j') {
      e.preventDefault()
      showAIMenu()
    } else if (shortcutCombo && e.key === 'b') {
      if ($view === 'ai' && output) {
        e.preventDefault()
        handleSaveOutput()
      }
    }
    // else if (shortcutCombo && e.key === 'i') {
    //   e.preventDefault()
    //   handleInsert()
    // }
  }

  const handleInputKey = (e: KeyboardEvent) => {
    // check if key is letter or other visible character and stop propagation to prevent site shortcuts from firing
    if (e.key.length === 1 || e.key === ' ' || e.key === 'Backspace') {
      e.stopImmediatePropagation()
    }
  }

  const handleHashtags = (e: CustomEvent<string[]>) => {
    tags = e.detail
  }

  const saveResponseOutput = async (response: string) => {
    dispatch('save', response)
  }

  function handleAIMessageItemClick(index: number) {
    switch (index) {
      case 0:
        saveResponseOutput(output)
        break
      case 1:
        handleAIMessageCopy()
        break
    }
  }

  function handleAIMessageCopy() {
    navigator.clipboard.writeText(output)
    dispatch('copy')
  }

  onMount(() => {
    resetMenu()
  })
</script>

<svelte:window on:keydown={handleKeyDown} />

<Wrapper bind:elem expanded={$view === 'comment'}>
  {#if $view === 'initial'}
    <div class="btn-row">
      <Button on:click={() => showAIMenu()} kind="secondary" tooltip="Ask AI">
        <Icon name="sparkles" />
      </Button>

      <div class="divider"></div>

      <Button on:click={handleMarker} tooltip="Highlight and Save (⌘+Shift+H)">
        <IconConfirmation bind:this={markerIcon} name="marker" />
      </Button>

      <Button on:click={() => showCommentMenu()} icon="message" tooltip="Add Comment" />

      <div class="divider"></div>

      <Button on:click={handleAddToChat} tooltip="Add to Chat (⌘+Shift+L)">
        <Icon name="message-forward" />
      </Button>

      <!-- svelte-ignore a11y-unknown-role -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <!-- <div draggable="true" on:dragstart={handleDragStart} class="menu-drag-handle">
        <Icon name="grip.vertical" />
      </div> -->
    </div>
  {:else if $view === 'ai'}
    <div class="ai-menu">
      <div class="top-section">
        {#if output}
          <div class="ai-response">
            {#if lastPrompt && !running}
              <div class="last-prompt">
                {@html lastPrompt}
              </div>
            {/if}

            <div class="!prose-sm">
              <MarkdownRenderer content={output} id="chat-message" size="sm" />
            </div>

            {#if output.length > 0 && !running}
              <div class="save-buttons">
                {#each menuItems as item, index}
                  <button on:click={() => handleAIMessageItemClick(index)}>
                    <Icon name={item.icon} size="14px" className="!text-gray-500" />
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        <form
          class="editor"
          class:border-t={output}
          on:submit|stopPropagation|preventDefault={handleAISubmit}
        >
          <div class="editor-wrappy">
            <input
              bind:this={inputElem}
              bind:value={inputValue}
              on:keydown={handleInputKey}
              on:keyup={handleInputKey}
              on:keypress={handleInputKey}
              disabled={running}
              type="text"
              placeholder={running ? $runningText : 'Ask a question...'}
            />
            <!-- <Editor
              bind:this={editor}
              bind:content={inputValue}
              bind:focused={editorFocused}
              on:submit={handleAISubmit}
              autofocus={true}
              placeholder="Ask a question..."
            /> -->
          </div>
        </form>
      </div>

      <div class="bar">
        <div class="bar-wrapper">
          <button
            on:click={() => {
              if (inputValue.length > 0 && !running) {
                handleAISubmit()
              } else {
                resetMenu()
              }
            }}
            disabled={inputValue.length > 0 && running}
          >
            {#if inputValue.length > 0 && !running}
              <!-- <kbd class="text-gray-500">↵</kbd> -->
              <span>Submit</span>
            {:else if running}
              <div>
                <span class="ball"></span>
                <span class="ball" style="animation-delay: 0.2s;"></span>
                <span class="ball" style="animation-delay: 0.4s;"></span>
              </div>
            {:else}
              <!-- <kbd class="text-gray-500 text-xs">ESC</kbd> -->
              <span>Cancel</span>
            {/if}
          </button>

          <div aria-disabled={running} style="opacity: {running ? 0.5 : 1}">
            <AiPrompts on:click={(e) => runAIAction(e.detail)} />
          </div>
        </div>
      </div>
    </div>

    <!-- <label class="context-check">
    <input type="checkbox" bind:checked={includePageContext} />
    Include Page Context
  </label> -->
  {:else if $view === 'comment'}
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <form
      on:submit|stopPropagation|preventDefault={handleComment}
      on:keydown={handleInputKey}
      on:keyup={handleInputKey}
      on:keypress={handleInputKey}
      class="comment-view"
    >
      <div class="editor-wrapper">
        <Editor
          bind:content={inputValue}
          on:submit={handleComment}
          on:hashtags={handleHashtags}
          parseHashtags
          placeholder="Jot down your thoughts…"
          autofocus
          submitOnEnter
        />
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

  .comment-view {
    gap: 4px;
    background: #fff;
    padding: 4px;
    border-radius: 0.5rem;
  }

  .btn-row {
    display: flex;
    align-items: stretch;
    gap: 4px;
    background: #fff;
    padding: 4px;
    border-radius: 12px;
  }

  .ai-menu {
    width: 400px;
    border-radius: 0.5rem;
  }

  .top-section {
    background-color: #fafafa;
    border-top-left-radius: 0.5rem;
    border-top-right-radius: 0.5rem;
    padding-left: 0.75rem;
    padding-right: 0.75rem;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
  }

  .ai-response {
    overflow-y: auto;
    max-height: 20rem;
    padding-top: 0.5rem;
    width: 100%;
    overflow-x: hidden;
    color: #262626 !important;
  }

  .last-prompt {
    padding-top: 0.5rem;
    margin-bottom: 0.5rem;
    border-radius: 0.75rem;
    width: fit-content;
    color: black;
    font-weight: 600;
  }

  .save-buttons {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 8px;
    margin-bottom: 8px;
  }

  .save-buttons button {
    border: none;
    background: none;

    padding: 0;
    margin: 0;
    user-select: none;
    border-radius: 0.75rem;
    padding: 8px;
    font-size: 14px;
    font-weight: 600;
    color: #262626;
    transition: background-color 0.2s;
  }

  .editor {
    flex: 1;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
  }

  .border-t {
    border-top: 1px solid #e5e5e5;
  }

  .editor-wrappy {
    flex-grow: 1;
    overflow-y: auto;
    max-height: 6rem;
  }

  .bar {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    padding: 0.25rem;
    border-bottom-left-radius: 0.5rem;
    border-bottom-right-radius: 0.5rem;
    background-color: #f5f5f5;
    font-size: 14px;
  }

  .bar-wrapper {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    width: 100%;
    align-items: center;
    gap: 8px;
  }

  .bar-wrapper button {
    border: none;
    background: none;

    padding: 0;
    margin: 0;
    user-select: none;
    border-radius: 0.75rem;
    padding: 8px;
    font-size: 14px;
    font-weight: 600;
    color: #262626;
    transition: background-color 0.2s;
  }

  .ball {
    width: 0.375rem;
    height: 0.375rem;
    border-radius: 100%;
    background-color: #a3a3a3;
    display: inline-block;
    animation: flash 0.5s infinite;
  }

  @keyframes flash {
    0% {
      opacity: 0;
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  form {
    display: flex;
    gap: 8px;

    input {
      width: 100%;
      background-color: transparent;
      border: none;
      color: #262626;
      pointer-events: auto;
      &:focus {
        outline: none;
      }
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
    }
  }
</style>
