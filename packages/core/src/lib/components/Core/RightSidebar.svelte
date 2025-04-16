<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte'
  import { type Writable } from 'svelte/store'
  import { Icon } from '@horizon/icons'

  import { useConfig } from '@horizon/core/src/lib/service/config'

  import NoteSwitcher from '@horizon/core/src/lib/components/Chat/Notes/NoteSwitcher.svelte'
  import ChatSwitcher from '@horizon/core/src/lib/components/Chat/ChatSwitcher.svelte'

  import ChatTitle from '@horizon/core/src/lib/components/Chat/ChatTitle.svelte'
  import NoteTitle from '@horizon/core/src/lib/components/Chat/Notes/NoteTitle.svelte'

  import ChatContext from '@horizon/core/src/lib/components/Chat/ChatContext.svelte'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import { useSmartNotes } from '@horizon/core/src/lib/service/ai/note'
  import type { RightSidebarTab } from '@horizon/types'
  import { useLogScope } from '@horizon/utils'
  import { useAI } from '@horizon/core/src/lib/service/ai/ai'

  import { launchTimeline, endTimeline } from '../Onboarding/timeline'
  import { OnboardingFeature } from '../Onboarding/onboardingScripts'

  export let activeTab: Writable<RightSidebarTab>

  const log = useLogScope('RightSidebar')
  const config = useConfig()
  const tabs = useTabsManager()
  const ai = useAI()
  const smartNotes = useSmartNotes()

  const userSettings = config.settings

  const activeNoteId = smartNotes.activeNoteId
  const activeNote = smartNotes.activeNote
  const activeSidebarChat = ai.activeSidebarChat
  const activeSidebarChatId = ai.activeSidebarChatId

  const dispatch = createEventDispatcher<{
    close: void
    'new-chat': void
    launchTimeline: OnboardingFeature
  }>()

  let rightSidebarWidth = 0

  $: smallLayout = rightSidebarWidth < 600

  const handleClose = () => {
    dispatch('close')
  }

  const handleNewChat = async () => {
    // Then dispatch the event to create a new chat
    dispatch('new-chat')

    // Wait for the next tick to ensure the event is processed
    await tick()

    // Finally set the active tab to chat
    activeTab.set('chat')
  }

  const handleOpenAsTab = async () => {
    log.debug('Opening active note as tab')

    if (!$activeNote) {
      return
    }

    tabs.openResourcFromContextAsPageTab($activeNote.id)
    dispatch('close')
  }

  const handleLaunchOnboarding = () => {
    dispatch('launchTimeline', OnboardingFeature.NotesOnboarding)
  }
</script>

<div
  id="sidebar-right"
  class="{$userSettings.experimental_notes_chat_sidebar
    ? 'bg-white'
    : 'bg-sky-50'} dark:bg-gray-900 text-gray-900 dark:text-gray-100 h-full flex flex-col relative no-drag"
  bind:clientWidth={rightSidebarWidth}
  data-tooltip-target="sidebar-right"
  data-tooltip-anchor="sidebar-right"
>
  <div
    class="flex items-center justify-between gap-3 px-4 py-3 border-b border-dashed border-sky-100 dark:border-gray-700"
  >
    <div class="w-full overflow-hidden">
      {#if $activeTab === 'chat' || $activeTab === 'root'}
        <div class="flex items-center gap-1 w-full overflow-hidden">
          <button
            class="flex-shrink-0 flex items-center gap-2 p-1 rounded-md opacity-60 hover:opacity-100 hover:bg-sky-200 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100"
            on:click={handleNewChat}
          >
            <Icon name="add" />
            <!-- New Chat -->
          </button>

          <!-- <button on:click={() => activeTab.set('root')}>
            <ChatContext />
          </button> -->

          {#if $activeTab === 'chat'}
            <!-- <span>/</span> -->

            {#if $userSettings.experimental_notes_chat_sidebar && $activeNote}
              <div class="w-fit max-w-full overflow-hidden">
                <NoteTitle note={$activeNote} />
              </div>
            {:else if !$userSettings.experimental_notes_chat_sidebar && $activeSidebarChat}
              <div class="w-fit max-w-full overflow-hidden">
                <ChatTitle chat={$activeSidebarChat} />
              </div>
            {:else}
              <div class="flex items-center gap-2">
                <Icon name="spinner" />
                <span>Loading chat...</span>
              </div>
            {/if}

            {#if $userSettings.experimental_notes_chat_sidebar}
              <NoteSwitcher selectedChatId={activeNoteId} />
            {:else}
              <ChatSwitcher selectedChatId={activeSidebarChatId} selectedChat={activeSidebarChat} />
            {/if}
          {/if}
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
      {#if $userSettings.experimental_notes_chat_sidebar}
        <div
          role="button"
          tabindex="0"
          on:click={handleLaunchOnboarding}
          class="flex items-center gap-2 p-1 text-sky-800/50 dark:text-gray-300 rounded-lg
          hover:bg-sky-100 hover:text-sky-800 dark:hover:bg-gray-700 group"
        >
          <Icon name="help.circle" size="20px" />
        </div>

        <div
          role="button"
          tabindex="0"
          on:click={handleOpenAsTab}
          class="flex items-center gap-2 p-1 text-sky-800/50 dark:text-gray-300 rounded-lg hover:bg-sky-100 hover:text-sky-800 dark:hover:bg-gray-700 group"
        >
          <Icon name="arrow.diagonal" size="20px" />
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
    {:else if $activeTab === 'root'}
      <slot name="root-sidebar"></slot>
    {:else}
      <div class="flex items-center justify-center h-full">
        <p class="text-lg text-gray-500">No content</p>
      </div>
    {/if}
  </div>
</div>
