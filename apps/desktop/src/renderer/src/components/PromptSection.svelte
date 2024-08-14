<script lang="ts">
  import { Icon } from '@horizon/icons'
  import { fade, slide } from 'svelte/transition'

  export let title: string
  export let description: string
  export let image: string | undefined = undefined
  export let expanded = false

  function handleClick() {
    expanded = !expanded
  }
</script>

<section class="wrapper">
  <!-- svelte-ignore a11y-interactive-supports-focus a11y-click-events-have-key-events -->
  <div on:click={handleClick} role="button" class="info">
    <div class="left">
      {#if image}
        <img src={image} alt={title} />
      {/if}

      <div class="title">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>

    {#if expanded}
      <Icon name="chevron.up" size="24" />
    {:else}
      <Icon name="chevron.down" size="24" />
    {/if}
  </div>

  {#if expanded}
    <div class="content-wrapper" transition:slide>
      <slot />
    </div>
  {/if}
</section>

<style lang="scss">
  .wrapper {
    padding: 0.75rem;
    padding-right: 1.5rem;
    border-radius: 12px;
    background: var(--color-background);
    color: var(--color-text);
    position: relative;

    p {
      font-size: 1.1rem;
      color: var(--color-text-muted);
    }

    img {
      border: 1px solid var(--color-border);
      border-radius: 8px;
      width: 150px;
      height: 70px;
      object-fit: cover;
      overflow: hidden;
    }
  }

  .info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    cursor: pointer;

    &:hover {
      background: var(--color-background);
    }

    .title {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      color: var(--color-text);

      h1 {
        font-size: 1.25rem;
        font-weight: 500;
      }
    }
  }

  .left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .content-wrapper {
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
    padding: 0.5rem;
  }
</style>
