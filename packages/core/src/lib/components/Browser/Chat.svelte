<script lang="ts" context="module">
  export type NavigateEvent = { url: string; active: boolean }
  export type UpdateTab = Partial<TabChat>
</script>

<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  import { writable } from 'svelte/store'
  import type { Drawer } from '@horizon/drawer'

  import type { ResourceManager } from '../../service/resources'
  import { useLogScope } from '../../utils/log'
  import type { Chat, ChatMessage, TabChat } from './types'
  import type { HorizonDatabase } from '../../service/storage'
  import { getChatData, getResourceByIDs } from './examples'
  import { DUMMY_CHAT_RESPONSE, parseChatResponse } from '../../service/ai'
  import { generateID } from '../../utils/id'

  export let tab: TabChat
  export let resourceManager: ResourceManager
  export let drawer: Drawer
  export let db: HorizonDatabase

  const log = useLogScope('Chat')
  const dispatch = createEventDispatcher<{ navigate: NavigateEvent; updateTab: UpdateTab }>()

  const chatsDB = db.chats
  const chatMessagesDB = db.chatMessages

  let chat: Chat
  let messages: ChatMessage[] = []
  let mockChatData: ChatMessage[]

  $: query = tab.query

  let queryElement: HTMLElement
  let isHeaderVisible = writable(false)

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
    } as ChatMessage

    log.debug('New message', message)

    messages = [...messages, message]
  }

  async function createNewChat() {
    const newChat = await chatsDB.create({
      title: query,
      messageIds: []
    })

    log.debug('Created new chat', newChat)
    chat = newChat

    tab.chatId = newChat.id
    dispatch('updateTab', { chatId: newChat.id })

    // TODO: create new message with query
  }

  async function loadMessages() {
    const messageIds = chat.messageIds
    const messageItems = await Promise.all(messageIds.map((id) => chatMessagesDB.read(id)))

    log.debug('Messages', messageItems)
    messages = messageItems.filter((v) => v) as ChatMessage[]
  }

  onMount(async () => {
    const chatId = tab.chatId

    if (!chatId) {
      log.debug('No existing chat, creating new one', tab)
      createNewChat()
    } else {
      const storedChat = await chatsDB.read(chatId)
      if (!storedChat) {
        log.error('Chat not found', chatId)
        return
      }

      log.debug('Chat', storedChat)
      chat = storedChat
    }

    mockChatData = getChatData('1')
    log.debug('mockChatData', mockChatData)

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

    onDestroy(() => {
      observer.disconnect()
    })

    loadMessages()
  })

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

  async function handleCitationClick(e: MouseEvent, sourceId: string) {
    log.debug('Citation clicked', sourceId)

    const source = await getResource(sourceId)
    log.debug('Source', source)
  }
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

      <div class="chat-result">
        <h3 class="chat-memory">From your Memory</h3>
        {#each mockChatData?.messages ?? [] as message}
          {#if message.role === 'user'}
            <div class="message user" bind:this={queryElement}>
              <h2>{@html message.content}</h2>
            </div>
          {:else}
            <div class="message">
              {@html message.content}
            </div>
          {/if}

          {#if message.resourceIDs && message.resourceIDs.length > 0}
            <div class="resources">
              {#each getResourceByIDs(message.resourceIDs) as resource}
                <div
                  class="resource-item {resource.type}"
                  on:click={() => openResource(resource.id)}
                  on:keydown={(event) => event.key === 'Enter' && openResource(resource.id)}
                  role="button"
                  id={resource.id}
                  tabindex="0"
                  style="--resource-color: {resource.color}; {resource.image
                    ? `background-image: url(${resource.image});`
                    : ''}"
                  on:mousemove={handleMouseMove}
                  on:mouseleave={handleMouseLeave}
                >
                  {#if !resource.image}
                    <div class="resource-content">
                      {#if resource.type === 'Note'}
                        <p class="type">{resource.type}</p>
                      {/if}
                      {#if resource.author}
                        <p class="author">{resource.author}</p>
                      {/if}
                      <p class="title">{resource.title}</p>
                      {#if resource.excerpt}
                        <p class="excerpt">{resource.excerpt}</p>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        {/each}
      </div>
    </div>

    <div class="further-actions">
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
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <!-- svelte-ignore a11y-no-static-element-interactions -->
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
    </div>
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
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: fit-content;
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
    padding: 4rem 0;
    line-height: 150%;
    max-width: 640px;
    margin: 0 auto;
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
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      grid-auto-rows: minmax(100%, auto);
      gap: 3rem;
      margin: 4rem 0;
      & > *:only-child {
        max-height: 24rem;
        grid-column: 2 / span 2;
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
</style>
