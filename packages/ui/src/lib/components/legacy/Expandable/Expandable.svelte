<script lang="ts">
  import { Icon } from '@deta/icons'
  import { slide } from 'svelte/transition'

  export let title: string | undefined = undefined
  export let expanded = false

  function handleClick() {
    expanded = !expanded
  }
</script>

<section class="wrapper">
  <!-- svelte-ignore a11y-interactive-supports-focus a11y-click-events-have-key-events -->

  <div class="header">
    <div on:click={handleClick} role="button" class="title">
      {#if expanded}
        <Icon name="chevron.down" size="22" />
      {:else}
        <Icon name="chevron.right" size="22" />
      {/if}

    <slot name="pre-title"></slot>
      <h1>{title} <slot name="title"></slot></h1>

    </div>

    <slot name="header"></slot>
  </div>

  {#if expanded}
    <div class="content" transition:slide>
      <slot></slot>
    </div>
  {/if}
</section>

<style lang="scss">
  .wrapper {
    width: 100%;
    overflow: hidden;
    border-radius: 0.5rem;
    color: light-dark(var(--color-text), var(--on-surface-dark, #cbd5f5));
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .title {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    h1 {
      font-size: 1.1rem;
      font-weight: 500;
      color: light-dark(var(--color-text), var(--on-surface-dark, #cbd5f5));
    }
  }

  .content {
    margin-top: 0.75rem;
    padding-left: 2.2rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
</style>
