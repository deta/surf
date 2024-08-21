<script lang="ts" context="module">
  export type NavigateEvent = { url: string; active: boolean }
  export type UpdateTab = Partial<TabChat>

  // TODO: unique sources should not lose the original source id information
  // TODO: why mix of camelCase and snake_case?
  export function getUniqueSources(sources: AIChatMessageSource[] | undefined) {
    if (!sources) return []
    let urls = {} as Record<string, string>
    let chunk_ids = {} as Record<string, string[]>
    sources.forEach((source) => {
      if (source.metadata && source.metadata.url) {
        urls[source.resource_id] = source.metadata.url
      }
      if (source.resource_id in chunk_ids) {
        chunk_ids[source.resource_id].push(source.id)
      } else {
        chunk_ids[source.resource_id] = [source.id]
      }
    })
    let uniqueSources = sources.filter(
      (source, index, self) =>
        index ===
        self.findIndex((s) => {
          if (source.metadata && s.metadata) {
            return (
              source.resource_id === s.resource_id &&
              source.metadata.timestamp === s.metadata.timestamp
            )
          }
          s.resource_id === source.resource_id
        })
    )
    let render_id = 1
    uniqueSources.forEach((source, index) => {
      if (index != 0) {
        let prevSource = uniqueSources[index - 1]
        if (prevSource.resource_id !== source.resource_id) {
          render_id += 1
        }
      }
      source.render_id = render_id.toString()
      source.all_chunk_ids = chunk_ids[source.resource_id]
      if (source.resource_id in urls) {
        if (source.metadata) {
          source.metadata.url = urls[source.resource_id]
        } else {
          source.metadata = { url: urls[source.resource_id] }
        }
      }
    })
    return uniqueSources
  }
</script>

