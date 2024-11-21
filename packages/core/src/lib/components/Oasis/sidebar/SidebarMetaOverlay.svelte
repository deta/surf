<script lang="ts">
  import { writable } from 'svelte/store'
  import RecentsStack from './RecentsStack.svelte'
  import dotNoiseLightGrey from '../../../../../public/assets/dotnoise-light-grey.png'

  const containerHeight = writable<null | string>(null)

  function handleUpdateContainerHeight(e: CustomEvent<string | null>) {
    containerHeight.set(e.detail)
  }

  let mouseInside = false
  let wasMouseInsideStack = writable(false)
</script>

<div
  class="sidebar-meta no-drag"
  class:mouseInside
  on:mouseenter={() => (mouseInside = true)}
  on:mouseleave={() => {
    mouseInside = false
    wasMouseInsideStack.set(false)
  }}
  style={$containerHeight === null
    ? '--height-override: auto;'
    : `--height-override: ${$containerHeight}; --bg-url: url('${dotNoiseLightGrey}');`}
>
  <div class="bottom" style="gap: 0.25em;">
    <RecentsStack
      wasMouseInside={wasMouseInsideStack}
      on:open
      on:open-stuff
      on:open-and-chat
      on:update-container-height={handleUpdateContainerHeight}
      on:open-resource-in-mini-browser
      on:remove
      on:Drop
    />
    <slot name="tools" />
  </div>
</div>

<style lang="scss">
  .sidebar-meta {
    position: relative;
    z-index: 2147483647;
    height: fit-content;
    height: var(--height-override, auto);
    margin-inline: -0.5rem;
    margin-bottom: -0.5rem;

    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: stretch;

    background: linear-gradient(0deg, rgb(77 135 240 / 74%) 0%, rgba(0, 0, 0, 0) 100%);

    :global(.dark) & {
      background: linear-gradient(0deg, rgba(8, 16, 56, 0.74) 0%, rgba(22, 8, 8, 0) 100%);
    }

    transition: height 185ms ease-out;

    &:after {
      content: '';
      position: absolute;
      inset: 0;
      z-index: -1;
      //background-image: url('https://www.transparenttextures.com/patterns/billie-holiday.png');
      // TODO: INLINE images
      //background-image: url('https://www.transparenttextures.com/patterns/clean-gray-paper.png');
      //background-image: url('https://www.transparenttextures.com/patterns/cream-paper.png');
      //      background-image: url('https://www.transparenttextures.com/patterns/dotnoise-light-grey.png');
      background-image: var(--bg-url);
      background-position: center;
      mask-image: linear-gradient(to bottom, transparent 0%, #000 50%);
      mix-blend-mode: screen;
      mix-blend-mode: color-dodge;
      opacity: 1;
    }

    .bottom {
      display: flex;
      align-items: flex-end;
      padding: 0;
      height: 100%;
    }
  }

  :global(.horizontalTabs) .sidebar-meta {
    width: fit-content;
    //width: var(--height-override, auto);
    min-width: fit-content;
    height: calc(100%);

    flex-direction: row;
    align-items: center;
    /*margin-inline: inherit;
    margin-bottom: -1.25rem;
    margin-top: -1.25rem;
    margin-right: -1rem;*/
    margin: unset;
    margin-right: -1rem;

    background: linear-gradient(to left, rgb(77 135 240 / 74%) 0%, #c8ddfa00 100%);

    transition: width 185ms ease-out;

    .bottom {
      padding: 0;
      padding-inline: 0.5rem;
      padding-right: 0;
      align-items: center;
      //padding-bottom: 0.25rem;

      :global(> div) {
        order: 1;
      }
      :global(> .wrapper) {
        order: 2;
      }
    }

    &:after {
      mask-image: linear-gradient(to right, transparent 0%, #000 50%);
    }
  }

  :global(.verticalTabs) .sidebar-meta {
    & :global(.bottom > div:last-child) {
      padding: 0.5rem;
    }
  }
</style>
