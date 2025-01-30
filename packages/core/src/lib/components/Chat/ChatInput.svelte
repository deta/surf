<!-- svelte-ignore a11y-no-static-element-interactions -->
<script lang="ts">
  import { Editor } from '@horizon/editor'
  import { derived, writable } from 'svelte/store'
  import { Icon } from '@horizon/icons'
  import type { AIChat } from '../../service/ai/chat'
  import { SelectDropdown, type SelectItem } from '../Atoms/SelectDropdown'
  import { useAI } from '../../service/ai/ai'
  import { useLogScope } from '@horizon/utils'
  import { createEventDispatcher } from 'svelte'

  const dispatch = createEventDispatcher<{
    submit: string
  }>()

  export let chat: AIChat
  export let viewTransitionName: string | undefined = undefined

  const log = useLogScope('ChatInput')
  const ai = useAI()

  const { contextManager, contextItems, responses, status, error } = chat

  let editor: unknown
  let inputValue: string = ''
  let editorFocused = true
  let selectedMode: unknown = ''
  const chatBoxPlaceholder = writable('Ask me anything')
  const optToggled = writable(false)
  const modelSelectorOpen = writable(false)

  const selectConfigureItem = {
    id: 'configure',
    label: 'Configure Models',
    icon: 'settings'
  } as SelectItem

  const modelItems = derived([ai.models], ([models]) => {
    return models.map(
      (model) =>
        ({
          id: model.id,
          label: model.label,
          icon: model.icon
        }) as SelectItem
    )
  })

  const selectedModelItem = derived(
    [ai.selectedModelId, modelItems],
    ([selectedModelId, modelItems]) => {
      const model = modelItems.find((model) => model.id === selectedModelId)
      if (!model) return null

      return model
    }
  )

  const openModelSettings = () => {
    // window.api.openSettings('ai')
    window.api.openSettings()
  }

  const handleModelSelect = async (e: CustomEvent<string>) => {
    const modelId = e.detail
    log.debug('Selected model', modelId)

    if (modelId === 'configure') {
      openModelSettings()
      modelSelectorOpen.set(false)
      return
    }

    await ai.changeSelectedModel(modelId)
    modelSelectorOpen.set(false)
  }

  const optPressed = writable(false)
  const cmdPressed = writable(false)
  const shiftPressed = writable(false)
  const aPressed = writable(false)

  function handleInputKeydown(e: KeyboardEvent) {
    if (e.key === 'Alt' || e.key === 'Option') {
      $optPressed = true
    } else if (e.key === 'Meta' || e.key === 'Control') {
      $cmdPressed = true
    } else if (e.key === 'Shift') {
      shiftPressed.set(true)
    } else if (e.key.toLowerCase() === 'a') {
      aPressed.set(true)
    } else if (e.key === 'Enter' && (!$shiftPressed || $cmdPressed)) {
      if (inputValue !== '') {
        handleChatSubmit()
      }
    }
  }
  function handleInputKeyup(e: KeyboardEvent) {
    if (e.key === 'Alt' || e.key === 'Option') {
      $optPressed = false
    } else if (e.key === 'Meta' || e.key === 'Control') {
      $cmdPressed = false
    } else if (e.key === 'Shift') {
      $shiftPressed = false
    } else if (e.key.toLowerCase() === 'a') {
      $aPressed = false
    }
  }

  function handleChatSubmit() {
    dispatch('submit', inputValue)
  }
</script>

<div
  class="chat-input-wrapper flex bg-sky-50 dark:bg-gray-700 border-blue-300 dark:border-gray-600 border-[1px] px-4 py-3 gap-2 shadow-lg items-center"
  on:keydown={handleInputKeydown}
  on:keyup={handleInputKeyup}
  style:view-transition-name={viewTransitionName}
>
  <div class="flex-grow overflow-y-auto max-h-64">
    <Editor
      bind:this={editor}
      bind:content={inputValue}
      bind:focused={editorFocused}
      autofocus={true}
      placeholder={$chatBoxPlaceholder}
    />
  </div>

  <div class="flex items-center gap-2 relative justify-end">
    <!--{#if $tabPickerOpen}
      <ChatContextTabPicker
        tabs={contextPickerTabs}
        {contextManager}
        on:close={() => {
          $tabPickerOpen = false
          if (editor) {
            editor.focus()
          }
        }}
      />
    {/if}-->

    <!--{#if showAddToContext}
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
    {/if}-->

    <SelectDropdown
      items={modelItems}
      search="disabled"
      selected={$selectedModelItem ? $selectedModelItem.id : null}
      footerItem={selectConfigureItem}
      open={modelSelectorOpen}
      side="top"
      closeOnMouseLeave={false}
      keepHeightWhileSearching
      on:select={handleModelSelect}
    >
      <button
        class="transform whitespace-nowrap active:scale-95 disabled:opacity-10 appearance-none border-0 group margin-0 flex items-center px-2 py-2 hover:bg-sky-200 dark:hover:bg-gray-800 transition-colors duration-200 rounded-xl text-sky-1000 dark:text-gray-100 text-sm"
      >
        {#if $selectedModelItem}
          <Icon name={$selectedModelItem.icon} />
        {:else}
          <Icon name="settings" className="opacity-60" />
        {/if}
      </button>
    </SelectDropdown>

    <button
      class="submit-button transform whitespace-nowrap active:scale-95 disabled:opacity-40 appearance-none border-0 group margin-0 flex items-center px-2 py-2 bg-sky-300 dark:bg-gray-800 hover:bg-sky-200 dark:hover:bg-gray-800 transition-colors duration-200 rounded-xl text-sky-1000 dark:text-gray-100 text-sm"
      on:click={() => {
        selectedMode = 'active'
        handleChatSubmit()
      }}
      data-tooltip-action="send-chat-message"
      data-tooltip-target="send-chat-message"
      disabled={!inputValue || $status === 'running'}
    >
      {#if $status === 'running' && !$optToggled}
        <Icon name="spinner" />
      {:else}
        <div class="rotate-90"><Icon name="arrow.left" /></div>
      {/if}
    </button>
  </div>
</div>

<style lang="scss">
  .chat-input-wrapper {
    width: 100%;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 1em;
    --text-color-dark: #222;
  }
  .chat-input-wrapper .submit-button {
    :global(body.custom) & {
      background: var(--base-color);
      color: var(--contrast-color);

      &:hover {
        background: color-mix(in hsl, var(--base-color), 15% hsl(0, 0, 0%));
      }
      :global(body.dark) &:hover {
        background: color-mix(in hsl, var(--base-color), 20% hsl(0, 0, 100%));
      }
    }
  }
</style>
