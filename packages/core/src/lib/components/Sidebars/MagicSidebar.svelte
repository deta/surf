<script lang="ts" context="module">
  export type ExamplePrompt = {
    label: string
    prompt: string
  }
</script>

<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { writable } from 'svelte/store'

  import { useLogScope, isMac } from '@horizon/utils'
  import { Icon } from '@horizon/icons'

  import Chat from '@horizon/core/src/lib/components/Chat/Chat.svelte'
  import ChatOld from '@horizon/core/src/lib/components/Chat/ChatOld.svelte'
  import Onboarding from '@horizon/core/src/lib/components/Core/Onboarding.svelte'

  import chatContextDemo from '../../../../public/assets/demo/chatcontext.gif'
  import chatAdd from '../../../../public/assets/demo/chatadd.gif'
  import chatRemove from '../../../../public/assets/demo/chatremove.gif'

  import { useResourceManager } from '@horizon/core/src/lib/service/resources'
  import { useToasts } from '@horizon/core/src/lib/service/toast'
  import { useAI } from '@horizon/core/src/lib/service/ai/ai'
  import { openDialog } from '../Core/Dialog/Dialog.svelte'
  import { useSmartNotes } from '@horizon/core/src/lib/service/ai/note'
  import { useConfig } from '@horizon/core/src/lib/service/config'

  const log = useLogScope('MagicSidebar')
  const resourceManager = useResourceManager()
  const toasts = useToasts()
  const config = useConfig()
  const ai = useAI()
  const smartNotes = useSmartNotes()

  const activeChatId = ai.activeSidebarChatId
  const activeChat = ai.activeSidebarChat
  const activeNoteId = smartNotes.activeNoteId
  const activeNote = smartNotes.activeNote
  const telemetry = resourceManager.telemetry
  const userSettings = config.settings

  const onboardingOpen = writable(false)

  const modKeyShortcut = isMac() ? '⌘' : 'Ctrl'

  let chatComponent: Chat | ChatOld

  $: log.debug('Active chat note ID:', $activeNoteId)
  $: log.debug('Active chat note:', $activeNote)

  // TODO: what to do with this?
  export const startChatWithQuery = async (query: string) => {
    const messagesLength = 0

    if (messagesLength > 0) {
      const { closeType: confirmed } = await openDialog({
        title: 'Create New Note',
        message: 'Are you sure you want to start a new note? This will clear the current note.',
        actions: [
          { title: 'Cancel', type: 'reset' },
          { title: 'OK', type: 'submit' }
        ]
      })

      if (!confirmed) {
        log.debug('User cancelled new chat')
        chatComponent?.updateChatInput(query)
        return
      }
    }

    await handleClear()

    log.debug('Starting new chat with query', query)
    chatComponent?.updateChatInput(query)
    chatComponent?.submitChatMessage('active')
  }

  export const insertQueryIntoChat = async (query: string) => {
    if (chatComponent && typeof chatComponent.insertQueryIntoChat === 'function') {
      await chatComponent.insertQueryIntoChat(query)

      await tick()
    }
  }

  export const submitChatMessage = async () => {
    if (chatComponent && typeof chatComponent.submitCurrentChatMessage === 'function') {
      return await chatComponent.submitCurrentChatMessage()
    }
    return false
  }

  export const addChatWithQuery = async (query: string) => {
    chatComponent?.addChatWithQuery(query)
  }

  export const clearExistingChat = async () => {
    await handleClear()
  }

  const handleClearErrors = () => {
    // todo: implement
  }

  const handleClearNote = async () => {
    log.debug('Clearing note')

    if (!$activeNote) {
      log.error('No note found to clear')
      return
    }

    try {
      await clearNote()

      toasts.success('Note cleared!')
      await telemetry.trackPageChatClear(0) // TODO: fix metrics
    } catch (e) {
      log.error('Error clearing note:', e)
      toasts.error('Failed to clear note')
    }
  }

  const handleClearChat = async () => {
    log.debug('Clearing chat')

    if (!$activeChat) {
      log.error('No chat found to clear')
      return
    }

    try {
      await clearChat()

      toasts.success('Chat cleared!')
      await telemetry.trackPageChatClear(0) // TODO: fix metrics
    } catch (e) {
      log.error('Error clearing chat:', e)
      toasts.error('Failed to clear chat')
    }
  }

  const handleClear = () => {
    if ($userSettings.experimental_notes_chat_sidebar) {
      handleClearNote()
    } else {
      handleClearChat()
    }
  }

  const clearNote = async () => {
    log.debug('creating new chat...')
    await createNewNote()
  }

  const fetchExistingNote = async (id: string) => {
    try {
      if ($activeNote?.id === id) {
        log.debug('Chat already fetched', id)
        await smartNotes.changeActiveNote($activeNote)
        return
      }

      const fetched = await smartNotes.getNote(id)
      if (!fetched) {
        log.error('Failed to fetch chat', id)
        await createNewNote()
        return
      }

      await tick()

      log.debug('Fetched chat', fetched, fetched.contentValue)

      await smartNotes.changeActiveNote(fetched)
    } catch (e) {
      log.error('Error fetching chat:', e)
      await createNewNote()
    }
  }

  const createNewNote = async () => {
    const createdNote = await smartNotes.createNote('')
    if (!createdNote) {
      log.error('Failed to create chat')
      return
    }

    log.debug('Chat created', createdNote)

    await smartNotes.changeActiveNote(createdNote)
  }

  const clearChat = async () => {
    log.debug('creating new chat...')
    await createNewChat()
  }

  const fetchExistingChat = async (id: string) => {
    try {
      if ($activeChat?.id === id) {
        log.debug('Chat already fetched', id)
        return
      }
      const fetched = await ai.getChat(id)
      if (!fetched) {
        log.error('Failed to fetch chat', id)
        createNewChat()
        return
      }
      activeChat.set(fetched)
    } catch (e) {
      log.error('Error fetching chat:', e)
      createNewChat()
    }
  }

  const createNewChat = async () => {
    const createdChat = await ai.createChat({ automaticTitleGeneration: true })
    if (!createdChat) {
      log.error('Failed to create chat')
      return
    }

    log.debug('Chat created', $activeChat)
    activeChatId.set(createdChat.id)
    activeChat.set(createdChat)
  }

  onMount(async () => {
    try {
      if ($userSettings.experimental_notes_chat_sidebar) {
        log.debug('Magic Sidebar mounted, loading note', $activeNoteId)

        await smartNotes.loadNotes()

        if ($activeNoteId) {
          log.debug('Existing chat found', $activeNoteId)
          await fetchExistingNote($activeNoteId)
        } else {
          log.debug('No existing chat found, creating new chat')
          await createNewNote()
        }

        await tick()

        return
      }

      log.debug('Magic sidebar mounted, loading chat', $activeChatId)

      if ($activeChatId) {
        log.debug('Existing chat found', $activeChatId)
        await fetchExistingChat($activeChatId)
      } else {
        log.debug('No existing chat found, creating new chat')
        await createNewChat()
      }
    } catch (err) {
      log.error('Error mounting Magic Sidebar:', err)
    }
  })

  const closeOnboarding = async () => {
    onboardingOpen.set(false)

    const existingOnboardingSettings = window.api.getUserConfigSettings().onboarding
    await window.api.updateUserConfigSettings({
      onboarding: {
        ...existingOnboardingSettings,
        completed_chat: true
      }
    })
  }
