<script lang="ts" context="module">
  export type ButtonKind = 'primary' | 'secondary' | 'standard'
</script>

<script lang="ts">
  import { Icon, type Icons } from '@deta/icons'

  export let icon: Icons | undefined = undefined
  export let tooltip: string = ''
  export let kind: ButtonKind = 'standard'
  export let type: 'button' | 'submit' | 'reset' = 'button'
</script>

{#if type === 'submit'}
  <button
    data-tooltip={tooltip}
    type="submit"
    class="button"
    class:primary={kind === 'primary'}
    class:secondary={kind === 'secondary'}
    {...$$restProps}
  >
    <slot>
      <Icon name={icon} />
    </slot>
  </button>
{:else}
  <button
    on:click|stopPropagation|preventDefault
    data-tooltip={tooltip}
    class="button"
    class:primary={kind === 'primary'}
    class:secondary={kind === 'secondary'}
    {...$$restProps}
  >
    <slot>
      <Icon name={icon} />
    </slot>
  </button>
{/if}

<style lang="scss">
  .button {
    pointer-events: auto;
    appearance: none;
    padding: 8px;
    border: none;
    border-radius: 8px;

    background: none;
    color: #333;
    font-size: 17px;
    font-weight: 500;
    transition: background-color 0.2s;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;

    &:hover {
      background: #f0f0f0;
    }

    &:active {
      background: #e0e0e0;
    }

    &.secondary {
      color: #fd1bdf;
    }

    &.primary {
      background: #ff4eed;
      color: #fff;

      &:hover {
        background: #fd1bdf;
      }

      &:active {
        background: #fd1bdf;
      }
    }
  }
</style>
