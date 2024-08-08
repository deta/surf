<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { writable, type Writable } from 'svelte/store'
  import { fly, slide } from 'svelte/transition'
  import { tooltip } from '@svelte-plugins/tooltips'

  import { Icon } from '@horizon/icons'
  import { ResourceTypes, type ResourceDataPost } from '@horizon/types'
  import { Editor, getEditorContentText } from '@horizon/editor'

  import type {
    AIChatMessageSource,
    AIChatMessageParsed,
    PageMagic,
    PageMagicResponse,
    PageHighlight,
    TabPage,
    AIChatMessageRole,
    Tab
  } from './types'
  import ChatMessage from './ChatMessage.svelte'
  import { useClipboard } from '../../utils/clipboard'
  import { useLogScope } from '../../utils/log'
  import { ResourceManager, useResourceManager, type ResourceLink } from '../../service/resources'
  import { getPrompt, PromptIDs } from '../../service/prompts'
  import { generateID } from '../../utils/id'
  import { parseChatResponseSources } from '../../service/ai'
  import { useToasts } from '../../service/toast'
  import { useDebounce } from '../../utils/debounce'

  export let inputValue = ''
  export let magicPage: Writable<PageMagic>
  export let tabsInContext: Tab[] = []

  const dispatch = createEventDispatcher<{
    highlightText: { tabId: string; text: string }
    highlightWebviewText: { resourceId: string; answerText: string; sourceUid?: string }
    seekToTimestamp: { resourceId: string; timestamp: number }
    navigate: { url: string }
    saveText: string
    updateActiveChatId: string
  }>()
  const log = useLogScope('MagicSidebar')
  const { copy, copied } = useClipboard()
  const resourceManager = useResourceManager()
  const toasts = useToasts()
  const telemetry = resourceManager.telemetry

  const savedResponse = writable(false)

  let listElem: HTMLDivElement
  let editorFocused = false
  let editor: Editor

  $: log.debug('Magic Page', $magicPage)
  $: log.debug('Magic Page Responses', $magicPage.responses)

  // const persistPageMagicChange = useDebounce(() => {
  //   log.debug('Persisting page magic change', $magicPage)
  //   dispatch('updateMagicPage', $magicPage)
  // }, 500)

  const updateMagicPage = (data: Partial<PageMagic>) => {
    if (data.chatId) {
      dispatch('updateActiveChatId', data.chatId)
    }

    magicPage.update((page) => {
      return {
        ...page,
        ...data
      }
    })
  }

  const addPageMagicResponse = (response: AIChatMessageParsed) => {
    magicPage.update((page) => {
      return {
        ...page,
        responses: [...page.responses, response]
      }
    })
  }

  const updatePageMagicResponse = (responseId: string, updates: Partial<AIChatMessageParsed>) => {
    magicPage.update((page) => {
      return {
        ...page,
        responses: page.responses.map((response) => {
          if (response.id === responseId) {
            return {
              ...response,
              ...updates
            }
          }
          return response
        })
      }
    })
  }

  const saveResponseOutput = async (response: AIChatMessageParsed) => {
    const div = document.createElement('div')
    div.innerHTML = response.content
    const text = div.textContent || div.innerText || ''

    dispatch('saveText', text)

    savedResponse.set(true)
    setTimeout(() => {
      savedResponse.set(false)
    }, 2000)
  }

  const populateRenderAndChunkIds = (sources: AIChatMessageSource[] | undefined) => {
    if (!sources) return
    sources.forEach((source, idx) => {
      source.render_id = (idx + 1).toString()
      source.all_chunk_ids = [source.id]
    })
    return sources
  }

  const handleCitationClick = async (
    sourceId: string,
    answerText: string,
    message: AIChatMessageParsed,
    sourceUid?: string
  ) => {
    log.debug('Citation clicked', sourceId, message)
    const source = (message.sources ?? []).find((s) => s.id === sourceId)
    if (!source) return

    const resource = await resourceManager.getResource(source.resource_id)
    if (!resource) return

    if (
      resource.type === ResourceTypes.LINK ||
      resource.type === ResourceTypes.ARTICLE ||
      resource.type.startsWith(ResourceTypes.POST)
    ) {
      if (resource.type === ResourceTypes.POST_YOUTUBE && source.metadata?.timestamp) {
        const timestamp = source.metadata.timestamp
        dispatch('seekToTimestamp', { resourceId: resource.id, timestamp: timestamp })

        await telemetry.trackPageChatCitationClick('timestamp')
      } else {
        dispatch('highlightWebviewText', {
          resourceId: resource.id,
          answerText: answerText,
          sourceUid: sourceUid
        })

        await telemetry.trackPageChatCitationClick('text')
      }
    }
  }

  const handleChatSubmit = async () => {
    if (!inputValue) {
      log.debug('No input value')
      return
    }

    // const text = getEditorContentText(inputValue)
    const savedInputValue = inputValue

    try {
      log.debug('Handling chat submit', savedInputValue)
      inputValue = ''
      editor.clear()
      editor.blur()

      await sendChatMessage(savedInputValue)
    } catch (e) {
      log.error('Error doing magic', e)
      inputValue = savedInputValue
      editor.setContent(savedInputValue)
    }
  }

  const runPrompt = async (promptType: PromptIDs) => {
    try {
      log.debug('Handling prompt submit', promptType)

      const prompt = await getPrompt(promptType)

      await sendChatMessage(prompt.content, 'assistant', prompt.title)
    } catch (e) {
      log.error('Error doing magic', e)
    }
  }

  const handleClearChat = async () => {
    log.debug('Clearing chat')

    if (!$magicPage.chatId) {
      log.error('No chat found to clear')
      return
    }

    await clearChat($magicPage.chatId)
  }

  const handleInputKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleChatSubmit()
    }
  }

  // HACK: Right now the saved chat doesn't store the query we provide, it only stores the raw message content. For system messages we don't want to display our long prompts.
  const sanitizeQuery = (raw: string) => {
    const query = raw.toLowerCase()
    if (query.includes('summary')) {
      return 'Page Summary'
    } else if (query.includes('table of content')) {
      return 'Table of Contents'
    } else if (query.includes('translate')) {
      return 'Translate Page'
    } else {
      return raw
    }
  }

  const sendChatMessage = async (
    prompt: string,
    role: AIChatMessageRole = 'user',
    query?: string
  ) => {
    const chatId = $magicPage.chatId
    if (!chatId) {
      log.error('Error: Existing chat not found')
      return
    }

    if (tabsInContext.length === 0) {
      log.debug('No tabs in context, general chat:')
    } else {
      log.debug('Tabs in context:', tabsInContext)
    }

    let response: AIChatMessageParsed | null = null

    try {
      const resourceIds: string[] = []
      for (const tab of tabsInContext) {
        if (tab.type === 'page' && tab.chatResourceBookmark) {
          resourceIds.push(tab.chatResourceBookmark)
        } else if (tab.type === 'space') {
          const spaceContents = await resourceManager.getSpaceContents(tab.spaceId)
          if (spaceContents) {
            resourceIds.push(...spaceContents.map((content) => content.resource_id))
          }
        }
      }

      response = {
        id: generateID(),
        role: role,
        query: query ?? prompt,
        status: 'pending',
        content: '',
        citations: {}
      } as AIChatMessageParsed

      updateMagicPage({ running: true })
      addPageMagicResponse(response)

      log.debug('calling the AI', prompt, resourceIds)
      let step = 'idle'
      let content = ''

      await resourceManager.sffs.sendAIChatMessage(
        chatId!,
        prompt,
        (chunk: string) => {
          if (step === 'idle') {
            log.debug('sources chunk', chunk)

            content += chunk

            if (content.includes('</sources>')) {
              const sources = parseChatResponseSources(content)
              log.debug('Sources', sources)

              step = 'sources'
              content = ''

              updatePageMagicResponse(response?.id ?? '', {
                sources
              })
            }
          } else {
            content += chunk
            updatePageMagicResponse(response?.id!, {
              content: content
                // .replace('<answer>', '')
                // .replace('</answer>', '')
                // .replace('<citation>', '')
                // .replace('</citation>', '')
                .replace('<br>', '\n')
            })
          }
        },
        {
          limit: 30,
          resourceIds: resourceIds,
          general: resourceIds.length === 0
        }
      )

      updatePageMagicResponse(response.id, { status: 'success', content: content })

      const previousMessages = $magicPage.responses.filter((message) => message.id !== response!.id)

      await telemetry.trackPageChatMessageSent(resourceIds.length, previousMessages.length)
    } catch (e) {
      log.error('Error doing magic', e)
      if (response) {
        updatePageMagicResponse(response.id, {
          content: (e as any).message ?? 'Failed to generate response.',
          status: 'error'
        })
      }

      throw e
    } finally {
      updateMagicPage({ running: false })
    }
  }

  const clearChat = async (id: string) => {
    const toast = toasts.loading('Clearing chat...')

    try {
      log.debug('Clearing chat', id)

      const messagesLength = $magicPage.responses.length

      $magicPage.responses = []

      await resourceManager.sffs.deleteAIChat(id)

      log.debug('Old chat deleted, creating new chat...')
      const newChatId = await resourceManager.sffs.createAIChat('')
      if (!newChatId) {
        log.error('Failed to create new chat aftering clearing the old one')
        return
      }

      updateMagicPage({
        chatId: newChatId,
        responses: []
      })

      toast.success('Chat cleared!')

      await telemetry.trackPageChatClear(messagesLength)
    } catch (e) {
      log.error('Error clearing chat:', e)
      toast.error('Failed to clear chat')
    }
  }

  const fetchExistingChat = async (id: string) => {
    const chat = await resourceManager.sffs.getAIChat(id)
    if (chat) {
      log.debug('Chat fetched', chat)
      const userMessages = chat.messages.filter((message) => message.role === 'user')
      const queries = userMessages.map((message) => message.content) // TODO: persist the query saved in the AIChatMessageParsed instead of using the actual content
      const systemMessages = chat.messages.filter((message) => message.role === 'assistant')

      log.debug('User messages', userMessages)
      log.debug('System messages', systemMessages)

      const responses = systemMessages.map((message, idx) => {
        message.sources = message.sources
        log.debug('Message', message)
        return {
          id: generateID(),
          role: 'user',
          query: queries[idx],
          content: message.content.replace('<answer>', '').replace('</answer>', ''),
          sources: message.sources,
          status: 'success'
        } as AIChatMessageParsed
      })

      updateMagicPage({
        responses
      })
    } else {
      log.error('Failed to fetch chat', id)
    }
  }

  const createNewChat = async () => {
    const chatId = await resourceManager.sffs.createAIChat('')
    if (!chatId) {
      log.error('Failed to create chat')
      return
    }

    log.debug('Chat created', chatId)

    updateMagicPage({ chatId })
  }

  onMount(async () => {
    log.debug('Magic Sidebar mounted', $magicPage.chatId)

    if ($magicPage.chatId) {
      log.debug('Existing chat found', $magicPage.chatId)
      await fetchExistingChat($magicPage.chatId)
    } else {
      log.debug('No existing chat found, creating new chat')
      await createNewChat()
    }
  })
