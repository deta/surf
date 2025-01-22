<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import type { Writable } from 'svelte/store'

  import { Icon } from '@horizon/icons'
  import { horizontalScroll } from '@horizon/utils'

  import type { ChatPrompt } from '@horizon/core/src/lib/service/ai/chat'
  import SuggestionItem from './SuggestionItem.svelte'

  export let generatingPrompts: Writable<boolean>
  export let prompts: Writable<ChatPrompt[]>
  export let showPrompts: boolean = false

  const dispatch = createEventDispatcher<{
    runPrompt: ChatPrompt
    generatePrompts: void
  }>()

  const runPrompt = (prompt: ChatPrompt) => {
    dispatch('runPrompt', prompt)
  }

  const generatePrompts = () => {
    dispatch('generatePrompts')
  }
</script>

<div class="floating-menu" use:horizontalScroll>
  {#if $generatingPrompts}
    <div
      class="text-sky-800 dark:text-gray-100 bg-white dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700"
    >
      <Icon name="spinner" size="16px" />
    </div>
  {:else if $prompts.length > 0 && showPrompts}
    {#each $prompts as prompt (prompt.prompt.replace(/[^a-zA-Z0-9]/g, ''))}
      <SuggestionItem on:click={() => runPrompt(prompt)} label={prompt.label} />
    {/each}
    <!-- {:else}
        <button
            class="text-sky-800 dark:text-gray-100 bg-white rounded-lg p-1 border border-gray-200"
            on:click|preventDefault={() => generatePrompts()}
        >
            <Icon name="sparkles" size="16px" />
        </button>  -->
  {/if}
</div>

<style lang="scss">
  .floating-menu {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    overflow: auto;
    width: 100%;
    padding: 10px 0px;
    scrollbar-width: none;
    -ms-overflow-style: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }
</style>
