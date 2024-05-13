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
      return
    }

    const storedChat = await chatsDB.read(chatId)
    if (!storedChat) {
      log.error('Chat not found', chatId)
      return
    }

    log.debug('Chat', storedChat)
    chat = storedChat

    mockChatData = getChatData('1')
    console.log(mockChatData)

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
            <div class="message user">
              <h2>{message.content}</h2>
            </div>
          {:else}
            <div class="message">
              <p>{message.content}</p>
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
                  tabindex="0"
                  style="--resource-color: {resource.color}; {resource.image
                    ? `background-image: url(${resource.image});`
                    : ''}"
                  on:mousemove={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect()
                    const x = event.clientX - rect.left
                    const y = event.clientY - rect.top
                    const centerX = rect.width / 2
                    const centerY = rect.height / 2
                    const deltaX = (x - centerX) * 0.1
                    const deltaY = (y - centerY) * 0.1
                    event.currentTarget.style.transform = `translate(${deltaX}px, ${deltaY}px)`
                    event.currentTarget.style.scale = '1.02'
                  }}
                  on:mouseleave={(event) => {
                    event.currentTarget.style.scale = '1.00'
                    event.currentTarget.style.transform = ''
                  }}
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

    <!-- TODO -->
    <button on:click={() => navigate(`https://www.perplexity.ai/?q=${query}`)} class="action-btn">
      Ask Perplexity
    </button>
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
    background: #f8fcff;
  }

  .chat {
    display: flex;
    flex-direction: column;
    gap: 4rem;
    margin: 0 auto;
    max-width: 1200px;
  }

  .action-btn {
    margin-top: 20px;
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
    color: #5b6882;
    font-size: 3rem;
    margin-bottom: 1.5rem;
    background: linear-gradient(0deg, #004fca -39%, #1874f6 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    max-width: 640px;
    margin: 0 auto;
  }

  .fixed-header > h1 {
    font-size: 1.75rem;
  }

  .chat-memory {
    color: #1f385f;
    font-size: 1.5rem;
    padding: 4rem 0;
    line-height: 150%;
    max-width: 640px;
    margin: 0 auto;
  }

  .chat-result {
    .message {
      color: #5b6882;
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
        grid-column: 2 / span 2;
      }
    }

    .resource-content {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .resource-item {
      height: 32rem;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: 0.65s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow:
        0px 0px 0.467px 0px rgba(0, 0, 0, 0.18),
        0px 0.933px 2.8px 0px rgba(0, 0, 0, 0.1),
        0px 2.8px 7.467px 0px rgba(0, 0, 0, 0.1);

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
</style>
