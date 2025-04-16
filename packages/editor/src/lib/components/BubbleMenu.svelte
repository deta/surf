<script lang="ts">
  import { writable, type Readable } from 'svelte/store'
  import { BubbleMenu, type Editor } from 'svelte-tiptap'

  import { Icon } from '@horizon/icons'
  import { createEventDispatcher, tick } from 'svelte'
  import { parseStringIntoUrl } from '@horizon/utils'
  import type { EditorRewriteEvent, EditorSimilaritiesSearchEvent, MentionItem } from '../types'
  import EditorComp from './Editor.svelte'

  export let loading = false
  export let editor: Readable<Editor>
  export let mentionItems: MentionItem[] = []
  export let autosearch = false
  export let showRewrite = false
  export let showSimilaritySearch = false

  const dispatch = createEventDispatcher<{
    'open-bubble-menu': void
    'close-bubble-menu': void
    rewrite: EditorRewriteEvent
    'similarity-search': EditorSimilaritiesSearchEvent
  }>()

  $: isActive = (name: string, attrs = {}) => $editor.isActive(name, attrs)

  const inputShown = writable(false)

  let editorElem: EditorComp
  let inputElem: HTMLInputElement
  let inputValue = ''
  let inputType: 'link' | 'rewrite' = 'rewrite'

  const showInput = async (type: typeof inputType) => {
    inputType = type
    $inputShown = true

    if (type === 'link') {
      await tick()
      inputElem.focus()
    }
  }

  const handleLink = () => {
    try {
      if (isActive('link')) {
        $editor.chain().focus().extendMarkRange('link').unsetLink().run()
      } else {
        showInput('link')
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleShowRewrite = async () => {
    showInput('rewrite')
  }

  const handleFindSimilar = (loading = true) => {
    try {
      const selection = {
        from: $editor.state.selection.from,
        to: $editor.state.selection.to
      }

      const selectedText = $editor.state.doc.textBetween(selection.from, selection.to)

      dispatch('similarity-search', {
        text: selectedText,
        range: selection,
        loading: loading
      })
    } catch (e) {
      console.error(e)
    }
  }

  const rewrite = async () => {
    try {
      const { text, mentions } = editorElem.getParsedEditorContent()

      const selection = {
        from: $editor.state.selection.from,
        to: $editor.state.selection.to
      }

      const selectedText = $editor.state.doc.textBetween(selection.from, selection.to)

      loading = true
      $inputShown = false
      dispatch('rewrite', {
        prompt: text,
        text: selectedText,
        range: selection,
        mentions: mentions
      })
    } catch (e) {
      console.error(e)
    }
  }

  const handleSubmit = () => {
    try {
      if (inputType === 'link') {
        const url = parseStringIntoUrl(inputValue)
        if (url) {
          $editor.chain().focus().extendMarkRange('link').setLink({ href: url.href }).run()
        } else {
          $editor.chain().focus().extendMarkRange('link').unsetLink().run()
        }
      } else {
        rewrite()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSubmit()

      $inputShown = false
      inputValue = ''
    }
  }

  const handleOpen = () => {
    $inputShown = false
    inputValue = ''
    inputType = 'rewrite'
    loading = false

    dispatch('open-bubble-menu')

    if (autosearch) {
      handleFindSimilar(false)
    }
  }

  const handleClose = () => {
    dispatch('close-bubble-menu')
  }
</script>

<BubbleMenu editor={$editor} tippyOptions={{ onShow: handleOpen, onHide: handleClose }}>
  <div class="bubble-menu">
    {#if loading}
      <div class="loading">
        <Icon name="spinner" size="16px" />
        <div>Thinking…</div>
      </div>
    {:else if $inputShown}
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="input-wrapper" on:keydown={handleKeydown}>
        {#if inputType === 'link'}
          <input
            bind:this={inputElem}
            bind:value={inputValue}
            placeholder="Enter a URL"
            on:keydown={handleKeydown}
          />
        {:else}
          <EditorComp
            bind:this={editorElem}
            bind:content={inputValue}
            {mentionItems}
            placeholder="How do you want to rewrite it?"
            autofocus={true}
            parseMentions
          />
        {/if}
        <button on:click={handleSubmit}>
          <Icon name="arrow.right" />
        </button>
      </div>
    {:else}
      <div class="menu-section">
        <button
          class:active={isActive('bold')}
          on:click={() => $editor.chain().focus().toggleBold().run()}
        >
          <Icon name="bold" />
        </button>

        <button
          class:active={isActive('italic')}
          on:click={() => $editor.chain().focus().toggleItalic().run()}
        >
          <Icon name="italic" />
        </button>

        <button
          class:active={isActive('strike')}
          on:click={() => $editor.chain().focus().toggleStrike().run()}
        >
          <Icon name="strike" />
        </button>

        <button
          class:active={isActive('code')}
          on:click={() => $editor.chain().focus().toggleCode().run()}
        >
          <Icon name="code" />
        </button>

        <button class:active={isActive('link')} on:click={handleLink}>
          <Icon name="link" />
        </button>
      </div>

      {#if showRewrite || showSimilaritySearch}
        <div class="divider"></div>

        <div class="menu-section">
          {#if showRewrite}
            <button on:click={handleShowRewrite} id="editor-bubble-rewrite-btn">
              <Icon name="wand" size="17px" />
            </button>
          {/if}

          {#if showSimilaritySearch}
            <button on:click={handleFindSimilar} id="editor-bubble-similarity-btn">
              <Icon name="file-text-ai" size="17px" />
            </button>
          {/if}

          <!-- <button
                class:active={isActive('heading', { level: 1 })}
                on:click={() => $editor.chain().focus().toggleHeading({ level: 1 }).run()}
            >
                <Icon name="h1" />
            </button>

            <button
                class:active={isActive('heading', { level: 2 })}
                on:click={() => $editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
                <Icon name="h2" />
            </button>

            <button
                
                on:click={() => $editor.chain().focus().setParagraph().run()}
            >
                <Icon name="paragraph" />
            </button>

            <button
                class:active={isActive('bulletList')}
                on:click={() => $editor.chain().focus().toggleBulletList().run()}
            >
                <Icon name="list" />
            </button>

            <button
                class:active={isActive('orderedList')}
                on:click={() => $editor.chain().focus().toggleOrderedList().run()}
            >
                <Icon name="list-numbered" />
            </button>

            <button
                class:active={isActive('taskList')}
                on:click={() => $editor.chain().focus().toggleTaskList().run()}
            >
                <Icon name="list-check" />
            </button>

            <button
                class:active={isActive('blockquote')}
                on:click={() => $editor.chain().focus().toggleBlockquote().run()}
            >
                <Icon name="list-check" />
            </button> -->
        </div>
      {/if}
    {/if}
  </div>
</BubbleMenu>

<style lang="scss">
  .bubble-menu {
    display: flex;
    align-items: center;
    gap: 1rem;

    --ctx-background: #fff;
    --ctx-border: rgba(0, 0, 0, 0.25);
    --ctx-shadow-color: rgba(0, 0, 0, 0.12);

    --ctx-item-hover: #2497e9;
    --ctx-item-text: #210e1f;
    --ctx-item-text-hover: #fff;

    :global(.dark) & {
      --color-menu: #fff;
      --color-menu-muted: #949494;
      --ctx-background: #1a1a1a;
      --ctx-border: rgba(255, 255, 255, 0.25);
      --ctx-shadow-color: rgba(0, 0, 0, 0.5);

      --ctx-item-hover: #2497e9;
      --ctx-item-text: #fff;
      --ctx-item-text-hover: #fff;
    }

    background: var(--ctx-background);
    padding: 0.5rem 0.5rem;
    border-radius: 9px;
    border: 0.5px solid var(--ctx-border);
    box-shadow: 0 2px 10px var(--ctx-shadow-color);
    user-select: none;
    font-size: 0.95em;
    overflow: auto;

    animation: scale-in 125ms cubic-bezier(0.19, 1, 0.22, 1);

    &::backdrop {
      background-color: rgba(0, 0, 0, 0);
    }

    .loading {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.95em;
    }

    .menu-section {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .divider {
      width: 1px;
      height: 1.5rem;
      background: var(--color-menu-muted);
      opacity: 0.5;
    }

    button {
      display: flex;
      background: none;
      border: none;
      outline: none;
      margin: 0;
      padding: 0;
      color: var(--color-menu-muted);
      transition: all 0.2s ease-in-out;

      &:hover {
        color: var(--color-menu);
      }

      &.active {
        color: var(--color-menu);
      }
    }

    input {
      width: 100%;
      background: none;
      padding-left: 0.5rem;
      outline: none;
      border: none;
      font-size: 0.95em;
    }

    .input-wrapper {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 550px;
      max-height: 120px;
    }
  }

  :global(.bubble-menu .editor-wrapper div.tiptap) {
    padding-bottom: 0 !important;
  }
</style>
