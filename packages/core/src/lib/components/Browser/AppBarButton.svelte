<script lang="ts">
  export let active: boolean = false
  export let disabled: boolean = false
  export let muted: boolean = true
</script>

<button
  {disabled}
  on:click
  {...$$restProps}
  class="no-drag {$$restProps['class']}"
  class:active
  class:muted
>
  <slot />
</button>

<style lang="scss">
  @use '@horizon/core/src/lib/styles/utils' as utils;

  button {
    transition: color, scale, opacity;
    transition-duration: 125ms;
    transition-timing-function: ease-out;
    color: light-dark(var(--contrast-color), var(--contrast-color));
    font-size: 1.05rem;
    letter-spacing: 0.01em;
    font-weight: 400 !important;
    @include utils.font-smoothing;
    display: flex;
    align-items: center;
    justify-items: center;
    padding: 0.5rem;
    appearance: none;
    outline: none;

    &.muted {
      opacity: 0.6;
    }

    &:hover,
    &.active {
      --bg: var(--black-09);
      @include utils.light-dark-custom(
        'bg',
        var(--black-09),
        var(--white-15),
        var(--black-09),
        var(--white-15)
      );

      @include utils.squircle($fill: var(--bg), $radius: 14px, $smooth: 0.44);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    &:not(&:disabled) {
      &:hover {
        scale: 0.97;
        opacity: 1;
      }
      &:active {
        scale: 0.9;
        opacity: 1;
      }
      &.active {
        --bg: var(--black-13);
      }
    }

    &:focus {
      outline: none;
    }
  }
</style>
