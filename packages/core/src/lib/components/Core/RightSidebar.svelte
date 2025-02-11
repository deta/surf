<script lang="ts" context="module">
  // prettier-ignore
  export type SidebarTab = 'chat' | 'annotations';
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { type Writable } from 'svelte/store'
  import { Icon } from '@horizon/icons'

  import type { AIChat } from '@horizon/core/src/lib/service/ai/chat'
  import { useConfig } from '@horizon/core/src/lib/service/config'

  import ChatSwitcher from '@horizon/core/src/lib/components/Chat/ChatSwitcher.svelte'
  import ChatTitle from '@horizon/core/src/lib/components/Chat/ChatTitle.svelte'
  import { useAI } from '@horizon/core/src/lib/service/ai/ai'

  export let activeTab: Writable<SidebarTab>

  const ai = useAI()
  const config = useConfig()

  const userSettings = config.settings
  const activeSidebarChat = ai.activeSidebarChat
  const activeSidebarChatId = ai.activeSidebarChatId

  const dispatch = createEventDispatcher<{ close: void; 'new-chat': void }>()

  let rightSidebarWidth = 0

  $: smallLayout = rightSidebarWidth < 600

  const handleClose = () => {
    dispatch('close')
  }

  const handleNewChat = () => {
    dispatch('new-chat')
  }
</script>

<div
  id="sidebar-right"
  class="bg-sky-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 h-full flex flex-col relative no-drag"
  bind:clientWidth={rightSidebarWidth}
>
  <div
    class="flex items-center justify-between gap-3 px-4 py-4 border-b-2 border-sky-100 dark:border-gray-700"
  >
    <div class="w-full overflow-hidden">
      {#if $activeTab === 'chat'}
        <div class="flex items-center gap-2 w-full overflow-hidden">
          <button
            class="flex-shrink-0 flex items-center gap-2 p-2 rounded-xl opacity-60 hover:opacity-100 hover:bg-sky-200 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100"
            on:click={handleNewChat}
          >
            <Icon name="add" />
            <!-- New Chat -->
          </button>

          {#if $activeSidebarChat}
            <div class="w-fit max-w-full overflow-hidden">
              <ChatTitle chat={$activeSidebarChat} />
            </div>
          {:else}
            <div class="flex items-center gap-2">
              <Icon name="spinner" />
              <span>Loading chat...</span>
            </div>
          {/if}

          <ChatSwitcher selectedChatId={activeSidebarChatId} selectedChat={activeSidebarChat} />
        </div>
      {:else if $activeTab === 'annotations'}
        <div class="flex items-center gap-2 w-full">
          <h2 class="text-[1.2em] font-[450]">Annotations</h2>
        </div>
      {/if}
    </div>

    <div class="flex-shrink-0 flex items-center {smallLayout ? 'gap-1' : 'gap-4'}">
      {#if $userSettings.annotations_sidebar}
        <div class="flex items-center {smallLayout ? 'gap-1' : 'gap-3'}">
          <button
            class="flex-shrink-0 flex items-center gap-2 py-2 px-3 rounded-lg opacity-60 hover:opacity-100 hover:bg-sky-100 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100 {$activeTab ===
            'chat'
              ? ' text-gray-900 dark:text-gray-100 bg-sky-200/70 dark:bg-gray-700 hover:bg-sky-200 dark:hover:bg-gray-800 !opacity-100'
              : ''}"
            on:click={() => activeTab.set('chat')}
          >
            <Icon name="chat" size="16px" />
            {#if !smallLayout}
              Chat
            {/if}
          </button>

          <button
            class="flex-shrink-0 flex items-center gap-2 py-2 px-3 rounded-lg opacity-60 hover:opacity-100 hover:bg-sky-100 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100 {$activeTab ===
            'annotations'
              ? ' text-gray-900 dark:text-gray-100 bg-sky-200/70 dark:bg-gray-700 hover:bg-sky-200 dark:hover:bg-gray-800 !opacity-100'
              : ''}"
            on:click={() => activeTab.set('annotations')}
          >
            <Icon name="marker" size="16px" />
            {#if !smallLayout}
              Annotations
            {/if}
          </button>
        </div>
      {/if}

      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <div
        role="button"
        tabindex="0"
        on:click={handleClose}
        class="flex items-center gap-2 p-1 text-sky-800/50 dark:text-gray-300 rounded-lg hover:bg-sky-100 hover:text-sky-800 dark:hover:bg-gray-700 group"
      >
        <Icon name="sidebar.right" class="group-hover:!hidden" size="20px" />
        <Icon name="close" class="hidden group-hover:!block" size="20px" />
      </div>
    </div>
  </div>

  <div class="flex-grow overflow-hidden">
    {#if $activeTab === 'chat'}
      <slot name="magic-sidebar"></slot>
    {:else if $activeTab === 'annotations'}
      <slot name="annotations-sidebar"></slot>
    {:else}
      <div class="flex items-center justify-center h-full">
        <p class="text-lg text-gray-500">No content</p>
      </div>
    {/if}
  </div>
</div>
