<script lang="ts">
  import { Icon } from '@horizon/icons'
  import { createEventDispatcher } from 'svelte'
  import { slide } from 'svelte/transition'

  export let title: string | undefined = undefined
  export let description: string
  export let content: string
  export let expanded = false

  const dispatch = createEventDispatcher<{ update: string }>()

  function handleContentUpdate() {
    dispatch('update', content)
  }

  function handleClick() {
    expanded = !expanded
  }
</script>

<section class="wrapper">
  <!-- svelte-ignore a11y-interactive-supports-focus a11y-click-events-have-key-events -->
  <div on:click={handleClick} role="button" class="title">
    {#if expanded}
      <Icon name="chevron.down" size="24" />
    {:else}
      <Icon name="chevron.right" size="24" />
    {/if}

    <h1>{title}</h1>
  </div>

  {#if expanded}
    <div class="content" transition:slide>
      <p>{description}</p>
      <textarea
        bind:value={content}
        on:input={handleContentUpdate}
        rows={5}
        placeholder="prompt text"
      ></textarea>
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
      font-size: 1.2rem;
      font-weight: 400;
      color: var(--color-text);
    }
  }

  .content {
    margin-top: 0.5rem;
    padding-left: 2.2rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;

    p {
      font-size: 1rem;
      color: var(--color-text-muted);
    }

    textarea {
      width: 100%;
      padding: 1rem;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-background-light);
      color: var(--color-text);
      outline: none;
      font-size: 1rem;
      font-family: inherit;
      resize: vertical;

      &:focus {
        border-color: var(--color-brand-light);
      }
    }
  }
</style>
