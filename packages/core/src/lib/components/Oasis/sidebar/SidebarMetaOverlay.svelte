<script lang="ts">
  import { writable, type Writable } from 'svelte/store'
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
  role="none"
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

    /* smooth scrim gradients, no hard cutoff
    https://toward.studio/latest/making-css-gradients-smooth
    */

    background: linear-gradient(
      0deg,
      rgba(77, 135, 240, 1) 0%,
      rgba(77, 135, 240, 0.738) 19%,
      rgba(77, 135, 240, 0.541) 34%,
      rgba(77, 135, 240, 0.382) 47%,
      rgba(77, 135, 240, 0.278) 56.5%,
      rgba(77, 135, 240, 0.194) 65%,
      rgba(77, 135, 240, 0.126) 73%,
      rgba(77, 135, 240, 0.075) 80.2%,
      rgba(77, 135, 240, 0.042) 86.1%,
      rgba(77, 135, 240, 0.021) 91%,
      rgba(77, 135, 240, 0.008) 95.2%,
      rgba(77, 135, 240, 0.002) 98.2%,
      rgba(77, 135, 240, 0) 100%
    );

    :global(.dark:not(.custom)) & {
      background: linear-gradient(
        0deg,
        rgba(8, 16, 56, 1) 0%,
        rgba(8, 16, 56, 0.738) 19%,
        rgba(8, 16, 56, 0.541) 34%,
        rgba(8, 16, 56, 0.382) 47%,
        rgba(8, 16, 56, 0.278) 56.5%,
        rgba(8, 16, 56, 0.194) 65%,
        rgba(8, 16, 56, 0.126) 73%,
        rgba(8, 16, 56, 0.075) 80.2%,
        rgba(8, 16, 56, 0.042) 86.1%,
        rgba(8, 16, 56, 0.021) 91%,
        rgba(8, 16, 56, 0.008) 95.2%,
        rgba(8, 16, 56, 0.002) 98.2%,
        rgba(8, 16, 56, 0) 100%
      );
    }

    :global(.custom) & {
      background: linear-gradient(
        180deg,
        var(--mixed-bg-transparent) 0%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 100% 100% / 0.002)) 1.8%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 100% 100% / 0.008)) 4.8%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 100% 100% / 0.021)) 9%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 100% 100% / 0.042)) 13.9%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 100% 100% / 0.075)) 19.8%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 100% 100% / 0.126)) 27%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 100% 100% / 0.194)) 35%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 100% 100% / 0.278)) 43.5%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 100% 100% / 0.382)) 53%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 100% 100% / 0.541)) 66%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 100% 100% / 0.738)) 81%,
        var(--mixed-bg) 100%
      );
    }

    :global(.custom.dark) & {
      background: linear-gradient(
        180deg,
        var(--mixed-bg-dark-transparent) 0%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 80% 0% / 0.002)) 1.8%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 80% 0% / 0.008)) 4.8%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 80% 0% / 0.021)) 9%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 80% 0% / 0.042)) 13.9%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 80% 0% / 0.075)) 19.8%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 80% 0% / 0.126)) 27%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 80% 0% / 0.194)) 35%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 80% 0% / 0.278)) 43.5%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 80% 0% / 0.382)) 53%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 80% 0% / 0.541)) 66%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 80% 0% / 0.738)) 81%,
        var(--mixed-bg-dark) 100%
      );
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

    background: linear-gradient(
      90deg,
      rgba(77, 135, 240, 0) 0%,
      rgba(77, 135, 240, 0.002) 1.8%,
      rgba(77, 135, 240, 0.008) 4.8%,
      rgba(77, 135, 240, 0.021) 9%,
      rgba(77, 135, 240, 0.042) 13.9%,
      rgba(77, 135, 240, 0.075) 19.8%,
      rgba(77, 135, 240, 0.126) 27%,
      rgba(77, 135, 240, 0.194) 35%,
      rgba(77, 135, 240, 0.278) 43.5%,
      rgba(77, 135, 240, 0.382) 53%,
      rgba(77, 135, 240, 0.541) 66%,
      rgba(77, 135, 240, 0.738) 81%,
      rgba(77, 135, 240, 1) 100%
    );

    :global(.dark:not(.custom)) & {
      background: linear-gradient(
        90deg,
        rgba(8, 16, 56, 0) 0%,
        rgba(8, 16, 56, 0.002) 1.8%,
        rgba(8, 16, 56, 0.008) 4.8%,
        rgba(8, 16, 56, 0.021) 9%,
        rgba(8, 16, 56, 0.042) 13.9%,
        rgba(8, 16, 56, 0.075) 19.8%,
        rgba(8, 16, 56, 0.126) 27%,
        rgba(8, 16, 56, 0.194) 35%,
        rgba(8, 16, 56, 0.278) 43.5%,
        rgba(8, 16, 56, 0.382) 53%,
        rgba(8, 16, 56, 0.541) 66%,
        rgba(8, 16, 56, 0.738) 81%,
        rgba(8, 16, 56, 1) 100%
      );
    }

    :global(.custom) & {
      background: linear-gradient(
        90deg,
        var(--mixed-bg-transparent) 0%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 100% 100% / 0.002)) 1.8%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 100% 100% / 0.008)) 4.8%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 100% 100% / 0.021)) 9%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 100% 100% / 0.042)) 13.9%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 100% 100% / 0.075)) 19.8%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 100% 100% / 0.126)) 27%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 100% 100% / 0.194)) 35%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 100% 100% / 0.278)) 43.5%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 100% 100% / 0.382)) 53%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 100% 100% / 0.541)) 66%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 100% 100% / 0.738)) 81%,
        var(--mixed-bg) 100%
      );
    }

    :global(.custom.dark) & {
      background: linear-gradient(
        90deg,
        var(--mixed-bg-dark-transparent) 0%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 80% 0% / 0.002)) 1.8%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 80% 0% / 0.008)) 4.8%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 80% 0% / 0.021)) 9%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 80% 0% / 0.042)) 13.9%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 80% 0% / 0.075)) 19.8%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 80% 0% / 0.126)) 27%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 80% 0% / 0.194)) 35%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 80% 0% / 0.278)) 43.5%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 80% 0% / 0.382)) 53%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 80% 0% / 0.541)) 66%,
        color-mix(in hsl, var(--base-color), hsl(var(--base-color-hue) 80% 0% / 0.738)) 81%,
        var(--mixed-bg-dark) 100%
      );
    }

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