<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { writable, derived, get } from 'svelte/store'

  import type { ResourceLink, ResourceManager } from '../../service/resources'
  import { useLogScope, generateID } from '@horizon/utils'
  import type {
    AIChat,
    AIChatMessageParsed,
    AIChatMessageSource,
    TabChat
  } from '../../types/browser.types'
  import { parseChatResponseSources } from '../../service/ai'
  import { SFFS } from '../../service/sffs'
  import ChatResponseSource from './ChatResponseSource.svelte'
  import { Icon } from '@horizon/icons'
  import ChatMessage from './ChatMessage.svelte'
  import { oasisAPIEndpoint } from '../Browser/BrowserHomescreen.svelte'
  import { ResourceTypes, type ResourceDataPost } from '../../types'

  export let tab: TabChat
  export let resourceManager: ResourceManager
  export let resourceIds: string[]

  const log = useLogScope('Chat')
  const dispatch = createEventDispatcher<{
    navigate: NavigateEvent
    updateTab: UpdateTab
    openResource: string
  }>()

  const sffs = new SFFS()

  const messages = writable<AIChatMessageParsed[]>([])
  const isHeaderVisible = writable(false)
  const hoveredSource = writable<{
    sourceId: string
    messageId: string
    resourceId: string
  } | null>(null)

  const activeMessage = derived(messages, ($messages) => $messages[$messages.length - 1])

  let chat: AIChat
  let loadingResponse = false
  let queryElement: HTMLElement
  let followUpValue = ''
  let searchSourceLimit = 10
  let defaultSearchSourceSet = true
  let confirmedSearchSourceLimit = 10

  $: sliderChanged(), confirmedSearchSourceLimit

  $: query = tab.query
  $: log.debug('activeMessage', $activeMessage)

  function updateActiveMessage(updates: Partial<AIChatMessageParsed>) {
    messages.update((messages) => {
      messages[messages.length - 1] = { ...messages[messages.length - 1], ...updates }
      return messages
    })
  }

  function sliderChanged() {
    if (defaultSearchSourceSet) {
      return
    }
    messages.set([])
    sendChatMessage(query)
  }

  function handleSliderConfirm() {
    defaultSearchSourceSet = false
    confirmedSearchSourceLimit = searchSourceLimit
  }

  async function getResource(id: string) {
    const resource = await resourceManager.getResource(id)
    log.debug('Resource', resource)

    return resource
  }

  /**
   * Open the resource with the given ID in the drawer / oasis
   */
  function openResource(id: string) {
    dispatch('openResource', id)
  }

  /**
   * Create a new tab with the given URL
   */
  function navigate(url: string, active = true) {
    dispatch('navigate', { url, active: active })
  }

  async function sendChatMessage(query: string) {
    const message = {
      id: generateID(),
      role: 'system',
      content: '',
      query: query,
      contentItems: [],
      sources: []
    } as AIChatMessageParsed

    messages.update((messages) => [...messages, message])

    let step = 'idle'
    let content = ''

    loadingResponse = true

    const response = await sffs.sendAIChatMessage(
      chat.id,
      query,
      (chunk: string) => {
        if (step === 'idle') {
          log.debug('sources chunk', chunk)

          content += chunk

          if (content.includes('</sources>')) {
            const sources = parseChatResponseSources(content)
            log.debug('Sources', sources)

            step = 'sources'
            content = ''

            updateActiveMessage({
              sources
            })
          }
        } else {
          content += chunk

          updateActiveMessage({
            content: content
              .replace('<answer>', '')
              .replace('</answer>', '')
              .replace('<citation>', '')
              .replace('</citation>', '')
              .replace('<br>', '\n')
          })
        }
      },
      { limit: confirmedSearchSourceLimit, resourceIds, ragOnly: tab.ragOnly }
    )

    log.debug('response is done', response, content)
    // const parsed = parseChatResponseContent(content)
    // log.debug('parsed', parsed)

    updateActiveMessage({
      content: content.replace('<answer>', '').replace('</answer>', '')
      // contentItems: parsed.contentItems
    })

    log.debug('message parsed', $activeMessage)
    loadingResponse = false
  }

  async function createNewChat() {
    const chatId = await sffs.createAIChat('')

    const apiEndpoint: string = get(oasisAPIEndpoint)

    log.debug('Created new chat', chatId)
    log.debug('API endpoint', apiEndpoint)

    tab.chatId = chatId
    dispatch('updateTab', { chatId, apiEndpoint })

    chat = { id: chatId, messages: [] }

    sendChatMessage(query)
  }

  async function loadExistingChat(chatId: string) {
    const storedChat = await sffs.getAIChat(chatId)
    if (!storedChat) {
      log.error('Chat not found', chatId)
      return
    }

    log.debug('Chat', storedChat)
    chat = storedChat

    const queries = chat.messages
      .filter((message) => message.role === 'user')
      .map((message) => message.content)

    $messages = chat.messages
      .filter((message) => message.role === 'assistant')
      .map((message, idx) => {
        log.debug('Message', message)
        // const parsed = parseChatResponseContent(message.content)
        return {
          id: generateID(),
          role: message.role,
          query: queries[idx],
          content: message.content.replace('<answer>', '').replace('</answer>', ''),
          // contentItems: parsed.contentItems,
          sources: message.sources
        }
      })
  }

  function handleResourceClick(e: CustomEvent<string>) {
    openResource(e.detail)
  }

  async function handleCitationClick(sourceId: string, message: AIChatMessageParsed) {
    log.debug('Citation clicked', sourceId, message)

    const source = (message.sources ?? []).find((s) => s.id === sourceId)
    if (!source) return

    const resource = await getResource(source.resource_id)
    if (!resource) return

    if (
      resource.type === ResourceTypes.LINK ||
      resource.type === ResourceTypes.ARTICLE ||
      resource.type.startsWith(ResourceTypes.POST)
    ) {
      const data = await (resource as ResourceLink).getParsedData()

      if (resource.type === ResourceTypes.POST_YOUTUBE && source.metadata?.timestamp) {
        const timestamp = source.metadata.timestamp
        const url = `https://www.youtube.com/watch?v=${(data as any as ResourceDataPost).post_id}&t=${timestamp}s&autoplay=1`
        navigate(url)
      } else {
        navigate(data.url)
      }
    } else {
      openResource(source.resource_id)
    }
  }

  function handleCitationHoverStart(sourceId: string, message: AIChatMessageParsed) {
    log.debug('Citation hovered', sourceId, message)

    const source = (message.sources ?? []).find((s) => s.id === sourceId)
    log.debug('Source', source)
    if (source) {
      $hoveredSource = { sourceId, messageId: message.id, resourceId: source.resource_id }
    }
  }

  function handleCitationHoverEnd(sourceId: string, message: AIChatMessageParsed) {
    log.debug('Citation hover end', sourceId, message)

    $hoveredSource = null
  }

  function getUniqueSourcesByResourceID(sources: AIChatMessageSource[]) {
    let uniqueSources = sources.filter(
      (source, index, self) => index === self.findIndex((s) => s.resource_id === source.resource_id)
    )
    uniqueSources.forEach((source, index) => {
      source.render_id = (index + 1).toString()
    })
    return uniqueSources
  }

  const handleSendMessage = () => {
    if (!followUpValue) return
    sendChatMessage(followUpValue)
    followUpValue = ''
  }

  onMount(() => {
    const chatId = tab.chatId

    if (!chatId) {
      log.debug('No existing chat, creating new one', tab)
      createNewChat()
    } else {
      log.debug('Loading existing chat', chatId)
      loadExistingChat(chatId)
    }

    // Observer to check if the header should be visible
    const observer = new IntersectionObserver(
      ([entry]) => {
        isHeaderVisible.set(!entry.isIntersecting)
      },
      {
        threshold: 0.1
      }
    )

    if (queryElement) {
      observer.observe(queryElement)
    }

    return () => {
      observer.disconnect()
    }
  })
