<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { derived, writable } from 'svelte/store'
  import { fade } from 'svelte/transition'

  import { useLogScope } from '@deta/utils/io'

  import type { App } from '@deta/backend/types'

  import { useConfig } from '../../service/config'
  import { useAI, type ChatPrompt } from '@horizon/core/src/lib/service/ai/ai'

  import { SelectDropdown, SelectDropdownItem, type SelectItem } from '../Atoms/SelectDropdown'
  import { ContextManager, type ContextItem } from '@horizon/core/src/lib/service/ai/contextManager'
  import { openDialog } from '../Core/Dialog/Dialog.svelte'
  import { contextMenu } from '../Core/ContextMenu.svelte'
  import { quartOut } from 'svelte/easing'
  import { type MentionItem } from '@deta/editor'
  import CreateAiToolDialog from '../Chat/CreateAiToolDialog.svelte'
  import Tooltip from '../Atoms/Tooltip.svelte'

  export let contextManager: ContextManager
  export let active: boolean = false
  // TDOO: replace with new context store in AI service
  export let promptSelectorOpen = writable(false)
  export let direction: string = 'top'

  const dispatch = createEventDispatcher<{
    'run-prompt': { prompt: ChatPrompt; custom: boolean }
    'open-context-item': ContextItem
    'process-context-item': ContextItem
    submit: { query: string; mentions: MentionItem[] }
  }>()

  const log = useLogScope('NoteInputSavedPrompts')
  const config = useConfig()
  const ai = useAI()

  const userConfigSettings = config.settings
  const customAIApps = ai.customAIApps

  let showAddPromptDialog = false

  const appModalContent = writable<App | null>(null)

  const addPromptItem = {
    id: 'addprompt',
    label: 'Add Custom Prompt',
    icon: 'add'
  } as SelectItem

  const promptItems = derived([ai.customAIApps], ([customAiApps]) => {
    return customAiApps.map(
      (app) =>
        ({
          id: app.id,
          label: app.name,
          icon: app.icon
        }) as SelectItem
    )
  })

  const runPrompt = async (prompt: ChatPrompt, custom: boolean = false) => {
    dispatch('run-prompt', { prompt, custom })
  }

  onMount(() => {
    log.debug('mounted', contextManager, contextManager.key)

    const showChatSidebar = ai.showChatSidebarValue
    const autoGeneratePrompts = ai.config.settingsValue.automatic_chat_prompt_generation

    if (showChatSidebar && autoGeneratePrompts && active) {
      log.debug('Generating prompts...', contextManager.key)
      contextManager.generatePrompts()
    }
  })
</script>

