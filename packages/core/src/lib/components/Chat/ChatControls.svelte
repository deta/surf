<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { derived, writable } from 'svelte/store'
  import { fade, fly, slide } from 'svelte/transition'

  import { tooltip, useLogScope } from '@horizon/utils'
  import { Icon } from '@horizon/icons'

  import { PageChatUpdateContextEventTrigger } from '@horizon/types'
  import type { App } from '@horizon/backend/types'

  import type { AIChatMessageParsed } from '../../types/browser.types'

  import { useConfig } from '../../service/config'
  import { useTabsManager } from '../../service/tabs'
  import { useAI, type ChatPrompt } from '@horizon/core/src/lib/service/ai/ai'

  import ContextBubbles from './ContextBubbles.svelte'
  import ChatContextTabPicker from './ChatContextTabPicker.svelte'
  import { BUILT_IN_PAGE_PROMPTS } from '../../constants/prompts'
  import PromptItem from './PromptItem.svelte'
  import { SelectDropdown, SelectDropdownItem, type SelectItem } from '../Atoms/SelectDropdown'
  import { ContextManager, type ContextItem } from '@horizon/core/src/lib/service/ai/contextManager'
  import { openDialog } from '../Core/Dialog/Dialog.svelte'
  import { contextMenu } from '../Core/ContextMenu.svelte'
  import ModelPicker from './ModelPicker.svelte'
  import { useSmartNotes, type SmartNote } from '@horizon/core/src/lib/service/ai/note'
  import CreateAiToolDialog from './CreateAiToolDialog.svelte'
  import { quartOut } from 'svelte/easing'
  import { Editor, type MentionItem } from '@horizon/editor'
  import { isGeneratingAI } from '@horizon/core/src/lib/service/ai/generationState'
  import { createMentionsFetcher } from '@horizon/core/src/lib/service/ai/mentions'
  import { useOasis } from '@horizon/core/src/lib/service/oasis'
  import { useResourceManager } from '@horizon/core/src/lib/service/resources'

  export let chatId: string
  export let contextManager: ContextManager
  export let active: boolean = false
  // TDOO: replace with new context store in AI service
  export let preparingTabs: boolean = false
  export let showAddToContext = true
  export let floating: boolean = true
  export let excludeActiveTab: boolean = false
  export let showInput: boolean = false

  const dispatch = createEventDispatcher<{
    'run-prompt': { prompt: ChatPrompt; custom: boolean }
    'open-context-item': ContextItem
    'process-context-item': ContextItem
    submit: { query: string; mentions: MentionItem[] }
    stop: void
  }>()

  const log = useLogScope('ChatControls')
  const config = useConfig()
  const tabsManager = useTabsManager()
  const ai = useAI()
  const oasis = useOasis()
  const resourceManager = useResourceManager()
  const smartNotes = useSmartNotes()

  const tabs = tabsManager.tabs
  const userConfigSettings = config.settings
  const activeTabId = tabsManager.activeTabId
  const customAIApps = ai.customAIApps

  // const { status, error } = chat
  const { items: contextItems, tabsInContext, generatingPrompts, generatedPrompts } = contextManager

  $: responses = writable<AIChatMessageParsed[]>([])

  let showAddPromptDialog = false
  let editor: Editor
  let inputValue: string = ''

  const mentionItemsFetcher = createMentionsFetcher({ oasis, ai, resourceManager })

  const optToggled = writable(false)
  const tabPickerOpen = writable(false)
  const promptSelectorOpen = writable(false)
  const appModalContent = writable<App | null>(null)

  const addPromptItem = {
    id: 'addprompt',
    label: 'Add Prompt',
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

  const visibleContextItems = derived([contextItems], ([$contextItems]) => {
    return $contextItems.filter((item) => item.visibleValue)
  })

  const contextPickerTabs = derived([tabs, tabsInContext], ([tabs, tabsInContext]) => {
    return tabs
      .filter((e) => !tabsInContext.find((i) => i.id === e.id))
      .sort((a, b) => b.index - a.index)
  })

  const showExamplePrompts = derived(
    [tabsInContext, activeTabId, userConfigSettings],
    ([tabsInContext, activeTabId, userConfigSettings]) => {
      if (!userConfigSettings.automatic_chat_prompt_generation) {
        return false
      }

      const tab = tabsInContext.find((tab) => tab.id === activeTabId)

      if (!tab || tab.type !== 'page') {
        return false
      }

      return true
    }
  )

  $: filteredExamplePrompts = derived(
    [generatedPrompts, responses],
    ([$generatedPrompts, $responses]) => {
      return $generatedPrompts.filter((prompt) => {
        return (
          !$responses.find(
            (response) => response.query === prompt.prompt || response.query === prompt.label
          ) &&
          BUILT_IN_PAGE_PROMPTS.find(
            (p) => p.label.toLowerCase() === prompt.label.toLowerCase()
          ) === undefined
        )
      })
    }
  )

  $: filteredBuiltInPrompts = derived([responses], ([$responses]) => {
    return BUILT_IN_PAGE_PROMPTS.filter((prompt) => {
      return !$responses.find(
        (response) => response.query === prompt.prompt || response.query === prompt.label
      )
    })
  })

  const handleRemoveContextItem = (e: CustomEvent<string>) => {
    const id = e.detail
    log.debug('Removing context item', id)
    contextManager.removeContextItem(id, PageChatUpdateContextEventTrigger.ChatContextItem)
  }

  const handleSelectContextItem = async (e: CustomEvent<string>) => {
    const id = e.detail
    const contextItem = contextManager.getItem(id)
    if (!contextItem) {
      log.error('Context item not found', id)
      return
    }

    dispatch('open-context-item', contextItem)
  }

  const handleRetryContextItem = async (e: CustomEvent<string>) => {
    const id = e.detail
    log.debug('Retrying context item', id)
    const contextItem = contextManager.getItem(id)
    if (!contextItem) {
      log.error('Context item not found', id)
      return
    }

    dispatch('process-context-item', contextItem)
  }

  const runPrompt = async (prompt: ChatPrompt, custom: boolean = false) => {
    dispatch('run-prompt', { prompt, custom })
  }

  const handleInputSubmit = () => {
    if (!editor) return

    if ($isGeneratingAI) {
      log.debug('Already generating AI response')
      dispatch('stop')
      return
    }

    if (!inputValue) return

    const mentions = editor.getMentions()
    dispatch('submit', { query: inputValue, mentions })

    inputValue = ''
    editor.clear()
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
  <div
    id="tool-dialog"
    class="absolute inset-0 z-50 flex items-end justify-start pb-[14rem] pl-8"
    style="background: rgba(0 0 0 / 0.2);"
    transition:fade={{ duration: 133, easing: quartOut }}
  >
    <CreateAiToolDialog
      bind:show={showAddPromptDialog}
      app={appModalContent}
      on:added={() => ($promptSelectorOpen = true)}
    />
  </div>
{/if}

<div
  class="{floating
    ? 'bg-gradient-to-t from-sky-300/20 via-sky-300/10 dark:from-gray-800/20 dark:via-gray-800/10 to-transparent mx-auto absolute bottom-0 shadow-xl px-4'
    : ''} w-full rounded-xl flex flex-col pb-4"
  style:view-transition-name="chat-{chatId}-input"
>
  <div class="overflow-hidden suggestion-items flex items-center">
    <div
      in:fly={{ y: 200 }}
      class="suggestions-wrapper flex items-center {$userConfigSettings.experimental_notes_chat_input &&
      $userConfigSettings.experimental_notes_chat_sidebar
        ? 'pl-5 pr-5'
        : 'px-1'} mb-2 w-full z-0 overflow-auto no-scrollbar"
    >
      <SelectDropdown
        items={promptItems}
        search="disabled"
        selected={null}
        footerItem={addPromptItem}
        open={promptSelectorOpen}
        side="top"
        closeOnMouseLeave={false}
        keepHeightWhileSearching
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
        <button
          use:tooltip={{
            text: 'Add a Prompt',
            position: 'right',
            disabled: $promptItems.length > 0
          }}
          class="flex-shrink-0 max-w-64 flex items-center justify-center gap-1 {$promptItems.length >
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
              <Icon name="chevron.up" />
            {:else}
              <Icon name="chevron.down" />
            {/if}
            <div class="text-sky-800 dark:text-gray-100 w-full truncate font-medium">Saved</div>
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
        </button>

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

      {#if $showExamplePrompts && ($filteredBuiltInPrompts.length > 0 || $filteredExamplePrompts.length > 0 || $generatingPrompts)}
        {#each $filteredBuiltInPrompts as prompt (prompt.prompt.replace(/[^a-zA-Z0-9]/g, ''))}
          <PromptItem on:click={() => runPrompt(prompt)} label={prompt.label} />
        {/each}

        {#if $generatingPrompts}
          <PromptItem label="Analysing Page…" icon="spinner" />
        {:else if $filteredExamplePrompts.length > 0}
          {#each $filteredExamplePrompts as prompt (prompt.prompt.replace(/[^a-zA-Z0-9]/g, ''))}
            <PromptItem on:click={() => runPrompt(prompt)} label={prompt.label} />
          {/each}
        {/if}
      {/if}
    </div>
  </div>

  <div
    class="chat-components"
    class:no-items={$visibleContextItems.length === 0}
    class:has-items={$visibleContextItems.length > 0}
    class:floating
    class:experimental={$userConfigSettings.experimental_notes_chat_input &&
      $userConfigSettings.experimental_notes_chat_sidebar}
  >
    <div class="chat-components-content" class:no-items={$visibleContextItems.length === 0}>
      {#if preparingTabs}
        <div
          transition:slide={{ duration: 150, axis: 'y' }}
          class="err flex w-full bg-blue-50 dark:bg-gray-800 border-t-blue-300 dark:border-t-gray-700 border-l-blue-300 dark:border-l-gray-700 border-r-blue-300 dark:border-r-gray-700 border-[1px] border-b-0 p-2 gap-4 shadow-sm mx-8 rounded-t-xl text-lg leading-relaxed text-blue-800/60 dark:text-gray-100/60 relative"
        >
          Preparing tabs for the chat…
        </div>
      {:else if $visibleContextItems.length}
        {#if !$optToggled}
          <div
            class="flex w-full relative"
            transition:slide={{ duration: 150, axis: 'y', delay: 350 }}
            data-tooltip-target="context-bar"
          >
            <div class="context-bar">
              <ContextBubbles
                {contextManager}
                on:select={handleSelectContextItem}
                on:remove-item={handleRemoveContextItem}
                on:retry={handleRetryContextItem}
              />
            </div>
          </div>
        {/if}
      {:else}
        <div class="w-full"></div>
      {/if}

      <div class="controls-wrapper">
        <slot></slot>

        <div
          class="context-controls"
          class:no-items={$visibleContextItems.length === 0}
          class:has-items={$visibleContextItems.length > 0}
        >
          {#if $tabPickerOpen}
            <ChatContextTabPicker
              tabs={contextPickerTabs}
              {excludeActiveTab}
              {contextManager}
              on:close={() => {
                $tabPickerOpen = false
              }}
            />
          {/if}

          {#if showAddToContext}
            <button
              disabled={$tabs.filter((e) => !$tabsInContext.includes(e)).length <= 0}
              popovertarget="chat-add-context-tabs"
              class="open-tab-picker disabled:opacity-40 disabled:cursor-not-allowed transform whitespace-nowrap active:scale-95 appearance-none border-0 group margin-0 flex items-center px-2 py-2 hover:bg-sky-200 dark:hover:bg-gray-800 transition-colors duration-200 rounded-xl text-sky-1000 dark:text-gray-100 text-sm"
              on:click={(e) => {
                $tabPickerOpen = !$tabPickerOpen
              }}
              use:tooltip={{
                text: 'Add tab',
                position: 'left'
              }}
            >
              <Icon name={'add'} size={'18px'} className="opacity-60" />
            </button>
          {/if}

          <ModelPicker />
        </div>
      </div>
    </div>

    {#if showInput}
      <div class="input-wrapper" class:has-context={$visibleContextItems.length > 0}>
        <div class="flex-grow overflow-y-auto max-h-64">
          <Editor
            bind:this={editor}
            bind:content={inputValue}
            on:submit={handleInputSubmit}
            {mentionItemsFetcher}
            autofocus={true}
            submitOnEnter
            parseMentions
            placeholder="Ask something..."
          />
        </div>

        <div>
          <button
            class="submit-button transform whitespace-nowrap active:scale-95 disabled:opacity-30 appearance-none border-0 group margin-0 flex aspect-square items-center px-2 py-2 bg-sky-300 dark:bg-gray-800 hover:bg-sky-200 dark:hover:bg-gray-800 transition-colors duration-200 rounded-lg text-sky-1000 dark:text-gray-100 text-sm"
            on:click={handleInputSubmit}
            data-tooltip-action="send-chat-message"
            data-tooltip-target="send-chat-message"
            disabled={!inputValue && !$isGeneratingAI}
          >
            {#if $isGeneratingAI}
              <Icon name="spinner" />
            {:else}
              <div class="rotate-90"><Icon name="arrow.left" /></div>
            {/if}
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  :global(#magic-chat[data-drag-target]) {
    outline: 2px dashed gray;
    outline-offset: -2px;
  }

  :global(.chat-message-content h2) {
    font-size: 1.4rem;
    margin-top: 1rem !important;
    margin-bottom: 0.5rem !important;
  }

  .chat-components {
    position: relative;
    // margin: 0 1rem;
    border: 0.5px solid #58688460;
    border-radius: 18px;
    background: white;
    margin: 0 1rem;

    &.no-items {
      border: 0;
      box-shadow: none;
      background: transparent;
    }

    :global(.dark) & {
      background: #181818;
    }

    &.experimental {
      .chat-components-content {
        padding: 0rem 0.75rem 0 0;
      }
      outline: 1px solid rgba(126, 168, 240, 0.05);
      background: radial-gradient(
        143.56% 143.56% at 50% -43.39%,
        #f3f6fa 0%,
        #f0f3f7 50%,
        #e0e9f1 100%
      );
      box-shadow:
        inset 0px 1px 1px -1px white,
        inset 0px -1px 1px -1px white,
        inset 0px 30px 20px -20px rgba(255, 255, 255, 0.15),
        0px 0px 89px 0px rgba(0, 0, 0, 0.12),
        0px 4px 18px 0px rgba(0, 0, 0, 0.12),
        0px 1px 1px 0px rgba(126, 168, 240, 0.1),
        0px 4px 4px 0px rgba(126, 168, 240, 0.05);

      :global(.dark) & {
        background: #181818;
      }
    }

    &.no-items {
      outline: 0;
      border: 0;
      box-shadow: none;
      background: transparent;
    }

    :global(.dark) & {
      background: radial-gradient(
        143.56% 143.56% at 50% -43.39%,
        #1a1f2d 0%,
        #181c28 50%,
        #111827 100%
      ) !important;
    }

    &.floating {
      outline: 1px solid rgba(126, 168, 240, 0.05);

      background: radial-gradient(
        143.56% 143.56% at 50% -43.39%,
        #f3f6fa 0%,
        #f0f3f7 50%,
        #e0e9f1 100%
      );

      box-shadow:
        inset 0px 1px 1px -1px white,
        inset 0px -1px 1px -1px white,
        inset 0px 30px 20px -20px rgba(255, 255, 255, 0.15),
        0px 0px 89px 0px rgba(0, 0, 0, 0.12),
        0px 4px 18px 0px rgba(0, 0, 0, 0.12),
        0px 1px 1px 0px rgba(126, 168, 240, 0.1),
        0px 4px 4px 0px rgba(126, 168, 240, 0.05);
    }
  }

  .chat-components-content {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 7px 7px 7px 7px;
    &.no-items {
      padding: 0;
      bottom: 2rem;
      outline: 0;
      border: 0;
      box-shadow: none;
      background: transparent;
      .controls-wrapper {
        position: relative;
        bottom: 1.5rem;
        right: 1rem;
      }
    }
  }

  .controls-wrapper {
    display: flex;
    align-items: center;
  }

  .context-bar {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;

    .experimental & {
      margin-top: 0.5rem;
    }
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
    padding-left: 1rem;
    padding-right: 1rem;

    & > :first-child {
      border-radius: 8px 0 0 8px;
    }

    & > :not(:first-child):not(:last-child) {
      border-radius: 0;
    }

    & > :last-child {
      border-radius: 0 8px 8px 0;
    }

    .experimental & {
      margin-bottom: 0.75rem;
      padding-right: 5px !important;
    }
  }

  .input-wrapper {
    display: flex;
    background: #f8fafc;
    border: 1px solid #58688460;
    border-radius: 2xl;
    padding: 0.75rem 1rem;
    gap: 2px;

    :global(.dark) & {
      background: #1f2937;
    }

    .experimental & {
      margin: 0 0.55rem 0.55rem 0.55rem;
      padding: 0.65rem 0.65rem 0.65rem 1rem;
      border-radius: 0 11px 11px 11px;
      background: #fff;
      border: none;
      box-shadow:
        0px 13px 4px 0px color(display-p3 0.0078 0.2118 0.3804 / 0),
        0px 8px 3px 0px color(display-p3 0.0078 0.2118 0.3804 / 0.01),
        0px 5px 3px 0px color(display-p3 0.0078 0.2118 0.3804 / 0.03),
        0px 2px 2px 0px color(display-p3 0.0078 0.2118 0.3804 / 0.05),
        0px 1px 1px 0px color(display-p3 0.0078 0.2118 0.3804 / 0.06);

      &:not(.has-context) {
        margin: 0;
        outline: 1px solid rgba(0, 0, 0, 0.09);
        border-radius: 11px;
      }

      :global(.dark) & {
        background: #1f2937;
      }
    }
  }
</style>
