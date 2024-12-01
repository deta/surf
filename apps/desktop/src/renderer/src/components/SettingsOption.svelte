<script lang="ts">
  import Switch from '@horizon/core/src/lib/components/Atoms/Switch.svelte'
  import { Icon, type Icons } from '@horizon/icons'

  export let value: boolean | undefined = undefined
  export let title: string
  export let description: string
  export let icon: Icons | undefined = undefined
</script>

<div class="setting">
  <section>
    <div class="info">
      <div class="title">
        {#if icon}
          <Icon name={icon} size="20px" />
        {/if}

        <h2>{title}</h2>
      </div>
      <p>{description}</p>
    </div>

    {#if value !== undefined}
      <Switch color="#ff4eed" bind:checked={value} on:update />
    {/if}
  </section>
  <slot />
</div>

<style lang="scss">
  .setting {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    background: var(--color-background-dark);
    border-bottom: 1px solid var(--color-border);
    padding: 1.5rem;
    border-radius: 12px;
    width: 100%;

    & :global(> section) {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .info {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;

      .title {
        display: flex;
        align-items: center;
        gap: 0.5rem;

        h2 {
          font-size: 1.2rem;
          font-weight: 500;
          color: var(--color-text);
        }
      }

      p {
        font-size: 1.1rem;
        color: var(--color-text-muted);
      }
    }
  }
</style>