</script>

<div class="scroll-container">
  {#if $isHeaderVisible}
    <div class="fixed-header">
      <h1>{query}</h1>
    </div>
  {/if}
  {resourceIds}
  <div class="chat-wrapper">
    <div class="chat">
      <h1 class="chat-request" bind:this={queryElement}>{query}</h1>
      <div class="slider-container">
        <h2>Number of chunks:</h2>
        <br />
        <input type="range" min="5" max="100" bind:value={searchSourceLimit} class="slider" />
        <br />
        <span>{searchSourceLimit}</span>
        <br />
        <button on:click={handleSliderConfirm}>Search</button>
      </div>
      <div class="messages">
        {#each $messages as message, idx}
          {#if idx !== 0}
            <h2 class="chat-request chat-request-followup">{message.query}</h2>
          {/if}
          <div class="chat-result">
            {#if message.sources}
              <div class="resources">
                {#each getUniqueSourcesByResourceID(message.sources) as source (source.id)}
                  <div
                    class="resource-list-item"
                    class:active={$hoveredSource &&
                      $hoveredSource.messageId === message.id &&
                      $hoveredSource.resourceId === source.resource_id}
                  >
                    <ChatResponseSource {source} {resourceManager} on:click={handleResourceClick} />
                  </div>
                {/each}
              </div>
            {/if}

            <div class="message message-content">
              {#if message.content}
                <ChatMessage
                  content={message.content}
                  sources={getUniqueSources(message.sources)}
                  on:citationClick={(e) => handleCitationClick(e.detail, message)}
                  on:citationHoverStart={(e) => handleCitationHoverStart(e.detail, message)}
                  on:citationHoverEnd={(e) => handleCitationHoverEnd(e.detail, message)}
                />
              {:else}
                <div class="chat-status">
                  <Icon name="spinner" size="30px" />
                  <h3 class="chat-memory">
                    {#if !tab.ragOnly}
                      Asking Your Stuff
                    {:else}
                      Searching…
                    {/if}
                  </h3>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>

      <!-- {#if $activeMessage}
        <div class="chat-result">
          {#if $activeMessage.sources}
            <div class="resources">
              {#each $activeMessage.sources as source}
                <div class="resource-list-item">
                  <ChatResponseSource {source} {resourceManager} />
                </div>
              {/each}
            </div>
          {/if}

          <div class="message message-content">
            {#if $activeMessage.content}
              <ChatMessage message={$activeMessage} on:citationClick={(e) => handleCitationClick(e.detail, $activeMessage)} />
            {:else}
              <div class="chat-status">
                <Icon name="spinner" size="35px" />
                <h3 class="chat-memory">Asking Oasis AI…</h3>
              </div>
            {/if}
          </div>
        </div>
      {:else if loadingResponse}
        <div class="chat-status">
          <Icon name="spinner" />
          <h3 class="chat-memory">Loading...</h3>
        </div>
      {:else}
        <div class="chat-status">
          <h3 class="chat-memory">No memory found</h3>
        </div>
      {/if} -->
    </div>
  </div>

  {#if !($messages.length === 1 && loadingResponse)}
    <div class="question-box-wrapper">
      <form class="question-box" on:submit|preventDefault={handleSendMessage}>
        <input type="text" placeholder="Ask follow-up question" bind:value={followUpValue} />
        <button class="action-btn" type="submit" disabled={loadingResponse}>
          {#if loadingResponse}
            <Icon name="spinner" size="25px" />
          {:else}
            <Icon name="arrow.right" size="25px" />
          {/if}
        </button>
      </form>
    </div>
  {/if}
</div>

<style lang="scss">
  .scroll-container {
    width: 100%;
    height: 100%;
    overflow-y: scroll;
  }

  .fixed-header {
    position: sticky;
    top: 0;
    left: 0;
    right: 0;
    background-color: rgba(255, 255, 255, 0.65);
    backdrop-filter: blur(36px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    z-index: 10;
    padding: 1rem;
    text-align: center;
  }

  .chat-wrapper {
    position: relative;
    top: 0;
    min-height: 100%;
    width: 100%;
    padding: 16rem 4rem;
    background: #fff8fe;
  }

  .chat {
    display: flex;
    flex-direction: column;
    gap: 4rem;
    margin: 0 auto;
    max-width: 1200px;
  }

  .question-box-wrapper {
    position: absolute;
    bottom: 1rem;
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .question-box {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.25rem;
    background: #fff;
    border: 1px solid #ccc;
    border-radius: 8px;
    max-width: 640px;
    width: 100%;

    input {
      font-size: 1rem;
      width: 100%;
      background: none;
      border: none;
      outline: none;
      padding: 0 1rem;
    }

    button {
      background-color: rgb(253, 133, 181);
      color: white;
      appearance: none;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem;
    }
  }

  .action-btn {
    padding: 10px 20px;
    background-color: #3c3c3c;
    color: white;
    appearance: none;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 1rem;
  }

  .chat-status {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 1.5rem;
    color: #912c74;
  }

  .chat-request,
  .message.user,
  .fixed-header > h1 {
    font-family: 'Gambarino';
    color: #5b6882;
    font-size: 3rem;
    line-height: 1.2;
    margin-bottom: 1.5rem;
    background: linear-gradient(0deg, #bb00bf -39%, #ef00f8 100%);

    background: linear-gradient(
      0deg,
      color(display-p3 0.67 0.057 0.7233) -39%,
      color(display-p3 0.8556 0.0351 0.9404) 100%
    );
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    max-width: 640px;
    margin: 0 auto;
  }

  .chat-request-followup {
    font-size: 2.5rem;
    margin-top: 4rem;
  }

  .fixed-header > h1 {
    font-size: 1.75rem;
  }

  .chat-memory {
    color: #912c74;
    font-size: 1.5rem;
    line-height: 150%;
  }

  .chat-result {
    .message {
      color: rgba(70, 2, 51, 0.7);
      font-size: 1.5rem;
      letter-spacing: 0.01em;
      margin-bottom: 1.5rem;
      line-height: 1.45;
      max-width: 640px;
      margin: 0 auto;
      &.user {
        font-weight: 600;
        line-height: 1.2;
        padding: 4rem 0;
      }
    }

    .resources {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 3rem;
      margin: 4rem 0;

      .resource-list-item {
        max-width: 350px;
        transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);

        &.active {
          transform: scale(1.1);
        }
      }
    }

    .resource-content {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .citation-item {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.75rem;
      height: 1.75rem;
      font-size: 1rem;
      background: rgb(255, 164, 164);
      border-radius: 100%;
      user-select: none;
      cursor: pointer;
    }

    .resource-item {
      height: 32rem;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: 0.65s cubic-bezier(0.34, 1.56, 0.64, 1);
      background: #fff;
      box-shadow:
        0px 0px 0.467px 0px rgba(0, 0, 0, 0.18),
        0px 0.933px 2.8px 0px rgba(0, 0, 0, 0.1),
        0px 2.8px 7.467px 0px rgba(0, 0, 0, 0.1);
      &:hover {
        &::after {
          content: 'Open';
          position: absolute;
          bottom: 1rem;
          right: 1rem;
          height: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 1rem 0.05rem 1rem;
          width: fit-content;
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.1);
        }
      }

      .title,
      .author,
      .excerpt {
        letter-spacing: 0.025em;
      }

      .title {
        font-size: 2rem;
        font-weight: 500;
      }

      .author {
        font-size: 1rem;
        font-weight: 400;
      }

      .excerpt {
        font-size: 1.25rem;
        padding-top: 0.75rem;
        line-height: 140%;
        font-weight: 400;
      }
    }

    .PDF {
      color: #fff;
      border-radius: 4px 12px 12px 4px;
      padding: 2rem 4rem;
      background: linear-gradient(
          90deg,
          rgba(255, 255, 255, 0.2) 0%,
          rgba(255, 255, 255, 0.17) 11.8%,
          rgba(255, 255, 255, 0.2) 12.59%
        ),
        linear-gradient(
          180deg,
          var(--resource-color, #2c2c2c) 77.85%,
          var(--resource-color, #2c2c2c) 100%
        );
      background-blend-mode: screen;
    }

    .Note,
    .Article {
      padding: 2rem;
    }

    .Article {
      background-image: var(--backgroundImage);
      background-size: cover;
    }
  }

  .further-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 4rem;
  }

  :global(.message-content) {
    font-size: 1.5rem;
    line-height: 1.45;
    font-family: inherit;
    color: rgba(70, 2, 51, 0.7);
    margin-bottom: 1.5rem;
    max-width: 640px;
    margin: 0 auto;

    li {
      margin-bottom: 0.5rem;
      display: block;
    }
  }

  :global(.message-content li) {
    margin-top: 1rem;
    margin-bottom: 1rem;
    display: block;
  }

  .slider {
    width: 300px;
  }

  .slider-container {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
  }

  .slider-container button {
    padding: 0.5rem 1rem;
    background: #f73b95;
    color: #fff;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
  }
</style>
