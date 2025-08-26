<script lang="ts">
  import { Button } from "bits-ui";
  import type { Snippet } from "svelte"

  type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

  let {
    children, 
    size = 'md',
    square = false,
    ...restProps 
  }: {
    children?: Snippet;
    size?: ButtonSize;
    square?: boolean;
    class?: string;
  } = $props();

  const sizeClass = `button-${size}`;
  const shapeClass = square ? 'button-square' : '';
</script>

<Button.Root
  class={`${sizeClass} ${shapeClass} ${restProps.class ?? ''}`}
  {...restProps}
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
  color: inherit;

  &:hover:not(&:disabled),
  &.active {
    --bg: rgba(0,0,0,0.05);
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
      --bg: linear-gradient(to top, rgba(0,0,0, 0.1), rgba(0,0,0, 0.12));
    }
    &.active {
      --bg: linear-gradient(to top, rgba(0,0,0, 0.1), rgba(0,0,0, 0.12));
    }
  }
  
  &:focus {
    outline: none;
  }
}

:global([data-button-root].button-xs.button-square) {
  padding: 0.25rem ;
}

:global([data-button-root].button-sm.button-square) {
  padding: 0.375rem ;
}

:global([data-button-root].button-md.button-square) {
  padding: 0.5rem ;
}

:global([data-button-root].button-lg.button-square) {
  padding: 0.75rem ;
}

:global([data-button-root].button-xs) {
  padding: 0.125rem 0.25rem ;
  font-size: 11px ;
  gap: 0.125rem ;
  border-radius: 9px;
}

:global([data-button-root].button-sm) {
  padding: 0.25rem 0.375rem ;
  font-size: 12px ;
  gap: 0.1875rem ;
  border-radius: 8px ;
}

:global([data-button-root].button-md) {
  padding: 0.5rem 0.8rem;
  font-size: 13px ;
  gap: 0.25rem ;
  border-radius: 12px ;
}

:global([data-button-root].button-lg) {
  padding: 0.75rem 1rem ;
  font-size: 14px ;
  gap: 0.375rem ;
  border-radius: 14px ;
}
</style>
