<script lang="ts">
  import SearchInput from './SearchInput.svelte'
  import type { Readable } from 'svelte/store'

  export let searchValue: Readable<string>
</script>

<nav class="context-navbar">
  <div class="section first">
    <slot name="left" />
  </div>

  <div class="section trailing flex items-center gap-3">
    <SearchInput bind:value={$searchValue} on:search on:chat placeholder="Search" />
    <div class="dynamic-buttons">
      <slot name="right-dynamic" />
    </div>
    <slot name="right" />
    <div class="desktop-preview-wrapper">
      <slot name="desktop" />
    </div>
  </div>
</nav>

<style lang="scss">
  @keyframes -global-reveal {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes -global-reveal-buttons-right {
    from {
      width: 0;
    }
    to {
      width: fit-content;
    }
  }
  :global(nav.context-navbar) {
    color: var(--contrast-color);
    position: sticky;
    z-index: 10;
    top: 0;
    left: 0;
    right: 0;
    height: 4em;
    margin-bottom: -4em;

    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0em 0.5em;

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: -1;

      background-color: light-dark(
        rgba(from #f7f9fb r g b / 0.95),
        rgba(from #101827 r g b / 0.95)
      );
      backdrop-filter: blur(20px);
      border-bottom: 1px solid rgba(from var(--contrast-color) r g b / 0.125);
      opacity: 0;
      animation: reveal 0.2s ease-out forwards;
      animation-timeline: scroll(nearest block);
      animation-range: 200px 300px;
    }

    :global(.context-name) {
      user-select: none;
      font-size: 1.25em;
      font-family: 'Inter';
      font-weight: 420;
      color: #1a1a1a;
      color: var(--contrast-color);
      max-width: 200px;
    }

    .dynamic-buttons {
      display: flex;
      overflow: hidden;
      gap: 0.5em;
    }

    > .section {
      width: auto;

      &.first {
        opacity: 0;
        animation: reveal 0.2s ease-out forwards;
        animation-timeline: scroll(nearest block);
        animation-range: 200px 300px;
        display: flex;
        align-items: center;
        gap: 0.75em;
      }

      &.trailing {
        position: relative;
        &:before {
          content: '';
          display: block;
          position: absolute;
          top: -10rem;
          left: -4rem;
          right: -15rem;
          bottom: -1.5rem;
          opacity: 0.2;
          filter: blur(20px) hue-rotate(4deg) brightness(10.5);
          border-radius: 2rem;
          background: var(--contrast-color);
          mix-blend-mode: multiply;
          z-index: -1;
          :global(.dark) & {
            opacity: 0.2;
            filter: blur(20px) hue-rotate(4deg) brightness(0);
          }
        }
      }
    }
  }

  .desktop-preview-wrapper {
    position: relative;
    top: 0;
    right: 0;
    height: 100%;
    width: fit-content;
    background: transparent;
  }
  .desktop-preview-wrapper :global(.desktop-preview) {
    position: relative;
    height: 2.5rem;
    width: 4rem;
    border-radius: 8px;
    outline: 1.25px dashed black;
  }

  :global(nav.context-navbar .chat-with-space) {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.5em;
    appearance: none;
    padding: 0.5em;
    border-radius: 0.75rem;
    border: none;
    font-size: 0.9rem;
    font-weight: 500;
    letter-spacing: 0.02rem;
    transition-property: color, background, opacity;
    transition-duration: 123ms;
    transition-timing-function: ease-out;

    opacity: 0.7;

    &:hover {
      color: #0369a1;
      background: rgb(232, 238, 241);
      color: var(--contrast-color);
      background: rgb(from var(--base-color) r g b / 0.4);
      opacity: 1;
    }
  }
</style>
