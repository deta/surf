<script lang="ts">
  import { Icon } from '@deta/icons'
  import { clickOutside } from '@deta/utils'
  import { onMount, tick } from 'svelte'

  let {
    placeholder = 'Search',
    value = $bindable(''),
    collapsed = false,
    onsearchinput,
    autofocus = false,
    fullWidth = false,
    animated = true,
  }: {
    placeholder?: string
    value?: string
    collapsed: boolean
    onsearchinput?: (value: string) => void
    autofocus?: boolean
    fullWidth?: boolean
    animated?: boolean
  } = $props()

  let inputEl: HTMLInputElement

  export const focus = () => {
    inputEl?.focus()
  }

  onMount(() => {
    if (!autofocus) return
    tick().then(() => inputEl?.focus())
  })
</script>

{#key collapsed}
  <div
    class="input-container"
    class:full-width={fullWidth}
    class:collapsed
    class:animated
    {@attach clickOutside(() => inputEl?.blur())}
  >
    <input
      bind:this={inputEl}
      type="text"
      bind:value={value}
      {placeholder}
      oninput={(e) => onsearchinput?.(e.target.value)}
      {autofocus}
    />
    <div class="icon">
      <Icon name="search" size="0.85rem" />
    </div>
  </div>
{/key}

<style lang="scss">
  .input-container {
    position: relative;

    display: block;
    opacity: 1;
    width: 12rem;
    max-width: 15rem;
    border-radius: 12px;
    background: rgba(0, 0, 0, 0.03);
    border: 1px solid rgba(0, 0, 0, 0.025);

    interpolate-size: allow-keywords;
    transition-behavior: allow-discrete;
    transition:
      width 123ms ease-out,
      background 69ms ease-out;

    &.full-width {
      width: -webkit-fill-available;
      max-width: initial;
    }

    &.animated {
      @starting-style {
        width: 0;
        opacity: 0;
      }
      &.collapsed {
        animation: collapse-out 123ms ease-out forwards;
        .icon {
          opacity: 0;
        }
      }
    }

    @keyframes collapse-out {
      100% {
        width: 0;
        display: none;
      }
    }

    &:focus-within {
      background: rgba(0, 0, 0, 0.045);
      border-color: rgba(0, 0, 0, 0.1);
    }

    .icon {
      position: absolute;
      top: 0;
      right: 0.5rem;
      bottom: 0;
      display: flex;
      align-items: center;
      opacity: 0.5;

      interpolate-size: allow-keywords;
      transition: opacity 200ms ease-out;
      transition-delay: 60ms;
      @starting-style {
        opacity: 0;
      }
    }
  }
  input {
    appearance: none;
    background: transparent;
    font-size: 13px;

    width: 100%;
    padding: 0.25rem 0.5rem;

    &:focus {
      outline: none;
    }
  }
</style>
