<script lang="ts">
  import RollingNumber from '@horizon/core/src/lib/components/Atoms/RollingNumber.svelte'
  import { Icon } from '@horizon/icons'
  import { createEventDispatcher } from 'svelte'
  import { derived, type Readable } from 'svelte/store'

  export let canGoPrev: Readable<boolean>
  export let canGoNext: Readable<boolean>
  export let idx: Readable<number>
  export let total: number
  export let title: string | undefined = undefined

  $: titleToShow = title || 'Intro to Surf Notes'

  const dispatch = createEventDispatcher<{
    next: void
    prev: void
  }>()

  const value = derived(idx, ($idx) => $idx + 1)
</script>

<div class="wrapper">
  <button on:click={() => dispatch('prev')} disabled={!$canGoPrev}>
    {#if $canGoPrev}
      <Icon name="arrow.left" />
    {:else}
      <Icon name="arrow.left" style="opacity: 0;" />
    {/if}
  </button>

  <div class="content">
    <div class="text">{titleToShow}</div>

    <div class="steps">
      Step <RollingNumber {value} pad={0} /> of {total} steps
    </div>
  </div>

  <button on:click={() => dispatch('next')} disabled={!$canGoNext}>
    {#if $canGoNext}
      <Icon name="arrow.right" />
    {:else}
      <Icon name="check" />
    {/if}
  </button>
</div>

<style lang="scss">
  .wrapper {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5rem;
    color: var(--text);
    background: var(--background-dark-p3);
    border: var(--border-width) solid var(--border-color);
    outline: 1px solid rgba(126, 168, 240, 0.05);
    border-radius: 12px;
    box-shadow:
      inset 0px 1px 1px -1px white,
      inset 0px -1px 1px -1px white,
      inset 0px 30px 20px -20px rgba(255, 255, 255, 0.15),
      0px 0px 89px 0px rgba(0, 0, 0, 0.18),
      0px 4px 18px 0px rgba(0, 0, 0, 0.18),
      0px 1px 1px 0px rgba(126, 168, 240, 0.3),
      0px 4px 4px 0px rgba(126, 168, 240, 0.15);

    // :global(.dark) & {
    //     background: #272727;
    //     border: 1px solid #333;
    // }
  }

  .content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
    padding: 0 3rem;
  }

  .text {
    font-size: 1.1em;
    font-weight: 500;
  }

  .steps {
    font-size: 0.9em;
    color: var(--text);
    opacity: 0.75;
    font-variant-numeric: tabular-nums;
  }

  button {
    background: none;
    border: none;
    padding: 0.25rem;
    border-radius: 8px;
    transition: background 0.2s;

    &:hover {
      background: color(display-p3 0.5294 0.6549 0.9176 / 0.15);
    }

    // :global(.dark) & {
    //     background: #272727;
    //     color: #fff;

    //     &:hover {
    //         background: #3b3b3b;
    //     }
    // }

    &:disabled {
      opacity: 0.35;

      &:hover {
        background: none;
      }
    }
  }
</style>
