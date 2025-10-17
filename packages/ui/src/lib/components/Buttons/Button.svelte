<script lang="ts">
  import { Button } from "bits-ui";
  import type { Snippet } from "svelte"

  type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'fill';

  let {
    ref = $bindable(),
    children, 
    size = 'md',
    square = false,
          active,
    ...restProps 
  }: {
    ref?: unknown;
    children?: Snippet;
    size?: ButtonSize;
    square?: boolean;
          active?: boolean
    class?: string;
  } = $props();

  const sizeClass = `button-${size}`;
  const shapeClass = square ? 'button-square' : '';
</script>

<Button.Root
  {...restProps}
  class={`${sizeClass} ${shapeClass} ${restProps.class ?? ''} ${active ? 'active' : ''}`}
  bind:this={ref}
>
  {@render children?.()}
</Button.Root>

<style lang="scss">
// NOTE: I don't like the fact that we are introducing bits ui in a sense..
// might be good to have some more help scaffolding these components, but here already
// we introduce :global styles again.. should be fine for this simple example.. but just worried where it's leading :thinking:

:global([data-button-root]) {
  user-select: none;

  height: min-content;
  width: max-content;

  border-radius: 12px;
  -electron-corner-smoothing: 60%;

  transition: color, scale, opacity;
  transition-duration: 125ms;
  transition-timing-function: ease-out;

  font-weight: 400;
  text-box-trim: trim-both;
  letter-spacing: 0.02em;

  display: flex;
  align-items: center;
  justify-items: center;

  outline: none;
  background: var(--bg);
  color: light-dark(rgba(0, 0, 0, 0.7), rgba(255, 255, 255, 0.8));
  opacity: 0.8;

  &:hover:not(&:disabled),
  &.active {
    --bg: light-dark(rgba(0, 0, 0, 0.05), rgba(255, 255, 255, 0.1));
  }
  
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  
  &:not(&:disabled) {
    &:hover {
      //scale: 0.97;
      opacity: 1;
    }
    &:active {
      scale: 0.95;
      opacity: 1;
      --bg: linear-gradient(
        to top,
        light-dark(rgba(0, 0, 0, 0.1), rgba(255, 255, 255, 0.18)),
        light-dark(rgba(0, 0, 0, 0.12), rgba(255, 255, 255, 0.22))
      );
    }
    &.active {
      --bg: linear-gradient(
        to top,
        light-dark(rgba(0, 0, 0, 0.1), rgba(255, 255, 255, 0.18)),
        light-dark(rgba(0, 0, 0, 0.12), rgba(255, 255, 255, 0.22))
      );
    }
  }
  
  &:focus {
    outline: none;
  }
}

:global(.button-xs.button-square[data-button-root]) {
  aspect-ratio: 1 / 1;
  padding: 0.25rem;
}

:global(.button-sm.button-square[data-button-root]) {
  aspect-ratio: 1 / 1;
  padding: 0.375rem;
}

:global(.button-md.button-square[data-button-root]) {
  aspect-ratio: 1 / 1;
  padding: 0.5rem;
}

:global(.button-lg.button-square[data-button-root]) {
  aspect-ratio: 1 / 1;
  padding: 0.75rem;
}

:global(.button-xs[data-button-root]) {
  padding: 0.125rem 0.25rem;
  font-size: 11px;
  gap: 0.125rem;
  border-radius: 9px;
}

:global(.button-sm[data-button-root]) {
  padding: 0.25rem 0.375rem;
  font-size: 12px;
  gap: 0.1875rem;
  border-radius: 8px;
}

:global(.button-md[data-button-root]) {
  padding: 0.5rem 0.8rem;
  font-size: 13px;
  gap: 0.5rem;
  border-radius: 12px;
}

:global(.button-lg[data-button-root]) {
  padding: 0.75rem 1rem;
  font-size: 14px;
  gap: 0.375rem;
  border-radius: 14px;
}

:global(.button-fill[data-button-root]) {
  margin: 0;
  display: flex;
  justify-items: center;
  align-items: center;
  border-radius: 8px;
  padding: 0;
  width: 100%;
  height: 100%;
}
</style>
