<script lang="ts">
  import type { Fn } from '@deta/types'
  import type { Snippet } from 'svelte'

  const {
    active,
    disabled,
    muted,
    separator,
    onclick,
    children,
    ...restProps
  }: {
    active?: boolean
    disabled?: boolean
    muted?: boolean
    separator?: boolean
    onclick?: Fn
    children?: Snippet
  } = $props()
</script>

<button
  {...restProps}
  class="breadcrumb {restProps['class'] ?? ''}"
  class:active
  class:muted
  class:disabled
  class:separator
  {onclick}
>
  {@render children?.()}
</button>

<style lang="scss">
  .breadcrumb {
    user-select: none;

    height: min-content;
    width: max-content;
    flex-shrink: 0;
    padding: 0.25rem 0.5rem;
    border-radius: 10px;
    -electron-corner-smoothing: 60%;

    transition: color, scale, opacity;
    transition-duration: 125ms;
    transition-timing-function: ease-out;

    font-size: 13px; // TODO: (styles): Use tokens
    font-weight: 400;
    text-box-trim: trim-both;
    letter-spacing: 0.02em;

    display: flex;
    align-items: center;
    justify-items: center;
    gap: 0.25rem;

    // TODO: This can be global for all buttons
    cursor: default;

    background: transparent;
    &:hover:not(.separator):not(.disabled),
    &.active {
      background: light-dark(
        var(--overlay-light, rgba(0, 0, 0, 0.04)),
        var(--overlay-light-dark, rgba(15, 23, 42, 0.22))
      );
    }

    &.muted {
      opacity: 0.6;
    }
    &.separator {
      padding: 0rem 0.2rem;
      padding-bottom: 0.075rem;
      padding-right: 0.27rem;
      font-size: 14px; // TODO: (styles): Use tokens
    }
  }
</style>
