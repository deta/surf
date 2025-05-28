<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import type { Writable } from 'svelte/store'

  import { Icon } from '@horizon/icons'
  import { horizontalScroll } from '@horizon/utils'

  import type { ChatPrompt } from '@horizon/core/src/lib/service/ai/chat'
  import SuggestionItem from './SuggestionItem.svelte'
  import PromptItem from '../PromptItem.svelte'
  import { startingClass } from '../../../utils/dom'

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
  <div class="prompt-list">
    {#if $generatingPrompts}
      <div class="loading-prompts-indicator">
        <span>Analyzing input</span>
      </div>
    {:else if $prompts.length > 0 && showPrompts}
      {#each $prompts.sort((a, b) => a.label.length - b.label.length) as prompt, i (prompt.prompt.replace(/[^a-zA-Z0-9]/g, ''))}
        <!--<SuggestionItem on:click={() => runPrompt(prompt)} label={prompt.label} />-->
        <div class="prompt-wrapper" style="--delay: {i * 85}ms;" use:startingClass={{}}>
          <PromptItem on:click={() => runPrompt(prompt)} label={prompt.label} />
        </div>
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
</div>

<style lang="scss">
  .floating-menu {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    overflow: auto;
    width: 100%;
    border-radius: 0.75rem;
    scrollbar-width: none;
    -ms-overflow-style: none;
    &::-webkit-scrollbar {
      display: none;
    }
    background: #fff;

    .prompt-list {
      display: flex;
      flex-direction: column;
      gap: 1ch;
      margin-bottom: 2ch;
      font-size: 0.8em;

      .loading-prompts-indicator {
        @keyframes pulse {
          0% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
          100% {
            opacity: 1;
          }
        }

        display: flex;
        align-items: center;
        padding: 0.35rem 0.85rem;
        gap: 1ch;
        color: light-dark(#777, #bbb);
        font-weight: 400;
        background: rgba(0, 0, 0, 0.035);
        width: fit-content;
        border-radius: 0.75rem;
        animation: pulse 2s infinite;
      }

      .prompt-wrapper {
        width: fit-content;

        transition-property: transform, opacity;
        transition-duration: 223ms;
        transition-delay: var(--delay, 0);
        transition-timing-function: ease-out;

        &:global(._starting) {
          opacity: 0;
          transform: translate(-1px, 4px);
        }

        opacity: 1;
        transform: translate(0, 0);
      }
    }
  }
</style>
