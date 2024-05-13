<script lang="ts" context="module">
  export type NavigateEvent = { url: string; active: boolean }
  export type UpdateTab = Partial<TabChat>
</script>

<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import type { Drawer } from '@horizon/drawer'

  import type { ResourceManager } from '../../service/resources'
  import { useLogScope } from '../../utils/log'
  import type { Chat, ChatMessage, TabChat } from './types'
  import type { HorizonDatabase } from '../../service/storage'
  import { getChatData } from './examples'

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

    loadMessages()
  })
</script>

<div class="chat-wrapper">
  <div class="chat">
    <h1 class="chat-request">{query}</h1>

    <div class="chat-result">
      <h3 class="chat-memory">From your Memory</h3>

      {#each mockChatData?.messages ?? [] as message}
        <div class="message">
          <p>{message.content}</p>
        </div>
      {/each}
    </div>
  </div>

  <!-- TODO -->
  <button on:click={() => navigate(`https://www.perplexity.ai/?q=${query}`)} class="action-btn">
    Ask Perplexity
  </button>
</div>

<style lang="scss">
  .chat-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
    background: #f8fcff;
  }

  .chat {
    margin: 0 auto;
    max-width: 640px;
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

  .chat-request {
    color: #5b6882;
    font-size: 3rem;
    margin-bottom: 1.5rem;
    background: linear-gradient(0deg, #004fca -39%, #1874f6 100%);
    background: linear-gradient(
      0deg,
      color(display-p3 0.0871 0.3055 0.7644) -39%,
      color(display-p3 0.2157 0.4471 0.9333) 100%
    );
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .chat-memory {
    color: #5b6882;
    font-size: 1.5rem;
    margin-bottom: 1.5rem;
    color: #1f385f;
    color: color(display-p3 0.1429 0.2153 0.3601);
    leading-trim: both;
    text-edge: cap;
    font-style: normal;
    font-weight: 600;
    letter-spacing: 0.01em;
    line-height: 150%; /* 24px */
  }

  .chat-result {
    .message {
      color: #5b6882;
      font-size: 1.5rem;
      letter-spacing: 0.01em;
      margin-bottom: 1.5rem;
      line-height: 1.45;
    }
  }
</style>
