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

    loadMessages()
  })
</script>

<div class="chat-wrapper">
  <h1>{query}</h1>
  <!-- TODO -->
  <button on:click={() => navigate(`https://www.perplexity.ai/?q=${query}`)} class="action-btn"
    >Ask Perplexity</button
  >
</div>

<style lang="scss">
  .chat-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
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
</style>
