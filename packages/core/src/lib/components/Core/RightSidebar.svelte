<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte'
  import { type Writable } from 'svelte/store'
  import { Icon } from '@deta/icons'

  import { useConfig } from '@horizon/core/src/lib/service/config'

  import NoteSwitcher from '@horizon/core/src/lib/components/Chat/Notes/NoteSwitcher.svelte'
  import ChatSwitcher from '@horizon/core/src/lib/components/Chat/ChatSwitcher.svelte'

  import ChatTitle from '@horizon/core/src/lib/components/Chat/ChatTitle.svelte'
  import NoteTitle from '@horizon/core/src/lib/components/Chat/Notes/NoteTitle.svelte'

  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import { useSmartNotes } from '@horizon/core/src/lib/service/ai/note'
  import type { RightSidebarTab } from '@deta/types'
  import { useLogScope } from '@deta/utils'
  import { useAI } from '@horizon/core/src/lib/service/ai/ai'

  import { CompletionEventID } from '../Onboarding/onboardingScripts'
  import { OnboardingFeature } from '../Onboarding/onboardingScripts'
  import ModelPicker from '../Chat/ModelPicker.svelte'
  import AppBarButton from '../Browser/AppBarButton.svelte'
  import NoteSettingsMenu from '../Chat/NoteSettingsMenu.svelte'
  import Tooltip from '../Atoms/Tooltip.svelte'
  import { debugMode } from '@horizon/core/src/lib/stores/debug'

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

    document.dispatchEvent(new CustomEvent(CompletionEventID.OpenNoteAsTab, { bubbles: true }))
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
          <Tooltip side="bottom">
            <AppBarButton on:click={handleNewChat} data-tooltip-disable>
              <Icon name="edit" size="1.2rem" />
            </AppBarButton>
            <svelte:fragment slot="content">New Note</svelte:fragment>
          </Tooltip>

          {#if $activeTab === 'chat'}
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
              <div data-tooltip-disable>
                <NoteSwitcher selectedChatId={activeNoteId} />
              </div>
            {:else}
              <div data-tooltip-disable>
                <ChatSwitcher
                  selectedChatId={activeSidebarChatId}
                  selectedChat={activeSidebarChat}
                />
              </div>
            {/if}
          {/if}
        </div>
      {:else if $activeTab === 'annotations'}
        <div class="flex items-center gap-2 w-full">
          <h2 class="text-[1.2em] font-[450]">Annotations</h2>
        </div>
      {/if}
    </div>
    <div class="flex-shrink-0 flex items-center gap-2">
      {#if $debugMode}
        <ModelPicker />
      {/if}

      {#if $activeNote}
        <div data-tooltip-target="open-note-as-tab">
          <NoteSettingsMenu
            resource={$activeNote.resource}
            showOnboarding={true}
            on:close-sidebar={() => dispatch('close')}
          />
        </div>
      {/if}
      {#if $userSettings.tabs_orientation === 'vertical'}
        <AppBarButton on:click={handleClose} class="group" data-tooltip-disable>
          <Icon name="sidebar.right" class="group-hover:!hidden" size="1.2rem" />
          <Icon name="close" class="hidden group-hover:!block" size="1.2rem" />
        </AppBarButton>
      {/if}
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
