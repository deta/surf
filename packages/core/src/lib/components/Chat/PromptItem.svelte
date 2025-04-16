<script lang="ts">
  import { DynamicIcon, type Icons } from '@horizon/icons'

  export let label: string | undefined
  export let icon: Icons | undefined = undefined
</script>

<button on:click>
  {#if icon}
    <div>
      <DynamicIcon name={icon} />
    </div>
  {/if}

  {#if label}
    <div>
      {label}
    </div>
  {/if}
</button>

<style lang="scss">
  button {
    flex-shrink: 0;
    max-width: 64rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.275rem 0.75rem;
    width: fit-content;
    border-radius: 0.75rem;
    transition-property: color;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms;
    color: #075985;
    background-color: white;
    border: 0.5px solid rgba(0, 0, 0, 0.12);
    user-select: none;

    &:hover {
      background-color: #dbeafe;
    }

    :global(.dark) & {
      color: #f3f4f6;
      background-color: #1f2937;

      &:hover {
        background-color: #374151;
      }
    }

    div {
      color: #075985;

      :global(.dark) & {
        color: #f3f4f6;
      }

      &:last-child {
        width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
</style>