</script>

{#if $onboardingOpen}
  <Onboarding
    on:close={closeOnboarding}
    title="What you see is what you chat"
    tip=""
    sections={[
      {
        description: `
          <p>
            Surf gives you high quality answers from the tabs, folders, and content you add to the
            "Context Window".
          </p>
          `,
        imgAlt: 'Context Window',
        iconName: 'chat',
        imgSrc: chatContextDemo
      },
      {
        title: 'Add Context',
        description: `
        <p>
            Use <kbd class="px-2 py-0.5 text-lg font-semibold text-gray-900 bg-white border border-gray-200 rounded-lg">+</kbd> to include an item in your
            chat.
          </p>
          <p class="opacity-70">
            Hint: you can also <kbd class="px-2 py-0.5 text-lg font-semibold text-gray-900 bg-white border border-gray-200 rounded-lg">${modKeyShortcut}</kbd> or <kbd class="px-2 py-1.5 text-xs font-semibold text-gray-900 bg-white border border-gray-200 rounded-lg">Shift</kbd>
            + click to
            select multiple items (tabs).
          </p>
          `,
        imgAlt: 'Add Context',
        iconName: 'add',
        imgSrc: chatAdd
      },
      {
        title: 'Remove Context',
        description: `
        <p>
            Remove an individual item by clicking it's own <kbd class="px-2 py-0.5 text-lg font-semibold text-gray-900 bg-white border border-gray-200 rounded-lg">x</kbd> button. Or clear the whole window to start fresh.
          </p>
          `,
        imgSrc: chatRemove,
        imgAlt: 'Remove Context',
        iconName: 'close'
      }
    ]}
    warning="Chat can make mistakes. Verify results."
    buttonText="Continue"
  />
{/if}

<div class="flex flex-col h-full relative overflow-hidden">
  {#if $userSettings.experimental_notes_chat_sidebar && $activeNote}
    {#key $activeNote.id + $activeNote.contextManager.key}
      <Chat
        bind:this={chatComponent}
        note={$activeNote}
        preparingTabs={false}
        on:clear-chat={handleClear}
        on:clear-errors={handleClearErrors}
        on:close-chat
        on:open-context-item
        on:process-context-item
        on:highlightWebviewText
        on:seekToTimestamp
        on:open-onboarding={() => {
          $onboardingOpen = true
        }}
      />
    {/key}
  {:else if !$userSettings.experimental_notes_chat_sidebar && $activeChat}
    {#key $activeChat.id}
      <ChatOld
        bind:this={chatComponent}
        chat={$activeChat}
        contextItemErrors={[]}
        preparingTabs={false}
        on:clear-chat={handleClear}
        on:clear-errors={handleClearErrors}
        on:close-chat
        on:open-context-item
        on:process-context-item
        on:highlightWebviewText
        on:seekToTimestamp
        on:open-onboarding={() => {
          $onboardingOpen = true
        }}
      />
    {/key}
  {:else}
    <div class="flex items-center justify-center flex-1">
      <Icon name="spinner" />
    </div>
  {/if}
</div>

<style lang="scss">
  :global(#magic-chat[data-drag-target]) {
    outline: 2px dashed gray;
    outline-offset: -2px;
  }

  .chat-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem;
    border-bottom: 1px dashed rgb(203, 234, 255);
  }

  .chat-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
  }
</style>
