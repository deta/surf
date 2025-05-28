<script lang="ts" context="module">
  import type { Icons } from '@horizon/icons'

  export interface PromptPillItem {
    label?: string
    icon?: Icons
    loading?: boolean
    prompt: string
  }
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { startingClass } from '../../../utils/dom'
  import PromptPill from './PromptPill.svelte'

  const dispatch = createEventDispatcher<{
    click: PromptPillItem
  }>()

  export let promptItems: PromptPillItem[] = []

  export let disabled: boolean = false
  export let hide: boolean = false

  export let direction: 'horizontal' | 'vertical' = 'vertical'
</script>

{#key direction}
  <div class="prompt-list direction-{direction}" class:hide>
    {#each promptItems as prompt, i (prompt.prompt.replace(/[^a-zA-Z0-9]/g, ''))}
      <div class="pill-wrapper" style="--delay: {(i + 0) * 75}ms;" use:startingClass={{}}>
        <PromptPill
          label={prompt.label}
          icon={prompt.icon}
          loading={prompt.loading ?? false}
          {disabled}
          {direction}
          on:click={() => dispatch('click', prompt)}
        />
      </div>
    {/each}
    {#if direction === 'horizontal'}
      <div style="width: 6rem; flex-shrink: 0"></div>
    {/if}
  </div>
{/key}

<style lang="scss">
  .prompt-list {
    transition-property: font-size;
    transition-duration: 123ms;
    transition-timing-function: ease-out;

    display: flex;
    gap: 0.5rem;

    padding-top: 0.25rem;
    font-size: 0.85rem;

    &.direction-vertical {
      flex-direction: column;
      font-size: 0.9rem;
    }

    &.direction-horizontal {
      overflow-x: auto;
      padding-bottom: 0.75rem;
    }

    .pill-wrapper {
      transition-property: transform, opacity;
      transition-duration: 100ms;
      transition-delay: var(--delay, 0ms);
      transition-timing-function: ease-out;

      --scale: 1;
      --offset-x: 0px;
      --offset-y: 0px;

      opacity: 1;

      transform-origin: bottom left;
      transform: translate(var(--offset-x), var(--offset-y)) scale(var(--scale));

      &:global(._starting) {
        opacity: 0;
        transform: translate(-1px, 4px);
      }
    }

    &.hide {
      pointer-events: none;
      .pill-wrapper {
        --scale: 0.975;
        --offset-y: 8px;
        opacity: 0;
        pointer-events: none;
      }
    }
  }
</style>
