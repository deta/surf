<script lang="ts" context="module">
  // pretty-ignore
  export type ChatInputSubmitEvent = { query: string; mentions: MentionItem[] }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<script lang="ts">
  import { Editor } from '@horizon/editor'
  import { writable } from 'svelte/store'
  import { Icon } from '@horizon/icons'
  import { createEventDispatcher } from 'svelte'
  import ModelPicker from './ModelPicker.svelte'
  import AppBarButton from '../Browser/AppBarButton.svelte'
  import Tooltip from '../Atoms/Tooltip.svelte'

  const dispatch = createEventDispatcher<{
    submit: ChatInputSubmitEvent
  }>()

  export let loading: boolean = false
  export let viewTransitionName: string | undefined = undefined
  export let mentionItemsFetcher: MentionItemsFetcher | undefined = undefined

  let editor: unknown
  let inputValue: string = ''
  let editorFocused = true
  let selectedMode: unknown = ''
  const chatBoxPlaceholder = writable('Ask me anything')
  const optToggled = writable(false)

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
    const mentions: MentionItem[] = editor.getMentions()
    dispatch('submit', { query: inputValue, mentions })
  }
</script>

<div
  class="chat-input-wrapper flex px-4 py-3 gap-2 shadow-lg items-center"
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
      {mentionItemsFetcher}
      parseMentions
      submitOnEnter
    />
  </div>

  <div class="flex items-center gap-1 relative justify-end -mr-1">
    <ModelPicker />

    <Tooltip side="top">
      <AppBarButton style="opacity: 1;" on:click={handleChatSubmit}>
        {#if loading && !$optToggled}
          <Icon name="spinner" />
        {:else}
          <Icon name="cursor" fill="#FF6426" />
        {/if}
      </AppBarButton>
      <svelte:fragment slot="content">Send message ⏎</svelte:fragment>
    </Tooltip>
    <!--<button
      class="submit-button transform whitespace-nowrap active:scale-95 disabled:opacity-40 appearance-none border-0 group margin-0 flex items-center px-2 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-800 transition-colors duration-200 rounded-xl text-sky-1000 dark:text-gray-100 text-sm"
      on:click={() => {
        selectedMode = 'active'
        handleChatSubmit()
      }}
      data-tooltip-action="send-chat-message"
      data-tooltip-target="send-chat-message"
      disabled={!inputValue || loading}
    >
      {#if loading && !$optToggled}
        <Icon name="spinner" />
      {:else}
        <Icon name="cursor" fill="#FF6426" />
      {/if}
    </button>-->
  </div>
</div>

<style lang="scss">
  .chat-input-wrapper {
    width: 100%;
    background: light-dark(#fff, rgba(24, 24, 24, 1));
    border: 1px solid currentColor;
    border-color: light-dark(rgba(0, 0, 0, 0.125), rgba(255, 255, 255, 0.085));

    border-radius: 1em;
    color: light-dark(#222, #fff);
  }
  .chat-input-wrapper .submit-button {
    :global(body.custom) & {
      background: var(--base-color);
      color: var(--contrast-color);

      &:hover {
        background: color-mix(in hsl, var(--base-color), 15% hsl(0, 0%, 0%));
      }
      :global(body.dark) &:hover {
        background: color-mix(in hsl, var(--base-color), 20% hsl(0, 0%, 100%));
      }
    }
  }
</style>
