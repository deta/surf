<script lang="ts">
  import { Icon, type Icons } from '@horizon/icons'

  export let text: string = 'Click'
  export let icon: Icons | undefined = undefined
  export let onClick: () => void = () => {}
</script>

<button on:click={onClick}>
  {#if icon}
    <Icon name={icon} />
  {/if}
  <span>{text}</span>
</button>

<style lang="scss">
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-size: 1rem;
    padding: 0.25rem 0.5rem;
    border: none;
    border-radius: 12px;
    background: #ff4fa4;
    color: #fff;
    transition: background 0.2s;

    :global(.dark) & {
      background: #ff4fa4;
      color: #fff;
    }
  }

  button:hover {
    background: #e04692;
  }

  button:active {
    background: #c03e7f;
  }

  button:disabled {
    opacity: 0.5;
  }

  button span {
    display: inline-block;
  }
</style>
