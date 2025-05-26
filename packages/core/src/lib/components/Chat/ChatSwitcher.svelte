<script lang="ts">
  import { onMount } from 'svelte'
  import { derived, writable, type Writable } from 'svelte/store'

  import { tooltip, getHumanDistanceToNow, useLogScope, useDebounce } from '@horizon/utils'
  import { Icon } from '@horizon/icons'

  import type { AIChat } from '@horizon/core/src/lib/service/ai/chat'
  import { useAI } from '@horizon/core/src/lib/service/ai/ai'
  import {
    SelectDropdown,
    SelectDropdownItem,
    type SelectItem
  } from '@horizon/core/src/lib/components/Atoms/SelectDropdown'
  import {
    contextMenu,
    type CtxItem
  } from '@horizon/core/src/lib/components/Core/ContextMenu.svelte'
  import { openDialog } from '@horizon/core/src/lib/components/Core/Dialog/Dialog.svelte'
  import { useToasts } from '@horizon/core/src/lib/service/toast'
  import type { AIChatData } from '@horizon/core/src/lib/types'

  export let selectedChatId: Writable<string> = writable('')
  export let selectedChat: Writable<AIChat | null> = writable(null)
  export let open: Writable<boolean> = writable(false)

  const ai = useAI()
  const toasts = useToasts()
  const log = useLogScope('ChatSwitcher')

  const loadingChat = writable(false)
  const searchValue = writable('')
  const searching = writable(false)
  const searchResults = writable<AIChatData[]>([])

  $: if ($searchValue) {
    handleSearch($searchValue)
  }

  const selectNewItem = {
    id: 'new',
    label: 'Create Chat',
    icon: 'add'
  } as SelectItem

  const items = derived([ai.chats, selectedChatId], ([chats, selectedChatId]) => {
    return chats
      .filter((chat) => !!chat.titleValue && chat.id !== selectedChatId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map(
        (chat) =>
          ({
            id: chat.id,
            label: chat.titleValue,
            description: getHumanDistanceToNow(chat.updatedAt),
            data: chat
          }) as SelectItem
      )
  })

  const filterdItems = derived(
    [items, searchResults, searchValue, selectedChatId],
    ([$items, $searchResults, $searchValue, $selectedChatId]) => {
      if (!$searchValue) return $items

      return $searchResults
        .filter((chat) => !!chat.title && chat.id !== $selectedChatId)
        .map(
          (chat) =>
            ({
              id: chat.id,
              label: chat.title,
              description: getHumanDistanceToNow(chat.updatedAt),
              data: chat
            }) as SelectItem
        )
    }
  )

  const debouncedSearch = useDebounce(async () => {
    try {
      if (!$searchValue) {
        searchResults.set([])
        return
      }

      searching.set(true)
      const chats = await ai.sffs.searchAIChats($searchValue, 15)
      searchResults.set(chats)
    } catch (err) {
      log.error('Failed to search chats:', err)
      searchResults.set([])
    } finally {
      searching.set(false)
    }
  }, 200)

  const handleSearch = (query: string) => {
    if (!query) {
      searchResults.set([])
      return
    }

    searching.set(true)
    debouncedSearch()
  }

  const switchChat = async (chatId: string) => {
    try {
      loadingChat.set(true)

      const chat = await ai.getChat(chatId, { fresh: false })
      if (!chat) return

      log.debug('Switching chat:', chat.id)

      const oldChat = $selectedChat

      selectedChatId.set(chat.id)
      selectedChat.set(chat)
      open.set(false)

      await chat.getMessages()

      if (oldChat && !oldChat.titleValue && oldChat.messagesValue.length === 0) {
        log.debug('Deleting empty chat:', oldChat.id)
        await oldChat.delete()
      }
    } catch (err) {
      log.error('Failed to switch chat:', err)
    } finally {
      loadingChat.set(false)
    }
  }

  const createChat = async () => {
    try {
      loadingChat.set(true)
      log.debug('Creating new chat')
      const chat = await ai.createChat({ automaticTitleGeneration: true })
      if (!chat) return
      switchChat(chat.id)
    } catch (err) {
      log.error('Failed to create chat:', err)
    } finally {
      loadingChat.set(false)
    }
  }

  const deleteChat = async (chat: AIChat) => {
    try {
      log.debug('Deleting chat:', chat.id)

      const { closeType: confirmed } = await openDialog({
        message: `Are you sure you want to delete the chat "${chat.titleValue}"?`,
        actions: [
          { title: 'Cancel', type: 'reset' },
          { title: 'Delete', type: 'submit', kind: 'danger' }
        ]
      })

      if (!confirmed) {
        log.debug('User cancelled chat deletion')
        return
      }

      if (chat.id === $selectedChatId) {
        await createChat()
      }

      await chat.delete()

      toasts.success('Chat deleted!')
    } catch (error) {
      log.error('Failed to delete folder:', error)
    }
  }

  const getContextItems = (chat: AIChat, active: boolean) =>
    [
      {
        type: 'action',
        icon: 'eye',
        hidden: active,
        text: 'Open',
        action: () => switchChat(chat.id)
      },
      {
        type: 'action',
        icon: 'trash',
        text: 'Delete Chat',
        kind: 'danger',
        action: () => deleteChat(chat)
      }
    ] satisfies CtxItem[]

  const handleSelect = async (e: CustomEvent<string>) => {
    const chatId = e.detail
    if (chatId === 'new') {
      createChat()
      return
    }

    switchChat(chatId)
  }

  onMount(async () => {
    try {
      loadingChat.set(true)
      await ai.listChats({ withMessages: false, limit: 50 })
    } catch (err) {
      log.error('Failed to list chats:', err)
    } finally {
      loadingChat.set(false)
    }
  })
</script>

<SelectDropdown
  items={filterdItems}
  search="manual"
  selected={$selectedChatId}
  footerItem={selectNewItem}
  loading={$searching}
  {searchValue}
  {open}
  side="top"
  inputPlaceholder="Search for a chat…"
  loadingPlaceholder="Searching chats…"
  emptyPlaceholder="No chats found"
  closeOnMouseLeave={false}
  keepHeightWhileSearching
  on:select={handleSelect}
>
  <button
    use:tooltip={{ text: 'Switch Chat', position: 'right' }}
    class="transform whitespace-nowrap active:scale-95 disabled:opacity-10 appearance-none border-0 group margin-0 flex items-center p-2 hover:bg-sky-200 dark:hover:bg-gray-800 transition-colors duration-200 rounded-xl text-sky-1000 dark:text-gray-100 text-sm"
  >
    {#if $loadingChat}
      <Icon name="spinner" className="opacity-40" size="16px" />
    {:else}
      <Icon name="chevron.down" className="opacity-60 {$open ? 'rotate-180' : ''}" />
    {/if}
  </button>

  <div
    slot="item"
    class="w-full"
    let:item
    use:contextMenu={{
      canOpen: !!item?.data,
      items: getContextItems(item?.data, item?.id === $selectedChatId)
    }}
  >
    <SelectDropdownItem {item} />
  </div>
</SelectDropdown>
