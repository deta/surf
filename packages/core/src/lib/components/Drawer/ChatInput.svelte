<script lang="ts">
  import { createEventDispatcher, onMount, getContext } from 'svelte'
  import { Icon } from '@horizon/icons'
  import { derived, writable, type Writable } from 'svelte/store'
  import { processDrop, type MediaParserResult } from '../../service/mediaImporter'

  import { parseMetadata, type ParsedMetadata } from '@horizon/core/src/lib/utils/parseMetadata'
  import {
    normalizeURL,
    optimisticCheckIfUrl,
    stringToURLList
  } from '@horizon/core/src/lib/utils/url'

  import { useLogScope } from '@horizon/core/src/lib/utils/log'
  import ChatLinkPreview from '@horizon/drawer/src/lib/components/ChatLinkPreview.svelte'
  import ChatFilePreview from '@horizon/drawer/src/lib/components/ChatFilePreview.svelte'
  import { Item } from '../../../../../cmdk-sv/dist/cmdk'

  export let droppedInputElements: Writable<MediaParserResult[]>
  export let forceOpen: boolean

  let inputRef: HTMLDivElement
  let textareaRef: HTMLTextAreaElement
  let isFocused = true
  let lastKeyDeleted = false
  let position = { x: 0, y: 0 }
  let opacity = 0
  let filesFromDialogue: FileList | null = null

  const viewState: any = getContext('drawer.viewState')
  const detectedInput = writable(false)
  const parsedURLs: Writable<ParsedMetadata[]> = writable([])
  const dispatch = createEventDispatcher()
  const dispatchDrop = createEventDispatcher<{ drop: DragEvent }>()
  const dispatchFileUpload = createEventDispatcher<{ fileUpload: FileList }>()
  const sendDisabled = writable(true)

  const dragOver = writable(false)
  const inputText = writable('')

  const droppedLinks = derived(droppedInputElements, (droppedInputElements) => {
    return droppedInputElements.filter((item) => item.type === 'url')
  })

  $: if ($inputText) {
    const searchQuery = { value: $inputText, tab: 'all' }

    if (!lastKeyDeleted) {
      handleChat(searchQuery)
    }
  }

  // The send button should be disabled if text, dropped items and links are empty
  $: {
    const isTextEmpty = $inputText === ''
    const areNoDroppedElements = $droppedInputElements.length === 0
    const areNoDroppedLinks = $parsedURLs.length === 0

    sendDisabled.set(isTextEmpty && areNoDroppedElements && areNoDroppedLinks)
  }

  const log = useLogScope('DrawerWrapper')

  onMount(() => {
    document.addEventListener('mousemove', handleMouseMove)

    // TODO: This is a temporary solution to handle dropped links, we need to refactor the entire chat input component
    const unsubscribe = droppedLinks.subscribe((items) => {
      items.forEach(async (item) => {
        const parsedMetadata = await parseMetadata((item.data as URL).href)
        parsedURLs.update((urls) => {
          if (
            urls.some(
              (parsedURL) => normalizeURL(parsedURL.url) === normalizeURL(parsedMetadata.url)
            )
          ) {
            log.debug(`URL already parsed: ${parsedMetadata.url}`)
            return urls
          } else {
            return [...urls, parsedMetadata]
          }
        })
      })

      if (items.length > 0) {
        droppedInputElements.update((droppedItems) => {
          return droppedItems.filter((item) => item.type !== 'url')
        })
      }
    })

    return () => {
      unsubscribe()
      document.removeEventListener('mousemove', handleMouseMove)
    }
  })

  const handleChat = async (e: any) => {
    const string = e.value
    const list = stringToURLList(string)

    if (!list || list.length === 0) {
      log.debug('No URLs found in chat input')
      return
    }

    for (const url of list) {
      parsedURLs.update((currentUrls) => {
        if (currentUrls.some((parsedURL) => normalizeURL(parsedURL.url) === normalizeURL(url))) {
          log.debug(`URL already parsed: ${url}`)
          return currentUrls
        } else {
          parseMetadata(url).then((metadata) => {
            parsedURLs.update((urls) => [...urls, metadata])
            console.log('URL', url)
            // Correctly remove the URL using the `update` method on the `inputText` store
            inputText.update((currentValue) => {
              return currentValue.replace(url, '')
            })
          })
          return currentUrls
        }
      })
    }

    if (list.length > 0) {
      detectedInput.set(true)
    }
  }

  const handleSend = () => {
    let result = { $inputText, $parsedURLs }
    dispatch('chatSend', result)

    textareaRef.blur()
    inputText.set('')
    parsedURLs.set([])
  }

  function handleMouseMove(event: MouseEvent) {
    if (!inputRef || isFocused) return

    const rect = inputRef.getBoundingClientRect()
    position.x = event.clientX - rect.left
    position.y = event.clientY - rect.top
    opacity = 1 // Ensure the spotlight effect is visible on mouse move
  }

  function handleFocus() {
    isFocused = true
    opacity = 1
    document.startViewTransition(async () => {
      viewState.set('chatInput')
    })
  }

  function handleMouseEnter() {
    opacity = 1
  }

  function handleMouseLeave() {
    if (!isFocused) {
      opacity = 0
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    e.stopPropagation()

    lastKeyDeleted = false
    if (e.key === 'Backspace' || e.key === 'Delete') {
      lastKeyDeleted = true
    } else if (e.key === 'Escape') {
      isFocused = false
      textareaRef.blur()
      document.startViewTransition(async () => {
        viewState.set('default')
      })
    }

    // Escape for line-break with shift enter
    if (e.key === 'Enter' && e.shiftKey) {
      return
    }

    if (e.key === 'Enter') {
      if (!$sendDisabled) {
        handleSend()
      }
    }
  }

  const handleDragEnter = (e: DragEvent) => {
    viewState.set('chatInput')
    e.preventDefault()
    e.stopPropagation()
    dragOver.set(true)
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    dragOver.set(false)
  }

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragOver.set(false)
    console.log('PROCESSEDDROP', e)
    dispatchDrop('drop', e)

    const parsed = await processDrop(e)
    const textItems = parsed.filter((item) => item.type === 'text')

    if (textItems.length > 0) {
      const textData = textItems[0].data as string
      if (textData && !optimisticCheckIfUrl(textData)) {
        const oldval = $inputText
        const newval = oldval + textData
        inputText.set(newval)
      }
    }

    // var textData = e.dataTransfer.getData('text')
    // if (textData && !optimisticCheckIfUrl(textData)) {
    //   console.log('textdata detected:', textData)
    //   var oldval = $inputText
    //   var newval = oldval + textData
    //   inputText.set(newval)
    // } else {
    //   dispatchDrop('drop', e)
    // }
  }

  function handleRemoveUploadItem(event: CustomEvent) {
    const id = Number(event.detail)
    console.log('ITEM TO DELETE', id)
    // Update the droppedInputElements store to remove the specified item
    droppedInputElements.update((items) =>
      items.filter((item) => Number(item.data.lastModified) !== id)
    )
  }

  function handleFileSelection(event: Event) {
    const inputElement = event.target as HTMLInputElement
    if (inputElement.files) {
      filesFromDialogue = inputElement.files

      // If you need to trigger any reactive statements or actions based on this new value, do so here
      console.log(filesFromDialogue)
      dispatchFileUpload('fileUpload', filesFromDialogue)
    }
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
<div
  class="chat-container"
  class:isFocussed={isFocused}
  on:dragenter={handleDragEnter}
  on:dragleave={handleDragLeave}
  on:drop={handleDrop}
  class:dragover={$dragOver}
>
  <div class="icon" class:hidden={$viewState === 'chatInput'}>
    <Icon name="add" color="#AAA7B1" size="28px" />
  </div>
  <div class="input-field-container" bind:this={inputRef} class:isFocussed={isFocused}>
    <textarea
      name="message"
      rows="1"
      placeholder="Save and drop everything..."
      class:active={$viewState == 'chatInput' || forceOpen}
      bind:this={textareaRef}
      on:focus={handleFocus}
      bind:value={$inputText}
      on:mouseenter={handleMouseEnter}
      on:mouseleave={handleMouseLeave}
      on:keydown={handleKeyDown}
    />
    <div
      class="spotlight"
      aria-hidden="true"
      style={`opacity: ${opacity}; --x: ${position.x}px; --y: ${position.y}px;`}
    ></div>

    {#if $parsedURLs && $parsedURLs.length > 0}
      <div class="link-list" class:hidden={!forceOpen && $viewState !== 'chatInput'}>
        {#each $parsedURLs as { url, linkMetadata, appInfo } (url)}
          <ChatLinkPreview metadata={linkMetadata} />
        {/each}
      </div>
    {/if}

    <div class="file-list" class:hidden={!forceOpen && $viewState !== 'chatInput'}>
      {#each $droppedInputElements.filter((item) => item.type === 'file') as file (file.data?.lastModified + file.data?.path)}
        <ChatFilePreview
          on:remove={handleRemoveUploadItem}
          metadata={file.metadata}
          data={file.data}
          id={file.data?.lastModified}
        />
      {/each}
    </div>

    <div class="toolbar-row">
      <div class="add-files" class:hidden={!forceOpen && $viewState !== 'chatInput'}>
        <input id="upload-files" multiple type="file" on:change={handleFileSelection} />
        <Icon name="add" color="#AAA7B1" size="28px" />
        <span class="label">Add files</span>
      </div>
    </div>
  </div>

  <div
    class="send-button"
    class:hidden={!forceOpen && $viewState !== 'chatInput'}
    class:disabled={$sendDisabled}
    on:click={handleSend}
  >
    <div class="arrow-wrapper">
      <Icon name="arrow" color="#353534" size="22px" />
    </div>
  </div>
</div>

<style lang="scss">
  :global(html)::view-transition-old(chat-field-container-transition),
  :global(html)::view-transition-new(chat-field-container-transition) {
    width: 100%;
    height: 100%;
  }
  .chat-container {
    position: relative;
    display: flex;
    align-items: center;
    font-size: 1.25rem;
    cursor: default;
    box-shadow:
      0px 1px 0px 0px rgba(65, 58, 86, 0.25),
      0px 0px 1px 0px rgba(0, 0, 0, 0.25);
    border-radius: 0.65rem;
    border: 1px solid #e5e5e5;
    background-color: #fff;
    view-transition-name: chat-field-container-transition;
    &.dragOver {
      display: none;
    }
  }
  .input-field-container {
    display: flex;
    flex-direction: column;
    flex: 1;
    position: relative;
    overflow: hidden;
    transition:
      border-color 0.3s,
      box-shadow 0.3s;
    z-index: 1000;
    opacity: 0;
    &.isFocussed {
      opacity: 1;
      // box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
    }

    .toolbar-row {
      .add-files {
        position: relative;
        display: flex;
        justify-content: start;
        align-items: center;
        transition: all 240ms ease-out;
        font-size: 1rem;
        font-weight: 400;
        gap: 0.25rem;
        color: #353534;
        padding: 0.5rem 0.75rem 0.5rem 0.5rem;
        opacity: 0.6;
        margin: 0.25rem;
        width: fit-content;
        border-radius: 6px;
        view-transition-name: add-files-transition;
        &:hover {
          background: rgba(61, 56, 78, 0.1);
        }
        #upload-files {
          position: absolute;
          width: 100%;
          height: 100%;
          opacity: 0;
          user-select: none;
        }
        .label {
          user-select: none;
        }
        &.hidden {
          transform: translateY(10%);
          opacity: 0;
          height: 0;
          padding: 0;
          margin: 0;
          transition: all 240ms ease-out;
        }
      }
    }
  }
  textarea {
    height: fit-content;
    width: 90%;
    height: 3.25rem;
    overflow: hidden;
    font-family:
      system-ui,
      -apple-system sans-serif;
    font-weight: 400;
    z-index: 1000;
    cursor: text;
    resize: none;
    font-size: 1.125rem;
    font-weight: 500;
    border: 0;
    border-radius: 0.65rem;
    color: #aeaeae;
    padding: 0.9rem 3rem 1rem 3rem;
    color: #353534;
    opacity: 0;
    transition: all 240ms ease-out;
    view-transition-name: chat-input-transition;
    cursor: default !important;
    user-select: none;
    &.active {
      opacity: 0.8;
      padding-left: 1rem;
      height: 5.5rem;
      width: 90% !important;
    }
  }
  textarea:focus {
    outline: none;
  }
  .icon {
    position: absolute;
    top: 0.6rem;
    left: 0.85rem;
    z-index: 5;
    transition: all 240ms ease-out;
    transform: translateX(0);
    view-transition-name: chat-icon-transition;
    &.hidden {
      transform: translateX(-100%);
      opacity: 0;
      transition: all 240ms ease-out;
    }
  }

  .send-button {
    position: absolute;
    top: 0.6rem;
    right: 0.75rem;
    width: 1.9rem;
    height: 1.9rem;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 5;
    transition: all 240ms ease-out;
    transform: translateX(0);
    border-radius: 4px;
    background: #c1efd9;
    padding-top: 2px;
    z-index: 10000;
    view-transition-name: send-button-transition;
    &.hidden {
      transform: translateX(-100%);
      opacity: 0;
      display: none;
      transition: all 240ms ease-out;
    }
    &.disabled {
      display: none;
    }
    .arrow-wrapper {
      opacity: 0.45;
    }
  }

  .spotlight {
    pointer-events: none;
    position: absolute;
    left: 0;
    top: 0;
    z-index: 10;
    height: 100%;
    width: 100%;
    cursor: default;
    border-radius: 0.65rem;
    transition: opacity 0.5s;
    border: 1px solid rgba(255, 255, 255, 0.75);
    background-color: transparent;
    mask-image: radial-gradient(circle at var(--x) var(--y), transparent, #000 70%);
  }

  .link-list,
  .file-list {
    width: 100%;
    &.hidden {
      transform: translateY(10%);
      opacity: 0;
      height: 0;
      padding: 0;
      margin: 0;
      transition: all 240ms ease-out;
    }
  }

  .link-list {
    view-transition-name: link-list-transition;
  }
  .file-list {
    view-transition-name: file-list-transition;
  }
</style>
