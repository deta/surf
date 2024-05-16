<script lang="ts" context="module">
  export type NavigateEvent = { url: string; active: boolean }
  export type UpdateTab = Partial<TabChat>
</script>

<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  import { writable, derived } from 'svelte/store'
  import type { Drawer } from '@horizon/drawer'

  import type { ResourceManager } from '../../service/resources'
  import { useLogScope } from '../../utils/log'
  import type {
    AIChat,
    AIChatMessage,
    AIChatMessageParsed,
    AIChatMessageSource,
    TabChat
  } from './types'
  import type { HorizonDatabase } from '../../service/storage'
  import { getChatData, getResourceByIDs } from './examples'
  import {
    DUMMY_CHAT_RESPONSE,
    parseChatResponse,
    parseChatResponseContent,
    parseChatResponseSources
  } from '../../service/ai'
  import { generateID } from '../../utils/id'
  import { SFFS } from '../../service/sffs'
  import ChatResponseSource from './ChatResponseSource.svelte'
  import { Icon } from '@horizon/icons'

  export let tab: TabChat
  export let resourceManager: ResourceManager
  export let drawer: Drawer
  export let db: HorizonDatabase

  const log = useLogScope('Chat')
  const dispatch = createEventDispatcher<{ navigate: NavigateEvent; updateTab: UpdateTab }>()

  const sffs = new SFFS()

  const messages = writable<AIChatMessageParsed[]>([])
  const isHeaderVisible = writable(false)

  const activeMessage = derived(messages, ($messages) => $messages[$messages.length - 1])

  let chat: AIChat
  let loadingResponse = false
  let queryElement: HTMLElement

  $: query = tab.query
  $: log.debug('activeMessage', $activeMessage)

  function updateActiveMessage(updates: Partial<AIChatMessageParsed>) {
    messages.update((messages) => {
      messages[messages.length - 1] = { ...messages[messages.length - 1], ...updates }
      return messages
    })
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
    drawer.openItem(id)
  }

  /**
   * Create a new tab with the given URL
   */
  function navigate(url: string, active = true) {
    dispatch('navigate', { url, active: active })
  }

  async function parseAIChatResponse() {
    const response = DUMMY_CHAT_RESPONSE
    log.debug('Response', response)

    const parsed = parseChatResponse(response)
    log.debug('Parsed', parsed)

    if (!parsed.complete) {
      log.debug('Incomplete response', parsed)
      return
    }

    const message = {
      id: generateID(),
      role: 'assistant',
      content: parsed.content,
      contentItems: parsed.contentItems,
      sources: parsed.sources,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    }

    // log.debug('New message', message)

    // messages = [...messages, message]
  }

  async function sendChatMessage(query: string) {
    const message = {
      id: generateID(),
      role: 'system',
      content: '',
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
          const sources = parseChatResponseSources(chunk).filter(
            (source, index, self) =>
              index === self.findIndex((s) => s.resource_id === source.resource_id)
          )

          log.debug('Sources', sources)

          step = 'sources'

          updateActiveMessage({
            sources
          })
        } else {
          log.debug('content chunk', chunk)
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
      { limit: 10 }
    )

    log.debug('response is done', response)
    const parsed = parseChatResponseContent(content)
    log.debug('parsed', parsed)

    updateActiveMessage({
      content: parsed.content ?? content,
      contentItems: parsed.contentItems
    })

    log.debug('message parsed', $activeMessage)
    loadingResponse = false
  }

  async function createNewChat() {
    const chatId = await sffs.createAIChat('')

    log.debug('Created new chat', chatId)

    tab.chatId = chatId
    dispatch('updateTab', { chatId })

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

    $messages = chat.messages
      .filter((message) => message.role === 'system')
      .map((message) => {
        const parsed = parseChatResponseContent(message.content)
        return {
          id: generateID(),
          role: message.role,
          content: parsed.content ?? message.content,
          contentItems: parsed.contentItems,
          sources: (message.sources ?? []).filter(
            (source, index, self) =>
              index === self.findIndex((s) => s.resource_id === source.resource_id)
          )
        }
      })
  }

  function handleMouseMove(event: MouseEvent) {
    const target = event.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const deltaX = (x - centerX) * 0.1
    const deltaY = (y - centerY) * 0.1
    target.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(1.02)`
    console.log(target)
  }

  function handleMouseLeave(event: MouseEvent) {
    const target = event.currentTarget as HTMLElement
    target.style.transform = 'translate(0, 0) scale(1.00)'
  }

  async function handleCitationClick(
    e: MouseEvent,
    sourceId: string,
    message: AIChatMessageParsed
  ) {
    log.debug('Citation clicked', sourceId)

    const source = (message.sources ?? []).find((s) => s.id === sourceId)

    if (source) {
      openResource(source.resource_id)
    }
  }

  onMount(() => {
    const chatId = tab.chatId

    if (!chatId) {
      log.debug('No existing chat, creating new one', tab)
      createNewChat()
    } else {
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
  <div class="chat-wrapper">
    <div class="chat">
      <h1 class="chat-request" bind:this={queryElement}>{query}</h1>

      {#if $activeMessage}
        <div class="chat-result">
          <!-- <h3 class="chat-memory">From your Memory</h3> -->

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
            {#if $activeMessage.contentItems && $activeMessage.contentItems.length > 0}
              {@const citationItems = $activeMessage.contentItems.filter(
                (i) => i.type === 'citation'
              )}
              {#each $activeMessage.contentItems as item}
                {#if item.type === 'text'}
                  {@html item.content}
                {:else}
                  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                  <span
                    on:click={(e) => handleCitationClick(e, item.content, $activeMessage)}
                    class="citation-item"
                  >
                    {citationItems.findIndex((i) => i.content === item.content) + 1}
                  </span>
                {/if}
              {/each}
            {:else if $activeMessage.content}
              {@html $activeMessage.content}
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
      {/if}
    </div>

    <!-- {#if $messages.length > 0}
        <div class="chat-result">
          <h3 class="chat-memory">From your Memory</h3>

          {#each $messages as message (message.id)}
            {#if message.sources}
              <div class="resources">
                {#each message.sources as source}
                  <ChatResponseSource source={source} resourceManager={resourceManager} />
                {/each}
              </div>
            {/if}

            {#if message.role === 'user'}
              <div class="message user" bind:this={queryElement}>
                <h2>{@html message.content}</h2>
              </div>
            {:else}
              <div class="message">
                {#if message.contentItems}
                  {@const citationItems = message.contentItems.filter((i) => i.type === 'citation')}
                  {#each message.contentItems as item}
                    {#if item.type === 'text'}
                      {item.content}
                    {:else}
                      <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions
                      <span
                        on:click={(e) => handleCitationClick(e, item.content, message)}
                        class="citation-item"
                      >
                        {citationItems.findIndex((i) => i.content === item.content) + 1}
                      </span>
                    {/if}
                  {/each}
                {:else}
                  {message.content ?? 'Waiting for AI response…'}
                {/if}
              </div>
            {/if}
          {/each}
        </div>
      {:else if loadingResponse}
        <div class="chat-result">
          <Icon name="spinner" />
          <h3 class="chat-memory">Loading...</h3>
        </div>
      {:else}
        <div class="chat-result">
          <h3 class="chat-memory">No memory found</h3>
        </div>
      {/if}
    </div> -->

    <!-- <div class="further-actions">
      <button on:click={() => navigate(`https://www.perplexity.ai/?q=${query}`)} class="action-btn">
        Ask Perplexity
      </button>
      <button class="action-btn" on:click={() => parseAIChatResponse()}>Parse Dummy</button>
    </div>

    <div class="chat">
      {#if messages.length > 0}
        <div class="chat-result">
          <h3 class="chat-memory">Response</h3>

          {#each messages as message (message.id)}
            <div class="message">
              {#if message.contentItems}
                {@const citationItems = message.contentItems.filter((i) => i.type === 'citation')}
                {#each message.contentItems as item}
                  {#if item.type === 'text'}
                    {item.content}
                  {:else}
                    <span
                      on:click={(e) => handleCitationClick(e, item.content)}
                      class="citation-item"
                    >
                      {citationItems.findIndex((i) => i.content === item.content) + 1}
                    </span>
                  {/if}
                {/each}
              {:else}
                {message.content}
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div> -->
  </div>
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
</style>
