<script lang="ts">
  import { DynamicIcon, type Icons } from '@deta/icons'

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
    padding: 0.35rem 0.85rem;
    width: fit-content;
    border-radius: 0.75rem;
    transition-property: color, background, transform;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms;
    color: rgba(0, 0, 0, 0.4);
    background: rgba(0, 0, 0, 0.035);
    border: 0.5px solid rgba(0, 0, 0, 0.05);
    user-select: none;

    &:hover {
      color: rgba(0, 0, 0, 0.75);
      background: rgba(0, 0, 0, 0.075);
      transform: translateX(1px);
    }

    :global(.dark) & {
      color: #bbb !important;
      background: rgba(255, 255, 255, 0.075) !important;

      &:hover {
        color: #fff !important;
        background: rgba(255, 255, 255, 0.125);
      }
    }

    div {
      color: currentColor;
      &:last-child {
        width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
</style>
