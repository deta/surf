<script lang="ts">
  import { writable, type Readable } from 'svelte/store'
  import { BubbleMenu, type Editor } from 'svelte-tiptap'
  import { NodeSelection } from '@tiptap/pm/state'

  import { Icon } from '@deta/icons'
  import { createEventDispatcher, tick } from 'svelte'
  import {
    isMac,
    isModKeyAndKeyPressed,
    parseStringIntoUrl,
    tooltip,
    useDebounce
  } from '@deta/utils'
  import type {
    EditorRewriteEvent,
    EditorSimilaritiesSearchEvent,
    LinkItemsFetcher,
    MentionItem
  } from '../types'
  import EditorComp from './Editor.svelte'
  import type { MentionItemsFetcher } from '../extensions/Mention/suggestion'
  import MentionList from '../extensions/Mention/MentionList.svelte'

  export let loading = false
  export let editor: Readable<Editor>
  export let mentionItemsFetcher: MentionItemsFetcher | undefined = undefined
  export let autosearch = false
  export let showRewrite = false
  export let showSimilaritySearch = false
  export let linkItemsFetcher: LinkItemsFetcher | undefined = undefined

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
  let mentionList: MentionList
  let inputValue = ''
  let inputType: 'link' | 'rewrite' = 'rewrite'
  let linkItems: MentionItem[] = []
  let isOpen = false

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

  const turnSelectionIntoLink = (url: string) => {
    $editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const unsetLink = () => {
    $editor.chain().focus().extendMarkRange('link').unsetLink().run()
  }

  const handleSubmit = () => {
    try {
      if (inputType === 'link') {
        const url = parseStringIntoUrl(inputValue)
        if (url) {
          turnSelectionIntoLink(url.href)
        } else {
          unsetLink()
        }
      } else {
        rewrite()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const searchLinkItems = useDebounce(async () => {
    if (linkItemsFetcher) {
      linkItems = await linkItemsFetcher(inputValue)
    }
  }, 200)

  const handleKeydown = async (event: KeyboardEvent) => {
    if (event.key === 'Enter' || !linkItems) {
      handleSubmit()

      $inputShown = false
      inputValue = ''
    }
    if (mentionList) {
      mentionList.onKeyDown(event)
    }

    searchLinkItems()
  }

  const handleOpen = () => {
    isOpen = true
    $inputShown = false
    inputValue = ''
    inputType = 'rewrite'
    linkItems = []
    loading = false

    dispatch('open-bubble-menu')

    if (autosearch) {
      handleFindSimilar(false)
    }
  }

  const handleClose = () => {
    isOpen = false
    dispatch('close-bubble-menu')
  }

  const handleLinkItemSelect = (item: MentionItem) => {
    const resource = item.data
    if (resource) {
      turnSelectionIntoLink(`surf://surf/resource/${resource.id}`)
    }

    $inputShown = false
    inputValue = ''
  }

  const handleWindowKeyDown = (event: KeyboardEvent) => {
    // check if the editor is focused and the bubble menu is open
    if (!isOpen || !$editor.isFocused) {
      return
    }

    if (isModKeyAndKeyPressed(event, 'k')) {
      event.preventDefault()
      handleLink()
    }
  }
</script>

<svelte:window on:keydown={handleWindowKeyDown} />

<BubbleMenu
  editor={$editor}
  shouldShow={({ editor, state }) => {
    const { selection } = state

    // Don't show bubble menu when a node is selected (like images/resources)
    if (selection instanceof NodeSelection) {
      return false
    }

    // Don't show if selection is empty
    if (selection.empty) {
      return false
    }

    // Check if we're inside a resource node
    const { $from } = selection
    if ($from.parent.type.name === 'resource') {
      return false
    }

    return true
  }}
  tippyOptions={{ onShow: handleOpen, onHide: handleClose, placement: 'bottom' }}
>
  <div class="bubble-menu-wrapper">
    {#if loading}
      <div class="bubble-menu">
        <div class="loading">
          <Icon name="spinner" size="16px" />
          <div>Thinking…</div>
        </div>
      </div>
    {:else if $inputShown}
      {#if inputType === 'link'}
        <div class="link-menu not-prose">
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div class="input-wrapper">
            <input
              bind:this={inputElem}
              bind:value={inputValue}
              placeholder="Enter a URL or search your stuff"
              on:keydown={handleKeydown}
            />

            <button on:click={handleSubmit}>
              <Icon name="arrow.right" />
            </button>
          </div>

          <MentionList
            bind:this={mentionList}
            items={linkItems}
            callback={handleLinkItemSelect}
            minimal
            hideSectionTitle
            hideEmpty
          />
        </div>
      {:else if inputType === 'rewrite'}
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div class="input-wrapper" on:keydown={handleKeydown}>
          <EditorComp
            bind:this={editorElem}
            bind:content={inputValue}
            {mentionItemsFetcher}
            placeholder="How do you want to rewrite it?"
            autofocus={true}
            parseMentions
          />

          <button on:click={handleSubmit}>
            <Icon name="arrow.right" />
          </button>
        </div>
      {/if}
    {:else}
      <div class="bubble-menu">
        <div class="menu-section">
          <button
            class:active={isActive('bold')}
            on:click={() => $editor.chain().focus().toggleBold().run()}
            use:tooltip={{ text: `Bold (${isMac() ? '⌘' : 'ctrl'} + B)`, position: 'bottom' }}
          >
            <Icon name="bold" />
          </button>

          <button
            class:active={isActive('italic')}
            on:click={() => $editor.chain().focus().toggleItalic().run()}
            use:tooltip={{ text: `Italic (${isMac() ? '⌘' : 'ctrl'} + I)`, position: 'bottom' }}
          >
            <Icon name="italic" />
          </button>

          <button
            class:active={isActive('underline')}
            on:click={() => $editor.chain().focus().toggleUnderline().run()}
            use:tooltip={{ text: `Underline (${isMac() ? '⌘' : 'ctrl'} + U)`, position: 'bottom' }}
          >
            <Icon name="underline" size="20px" />
          </button>

          <button
            class:active={isActive('strike')}
            on:click={() => $editor.chain().focus().toggleStrike().run()}
            use:tooltip={{
              text: `Strike-through (${isMac() ? '⌘' : 'ctrl'} + Shift + S)`,
              position: 'bottom'
            }}
          >
            <Icon name="strike" />
          </button>

          <button
            class:active={isActive('code')}
            on:click={() => $editor.chain().focus().toggleCode().run()}
            use:tooltip={{ text: `Code`, position: 'bottom' }}
          >
            <Icon name="code" />
          </button>

          <button
            class:active={isActive('link')}
            on:click={handleLink}
            use:tooltip={{ text: `Link (${isMac() ? '⌘' : 'ctrl'} + K)`, position: 'bottom' }}
          >
            <Icon name="link" />
          </button>
        </div>

        {#if showRewrite || showSimilaritySearch}
          <div class="divider"></div>

          <div class="menu-section">
            {#if showRewrite}
              <button
                on:click={handleShowRewrite}
                id="editor-bubble-rewrite-btn"
                use:tooltip={{ text: `Rewrite`, position: 'bottom' }}
              >
                <Icon name="wand" size="17px" />
              </button>
            {/if}

            {#if showSimilaritySearch}
              <button
                on:click={() => handleFindSimilar()}
                id="editor-bubble-similarity-btn"
                use:tooltip={{ text: `Find Similar Resources`, position: 'bottom' }}
              >
                <Icon name="file-text-ai" size="17px" />
              </button>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</BubbleMenu>

<style lang="scss">
  .bubble-menu-wrapper {
    --color-menu: light-dark(#210e1f, #fff);
    --color-menu-muted: light-dark(#949494, #949494);
    --ctx-item-hover: #2497e9;

    background: light-dark(#fff, rgb(29 33 44));
    border-radius: 9px;
    border: 0.5px solid light-dark(rgba(0, 0, 0, 0.25), rgba(255, 255, 255, 0.15));
    box-shadow: 0 2px 10px light-dark(rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.5));
    user-select: none;
    font-size: 0.95em;
    position: relative;
    z-index: 10010;

    animation: scale-in 125ms cubic-bezier(0.19, 1, 0.22, 1);

    &::backdrop {
      background-color: rgba(0, 0, 0, 0);
    }
  }

  .bubble-menu {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem;
  }

  .loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.95em;
    color: var(--color-menu);
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
      color: var(--ctx-item-hover);
    }
  }

  input {
    width: 100%;
    background: none;
    padding: 0.25rem 0.5rem;
    outline: none;
    border: none;
    font-size: 0.95em;
    color: var(--color-menu);

    &::placeholder {
      color: var(--color-menu-muted);
    }
  }

  .input-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 335px; /* Set a fixed width for the bubble menu */
    max-height: 120px;
    padding: 0.25rem 0.5rem;
  }

  .link-menu {
    display: flex;
    flex-direction: column;
    padding: 0.25em;
    font-size: 1rem;
  }

  :global(.bubble-menu .editor-wrapper div.tiptap) {
    padding-bottom: 0 !important;
  }
</style>
