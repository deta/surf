<script lang="ts">
  import { DynamicIcon, type Icons } from '@deta/icons'

  export let label: string | undefined
  export let icon: Icons | undefined = undefined

  export let direction: 'horizontal' | 'vertical' = 'vertical'
  export let disabled: boolean = false
  export let loading: boolean = false
</script>

<button
  on:click
  class="direction-{direction}"
  class:disabled={disabled || loading}
  class:loading
  {...$$restProps}
>
  {#if icon}
    <div>
      <DynamicIcon name={icon} />
    </div>
  {/if}

  {#if label}
    <span>
      {label}
    </span>
  {/if}
</button>

<style lang="scss">
  button {
    transition-property: color, background, transform;
    transition-duration: 123ms;
    transition-timing-function: ease-out;

    --scale: 1;
    --offset-x: 0px;
    --offset-y: 0px;

    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5em;
    flex-shrink: 0;

    width: fit-content;
    border-radius: 0.6rem;
    &.direction-vertical {
      max-width: 40ch;
      padding: 0.35rem 0.85rem;
    }
    &.direction-horizontal {
      max-width: 18ch;
      padding: 0.25rem 0.6rem;
      gap: 0.35em;
      font-size: 1em;
    }

    transform: translate(var(--offset-x), var(--offset-y)) scale(var(--scale));

    color: light-dark(rgba(0, 0, 0, 0.4), rgba(255, 255, 255, 0.5));
    //background: light-dark(rgba(0, 0, 0, 0.035), rgba(255, 255, 255, 0.035));
    background: light-dark(rgba(250, 250, 250, 0.85), rgba(26, 36, 56, 0.85));
    backdrop-filter: blur(8px);
    border: 0.5px solid light-dark(rgba(0, 0, 0, 0.05), rgba(255, 255, 255, 0.05));

    user-select: none;

    &:not(.disabled) {
      transition-delay: 0ms;
      &:hover {
        color: light-dark(rgba(0, 0, 0, 0.75), rgba(255, 255, 255, 0.75));
        background: light-dark(rgba(0, 0, 0, 0.075), rgba(40, 53, 73, 0.9));

        &.direction-vertical {
          --offset-x: 1px;
          --offset-y: -1px;
        }
        &.direction-horizontal {
          --offset-x: 1px;
          --offset-y: -1px;
        }
      }
      &:active {
        --scale: 0.975;
        background: light-dark(rgba(0, 0, 0, 0.1), rgba(50, 65, 90, 0.95));
      }
    }
    &.disabled {
      opacity: 0.5;
      //--offset-y: 10px;
    }

    &.loading {
      @keyframes pulse {
        0% {
          opacity: 1;
        }
        50% {
          opacity: 0.65;
        }
        100% {
          opacity: 1;
        }
      }

      border-style: dashed;
      animation: pulse 2s infinite;
    }

    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
</style>
