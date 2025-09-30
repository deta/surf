<script lang="ts" context="module">
  import type { Icons } from '@deta/icons'

  export interface PromptPillItem {
    label?: string
    icon?: Icons
    loading?: boolean
    prompt: string
  }
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { startingClass } from '@deta/utils/dom'
  import PromptPill from './PromptPill.svelte'

  const dispatch = createEventDispatcher<{
    click: PromptPillItem
  }>()

  export let promptItems: PromptPillItem[] = []

  export let disabled: boolean = false
  export let hide: boolean = false

  export let direction: 'horizontal' | 'vertical' = 'vertical'
  export let maxHorizontalItems: number = 5

  $: visibleItems =
    direction === 'horizontal' ? promptItems.slice(0, maxHorizontalItems) : promptItems
</script>

{#key direction}
  <div class="prompt-list direction-{direction}" class:hide>
    {#each visibleItems as prompt, i (prompt.prompt.replace(/[^a-zA-Z0-9]/g, ''))}
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
      flex-wrap: nowrap;
      overflow: hidden;
      gap: 0.375rem;
      font-size: 0.75rem;
      padding-top: 0.125rem;
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
