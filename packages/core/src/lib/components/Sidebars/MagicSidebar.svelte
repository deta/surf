<script lang="ts" context="module">
  export type ExamplePrompt = {
    label: string
    prompt: string
  }
</script>

<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { derived, writable, type Writable } from 'svelte/store'

  import { useLogScope, tooltip, isMac } from '@horizon/utils'
  import { Icon } from '@horizon/icons'

  import Chat from '@horizon/core/src/lib/components/Chat/Chat.svelte'
  import Onboarding from '@horizon/core/src/lib/components/Core/Onboarding.svelte'

  import chatContextDemo from '../../../../public/assets/demo/chatcontext.gif'
  import chatAdd from '../../../../public/assets/demo/chatadd.gif'
  import chatRemove from '../../../../public/assets/demo/chatremove.gif'

  import { useResourceManager } from '@horizon/core/src/lib/service/resources'
  import { useToasts } from '@horizon/core/src/lib/service/toast'
  import { useConfig } from '@horizon/core/src/lib/service/config'
  import { AIChat, useAI } from '@horizon/core/src/lib/service/ai/ai'
  import { openDialog } from '../Core/Dialog/Dialog.svelte'

  export let inputValue = ''
  export let activeChatId: Writable<string>
  export let activeChat: Writable<AIChat | null>

  const dispatch = createEventDispatcher<{
    'close-chat': void
  }>()

  const log = useLogScope('MagicSidebar')
  const resourceManager = useResourceManager()
  const toasts = useToasts()
  const config = useConfig()
  const ai = useAI()

  const userConfigSettings = config.settings
  const telemetry = resourceManager.telemetry

  const onboardingOpen = writable(false)

  const modKeyShortcut = isMac() ? '⌘' : 'Ctrl'

  const otherTabsOpen = derived(userConfigSettings, (userConfigSettings) => {
    return userConfigSettings.annotations_sidebar
  })

  let chatComponent: Chat

  $: responses = $activeChat?.responses

  export const startChatWithQuery = async (query: string) => {
    const messagesLength = ($activeChat?.responsesValue ?? []).length

    if (messagesLength > 0) {
      const { closeType: confirmed } = await openDialog({
        title: 'Start New Chat',
        message: 'Are you sure you want to start a new chat? This will clear the current chat.',
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

    await handleClearChat()

    log.debug('Starting new chat with query', query)
    chatComponent?.updateChatInput(query)
    chatComponent?.submitChatMessage('active')
  }

  export const insertQueryIntoChat = (query: string) => {
    chatComponent?.insertQueryIntoChat(query)
  }

  export const addChatWithQuery = async (query: string) => {
    chatComponent?.addChatWithQuery(query)
  }

  export const clearExistingChat = async () => {
    await handleClearChat()
  }

  const handleClearErrors = () => {
    // todo: implement
  }

  const handleClearChat = async () => {
    log.debug('Clearing chat')

    if (!$activeChatId) {
      log.error('No chat found to clear')
      return
    }

    try {
      const messagesLength = ($activeChat?.responsesValue ?? []).length

      await clearChat($activeChatId)

      if (messagesLength > 0) {
        toasts.success('Chat cleared!')
      }
      await telemetry.trackPageChatClear(messagesLength)
    } catch (e) {
      log.error('Error clearing chat:', e)
      toasts.error('Failed to clear chat')
    }
  }

  const clearChat = async (id: string) => {
    log.debug('Clearing chat', id)

    await ai.deleteChat(id)

    log.debug('Old chat deleted, creating new chat...')
    await createNewChat()
  }

  const fetchExistingChat = async (id: string) => {
    if ($activeChat?.id === id) {
      log.debug('Chat already fetched', id)
      return
    }

    const fetched = await ai.getChat(id)
    if (!fetched) {
      log.error('Failed to fetch chat', id)
      return
    }

    activeChat.set(fetched)
  }

  const createNewChat = async () => {
    const createdChat = await ai.createChat('')
    if (!createdChat) {
      log.error('Failed to create chat')
      return
    }

    log.debug('Chat created', $activeChat)

    activeChatId.set(createdChat.id)
    activeChat.set(createdChat)
  }

  onMount(async () => {
    log.debug('Magic Sidebar mounted', $activeChatId)

    if ($activeChatId) {
      log.debug('Existing chat found', $activeChatId)
      await fetchExistingChat($activeChatId)
    } else {
      log.debug('No existing chat found, creating new chat')
      await createNewChat()
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
  {#if !$otherTabsOpen}
    <div
      class="flex items-center justify-between gap-3 px-4 py-4 border-b-2 border-sky-100 dark:border-gray-800"
    >
      {#if $responses && $responses.length > 0}
        <button
          class="flex items-center gap-2 p-2 rounded-lg opacity-60 hover:bg-blue-200 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100"
          on:click={() => {
            handleClearChat()
          }}
        >
          <Icon name="add" />
          New Chat
        </button>
      {:else}
        <div
          class="flex items-center justify-start text-lg p-1.5 font-semibold text-gray-900 dark:text-gray-100"
        >
          Chat <button
            class="flex items-center gap-2 p-2 ml-2 rounded-lg opacity-60 hover:bg-blue-200 dark:hover:bg-gray-800"
            on:click={() => {
              $onboardingOpen = true
            }}
            use:tooltip={{
              text: 'Need help?',
              position: 'bottom'
            }}
          >
            <Icon name="info" />
          </button>
        </div>
      {/if}

      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div
        role="button"
        tabindex="0"
        on:click={() => dispatch('close-chat')}
        class="flex items-center gap-2 p-1 text-sky-800/50 dark:text-sky-100/50 rounded-lg hover:bg-sky-100 dark:hover:bg-gray-800 hover:text-sky-800 dark:hover:text-sky-100 group cursor-default"
      >
        <Icon name="sidebar.right" class="group-hover:!hidden" size="20px" />
        <Icon name="close" class="hidden group-hover:!block" size="20px" />
      </div>
    </div>
  {/if}

  {#if $activeChat}
    {#key $activeChat.id}
      <Chat
        bind:this={chatComponent}
        bind:inputValue
        chat={$activeChat}
        contextItemErrors={[]}
        preparingTabs={false}
        on:clear-chat={handleClearChat}
        on:clear-errors={handleClearErrors}
        on:close-chat
        on:open-context-item
        on:process-context-item
        on:highlightWebviewText
        on:seekToTimestamp
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
</style>
