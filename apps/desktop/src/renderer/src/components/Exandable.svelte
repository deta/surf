<script lang="ts">
  import { Icon } from '@horizon/icons'
  import { slide } from 'svelte/transition'

  export let title: string | undefined = undefined
  export let expanded = false

  function handleClick() {
    expanded = !expanded
  }
</script>

<section class="wrapper">
  <!-- svelte-ignore a11y-interactive-supports-focus a11y-click-events-have-key-events -->
  <div on:click={handleClick} role="button" class="title">
    {#if expanded}
      <Icon name="chevron.down" size="22" />
    {:else}
      <Icon name="chevron.right" size="22" />
    {/if}

    <h1>{title}</h1>
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
    color: var(--color-text);
  }

  .title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;

    h1 {
      font-size: 1.1rem;
      font-weight: 500;
      color: var(--color-text);
    }
  }

  .content {
    margin-top: 0.5rem;
    padding-left: 2.2rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
</style>