</script>

<div class="flex flex-col gap-4 overflow-hidden p-4 h-full">
  <!-- <div class="header">
    <div class="title">
      <Icon name="message" size="28px" />
      <h1>Chat</h1>
    </div>
  </div> -->

  {#if !$magicPage.running && $magicPage.responses.length >= 1}
    <button on:click={handleClearChat} class="clear-btn">
      <Icon name="add" />
      New Chat
    </button>
  {/if}

  <div class="content" bind:this={listElem}>
    {#if $magicPage.responses.length > 0}
      {#each $magicPage.responses as response, idx (response.id)}
        {#if response.status === 'success'}
          <div class="output">
            <div class="output-header">
              <div class="input">
                <div class="icon">
                  {#if response.role === 'user'}
                    <Icon name="user" size="20px" />
                  {:else}
                    <Icon name="sparkles" size="20px" />
                  {/if}
                </div>
                <div class="query tiptap">
                  {#if response.role === 'user'}
                    {@html response.query}
                  {:else}
                    {sanitizeQuery(response.query)}
                  {/if}
                </div>
              </div>

              <div class="output-actions">
                <button
                  on:click={() => copy(response.content)}
                  use:tooltip={{
                    content: 'Copy to Clipboard',
                    action: 'hover',
                    position: 'left',
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
                  on:click={() => saveResponseOutput(response)}
                  use:tooltip={{
                    content: 'Save to Oasis',
                    action: 'hover',
                    position: 'left',
                    animation: 'fade',
                    delay: 500
                  }}
                >
                  {#if $savedResponse}
                    <Icon name="check" />
                  {:else}
                    <Icon name="leave" />
                  {/if}
                </button>
              </div>
            </div>

            <ChatMessage
              content={response.content}
              sources={populateRenderAndChunkIds(response.sources)}
              on:citationClick={(e) =>
                handleCitationClick(
                  e.detail.citationID,
                  e.detail.text,
                  response,
                  e.detail.sourceHash
                )}
              showSourcesAtEnd={true}
            />
          </div>
        {:else if response.status === 'pending'}
          <div class="output">
            <div class="output-header">
              <div class="input">
                <div class="icon">
                  <Icon name="spinner" />
                </div>
                <div class="tiptap query">{@html response.query}</div>
                <!-- {#if response.role === 'user'}
                  <p>{response.query}</p>
                {:else}
                  <p>Generating Page Summary…</p>
                {/if} -->
              </div>
            </div>

            <!-- {@html response.content} -->

            {#if response.content}
              <ChatMessage
                content={response.content}
                sources={populateRenderAndChunkIds(response.sources)}
                on:citationClick={(e) =>
                  handleCitationClick(
                    e.detail.citationID,
                    e.detail.text,
                    response,
                    e.detail.sourceUid
                  )}
                showSourcesAtEnd={true}
              />
            {/if}
          </div>
        {:else if response.status === 'error'}
          <div class="output">
            {response.content}
          </div>
        {/if}
      {/each}
    {:else}
      <div class="empty">
        <div class="empty-title">
          <Icon name="message" />
          <h1>New Chat</h1>
        </div>
        <p>
          Chat with your tabs to ask questions and more. <br />Drag tabs in and out of the context
          in the left sidebar.
        </p>
      </div>
    {/if}
  </div>

  <!--
  {#if !magicPage.running}
    <div class="prompts" transition:fly={{ y: 120 }}>
      <button on:click={() => runPrompt(PromptIDs.PAGE_SUMMARIZER)}>
        Summarize Page
      </button>
      <button on:click={() => runPrompt(PromptIDs.PAGE_TOC)}> Table of Contents </button>
      <button on:click={() => runPrompt(PromptIDs.PAGE_TRANSLATOR)}>
        Translate Page
      </button>
    </div>
  {/if}
  -->

  {#if $magicPage.initializing}
    <div class="info-box">
      <Icon name="spinner" />
      <p>Preparing tabs for the chat…</p>
    </div>
  {/if}

  <form on:submit|preventDefault={handleChatSubmit} class="chat">
    <!-- <input bind:value={inputValue} placeholder="Ask your tabs…" /> -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="editor-wrapper" on:keydown={handleInputKeydown}>
      <Editor
        bind:this={editor}
        bind:content={inputValue}
        bind:focused={editorFocused}
        autofocus={false}
        placeholder="Chat with your tabs…"
      />
    </div>

    <!-- {#if !magicPage.running && magicPage.responses.length >= 1}
      <button on:click={handleClearChat} class="secondary">
        <Icon name="trash" />
      </button>
    {/if} -->

    <!-- <button disabled={$magicPage.responses.length > 1 && $magicPage.running} class="" type="submit">
      {#if $magicPage.responses.length > 1 && $magicPage.running}
        <Icon name="spinner" />
      {:else}
        <Icon name="arrow.right" />
      {/if}
    </button> -->

    {#if (inputValue && inputValue !== '<p></p>') || editorFocused}
      <button
        type="submit"
        transition:slide={{ duration: 150 }}
        disabled={($magicPage.responses.length > 1 && $magicPage.running) ||
          inputValue === '<p></p>'}
        class:filled={inputValue && inputValue !== '<p></p>'}
      >
        {#if $magicPage.responses.length > 1 && $magicPage.running}
          <div>Generating…</div>
          <Icon name="spinner" />
        {:else}
          <div>Ask Tabs</div>
          <Icon name="arrow.right" />
        {/if}
      </button>
    {/if}
  </form>
</div>

<style lang="scss">
  .content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    flex: 1;
    overflow: auto;
    padding-bottom: 4rem;
  }

  .chat {
    padding: 0.5rem;
    flex-shrink: 0;
    border-top: 1px solid #e0e0e0;
    display: flex;
    flex-direction: column;
    padding: 1rem 0;
    font-family: inherit;

    .editor-wrapper {
      flex: 1;
      background: #fff;
      border: 1px solid #eeece0;
      border-radius: 12px;
      padding: 0.75rem;
      font-size: 1rem;
      font-family: inherit;
      resize: vertical;
      min-height: 80px;
    }

    button {
      appearance: none;
      padding: 0.75rem;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: background-color 0.2s;
      height: min-content;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      background: #fd1bdf40;
      color: white;
      margin-top: 1rem;

      div {
        font-size: 1rem;
      }

      &:hover {
        background: #fd1bdf69;
      }

      &.filled {
        background: #f73b95;

        &:hover {
          background: #f92d90;
        }
      }

      &:active {
        background: #f73b95;
      }
    }
  }

  // .chat button {
  //   appearance: none;
  //   border: none;
  //   background: #f73b95;
  //   color: #fff;
  //   border-radius: 8px;
  //   padding: 0;
  //   width: 40px;
  //   height: 40px;
  //   display: flex;
  //   align-items: center;
  //   justify-content: center;
  //   cursor: pointer;
  //   flex-shrink: 0;

  //   // secondary styles
  //   &.secondary {
  //     background: #fff;
  //     color: #f73b95;
  //   }
  // }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .title {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #2b2715;
    white-space: nowrap;

    h1 {
      font-size: 1.5rem;
      font-weight: 500;
    }
  }

  .status {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
    border-radius: 8px;
    color: #3f3f3f;

    p {
      flex: 1;
      font-size: 1rem;
      font-weight: 500;
      color: #3f3f3f;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .output-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .input {
    display: flex;
    align-items: center;
    gap: 10px;
    overflow: hidden;
    opacity: 0.75;
  }

  .icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .query {
    flex: 1;
    // truncate with ellipses after two lines
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .output-actions {
    display: flex;
    align-items: center;
    gap: 10px;

    button {
      appearance: none;
      border: none;
      background: none;
      cursor: pointer;
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s ease;

      &:hover {
        opacity: 1 !important;
      }
    }
  }

  .output {
    padding: 15px;
    background: rgb(255, 255, 255);
    border-radius: 8px;
    font-size: 1.1rem;
    color: #3f3f3f;
    display: flex;
    flex-direction: column;
    gap: 10px;

    &:hover .output-actions button {
      opacity: 0.5;
    }
  }

  .output-status {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  input {
    width: 100%;
    padding: 10px;
    border: 1px solid transparent;
    border-radius: 5px;
    font-size: 1rem;
    background-color: #fff;
    color: #3f3f3f;

    &:hover {
      background: #eeece0;
    }

    &:focus {
      outline: none;
      border-color: #f73b95;
      color: #000;
      background-color: #ffffff;
    }
  }

  .prompts {
    position: absolute;
    bottom: 4.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    width: 100%;
    padding: 15px 0;
    overflow-x: auto;
    // linear gradient from bottom background color to transparent top
    background: linear-gradient(180deg, transparent, #eeece0);

    button {
      flex-shrink: 0;
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      background: #fff;
      color: #353535;
      cursor: pointer;
      font-size: 1rem;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
      transition: background 0.2s;

      &:hover {
        background: #f6f5ef;
      }
    }
  }

  .clear-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: auto;
    border: none;
    background: none;
    color: #616179;
    cursor: pointer;
    font-size: 1rem;

    &:hover {
      color: #2b2b3d;
    }
  }

  .empty {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    opacity: 0.75;
    transition: opacity 0.2s ease;

    .empty-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;

      h1 {
        font-size: 1.25rem;
        font-weight: 500;
      }
    }

    p {
      font-size: 1rem;
      color: #666;
      text-align: center;
    }
  }

  .info-box {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    border-radius: 8px;
    background: #ffffff;
    color: #3f3f3f;
    font-size: 1rem;
    opacity: 0.75;
  }

  :global(.chat-message-content h2) {
    font-size: 1.4rem;
    margin-top: 0.5rem !important;
    margin-bottom: 0.5rem !important;
  }
</style>