{#if showAddPromptDialog}
  <div id="tool-dialog" class={direction} transition:fade={{ duration: 133, easing: quartOut }}>
    <div>
      <CreateAiToolDialog
        bind:show={showAddPromptDialog}
        app={appModalContent}
        on:added={() => ($promptSelectorOpen = true)}
      />
    </div>
  </div>
{/if}

<div class="saved-prompts overflow-hidden suggestion-items flex items-center">
  <div
    class="suggestions-wrapper flex items-center {$userConfigSettings.experimental_notes_chat_input &&
    $userConfigSettings.experimental_notes_chat_sidebar
      ? ''
      : 'px-1'}  w-full z-0"
  >
    <SelectDropdown
      items={promptItems}
      search="disabled"
      selected={null}
      footerItem={addPromptItem}
      open={promptSelectorOpen}
      side={direction}
      closeOnMouseLeave={false}
      keepHeightWhileSearching
      emptyPlaceholder={'No custom prompts found'}
      on:select={(e) => {
        if (e.detail === addPromptItem.id) {
          appModalContent.set(null)
          showAddPromptDialog = true
          return
        }
        const app = $customAIApps.find((app) => app.id === e.detail)
        if (!app) return
        runPrompt(
          {
            label: app.name ?? '',
            prompt: (app.content || app.name) ?? ''
          },
          true
        )
      }}
    >
      <Tooltip side="left">
        <slot />
        <svelte:fragment slot="content">Custom Prompts</svelte:fragment>
      </Tooltip>

      <!--<button
        use:tooltip={{
          text: 'Add a Prompt',
          position: 'right',
          disabled: $promptItems.length > 0
        }}
        class="saved-prompts-trigger flex-shrink-0 max-w-64 flex items-center justify-center gap-1 {$promptItems.length >
          0 ||
        !(
          $showExamplePrompts &&
          ($filteredBuiltInPrompts.length > 0 ||
            $filteredExamplePrompts.length > 0 ||
            $generatingPrompts)
        )
          ? 'px-2 py-1'
          : 'px-1.5 py-1.5 aspect-square'} w-fit rounded-xl transition-colors text-sky-800 bg-white dark:border-gray-700 dark:text-gray-100 hover:bg-blue-100 dark:bg-gray-800 dark:hover:bg-gray-700 border-[0.5px] border-black/[0.12] select-none"
        on:click={(e) => {
          if ($promptItems.length === 0) {
            e.preventDefault()
            e.stopPropagation()
            appModalContent.set(null)
            showAddPromptDialog = true
          }
        }}
      >
        {#if $promptItems.length > 0}
          {#if $promptSelectorOpen}
            <Icon name="chevron.right" />
          {:else}
            <Icon name="chevron.left" />
          {/if}
          <div class="text-sky-800 dark:text-gray-100 w-full truncate font-medium">Prompts</div>
        {:else}
          {#if $promptSelectorOpen}
            <Icon name="close" />
          {:else}
            <Icon name="add" />
          {/if}

          {#if !($showExamplePrompts && ($filteredBuiltInPrompts.length > 0 || $filteredExamplePrompts.length > 0 || $generatingPrompts))}
            Add Prompt
          {/if}
        {/if}
      </button>-->

      <div
        slot="item"
        class="w-full"
        let:item
        use:contextMenu={{
          canOpen: item?.data,
          items: [
            {
              type: 'action',
              text: 'Edit',
              icon: 'edit',
              action: () => {
                const app = $customAIApps.find((app) => app.id === item.id)
                if (!app) return
                appModalContent.set(app)
                showAddPromptDialog = true
              }
            },
            {
              type: 'action',
              kind: 'danger',
              text: 'Delete',
              icon: 'trash',
              action: async () => {
                if (!item) return
                const { closeType: confirmed } = await openDialog({
                  message: `Are you sure you want to delete the prompt "${item.label}"?`
                })
                if (confirmed) ai.deleteCustomAiApp(item.id)
                promptSelectorOpen.set(true)
              }
            }
          ]
        }}
      >
        <SelectDropdownItem {item} />
      </div>
    </SelectDropdown>
  </div>
</div>

<style lang="scss">
  :global(#magic-chat[data-drag-target]) {
    outline: 2px dashed gray;
    outline-offset: -2px;
  }

  #tool-dialog {
    > div {
      position: fixed;
      z-index: 1001;

      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }

    &::before {
      z-index: 100;
      content: '';
      background: rgba(0, 0, 0, 0.05);
      backdrop-filter: blur(0.8px);
      position: fixed;
      inset: 0;
    }
  }

  :global(.chat-message-content h2) {
    font-size: 1.4rem;
    margin-top: 1rem !important;
    margin-bottom: 0.5rem !important;
  }

  .context-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    &.no-items {
      height: 0;
      padding: 0;
      background: transparent;
    }
  }

  .suggestions-wrapper {
    gap: 4px;
    margin-bottom: 0.5rem;

    & > :first-child {
      border-radius: 8px 0 0 8px;
    }

    & > :not(:first-child):not(:last-child) {
      border-radius: 0;
    }

    & > :last-child {
      border-radius: 0 8px 8px 0;
    }
  }
</style>
