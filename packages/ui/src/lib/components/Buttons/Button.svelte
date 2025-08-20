<script lang="ts">
  import { Button } from "bits-ui";

  let { children, ...restProps } = $props();
</script>

<Button.Root
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
  padding: 0.5rem;

  border-radius: 12px;
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

  outline: none;
  background: var(--bg);
  color: inherit;
  
  &:hover,
  &.active {
    --bg: rgba(255,255,255,0.75);
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
      scale: 0.9;
      opacity: 1;
      --bg: linear-gradient(to top, rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.77));
    }
    &.active {
      --bg: linear-gradient(to top, rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.77));
    }
  }
  
  &:focus {
    outline: none;
  }
}
</style>
