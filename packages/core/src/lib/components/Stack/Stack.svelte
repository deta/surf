<script lang="ts" context="module">
  export type StackOptions = {
    transitionDuration: number
    transitionTimingFunction: string
    scaling: number
    gap: number
  }

</script>

<script lang="ts">
    // import { lerp } from "@horizon/tela"

    import { onMount } from "svelte"
    import { quadOut } from "svelte/easing"
    import { tweened } from "svelte/motion"
    import { derived, type Writable } from "svelte/store"
    import { wait } from "../../utils/time"

    export let showOverview: Writable<boolean>
    export let activeIdx: Writable<number>
    export let movementOffset: Writable<number>
    export let overviewOffset: Writable<number>
    export let showTransitions = true
    export let options: Partial<StackOptions> = {}

    let windowHeight: number;
    let autoMovement = false

    const opts = Object.assign({
      transitionDuration: 170,
      transitionTimingFunction: 'ease-in-out',
      scaling: 0.6,
      gap: 64,
      padding: 48,
    }, options)

    const tweenedOptions = {
      duration: opts.transitionDuration,
      easing: quadOut,
    }

    export const moveToStackItem = async (idx: number) => {
      autoMovement = true
      $activeIdx = idx
      $overviewOffset = 0

      await wait(opts.transitionDuration)

      autoMovement = false
    }

    const scalingTweened = tweened(1, tweenedOptions)
    const tweenedStackTransformY = tweened(0, tweenedOptions)
    const paddingTop = tweened(0, tweenedOptions)

    const scaling = derived([showOverview], ([showOverview]) => {
      return showOverview ? opts.scaling : 1
    })

    const stackTransformY = derived([showOverview, scaling, activeIdx, overviewOffset, movementOffset], ([showOverview, scaling, activeIdx, overviewOffset, movementOffset]) => {
      const itemHeight = window.innerHeight * scaling

      const scrollOffset = autoMovement ? 0 : overviewOffset
      const selectedItemOffset = activeIdx * (itemHeight + opts.padding) * -1

      const finalOffset = selectedItemOffset - scrollOffset

      return finalOffset
    })

    onMount(() => {
      const unsubscribeTweened = stackTransformY.subscribe((value) => {
        tweenedStackTransformY.set(value)
      })

      const unsubscribeScaling = scaling.subscribe((value) => {
        scalingTweened.set(value)
      })

      const usubscribeOverview = showOverview.subscribe((value) => {
        paddingTop.set(value ? (windowHeight * opts.scaling) / 3 : 0)
      })

      return () => {
        if (unsubscribeTweened) unsubscribeTweened()
        if (unsubscribeScaling) unsubscribeScaling()
        if (usubscribeOverview) usubscribeOverview()
      }
    })
</script>

<svelte:window bind:innerHeight={windowHeight} />

<div class="wrapper" class:overview={$showOverview} class:transitions={showTransitions} style="--transition-duration: {opts.transitionDuration / 1000}s; --transition-timing-function: {opts.transitionTimingFunction}; --scaling: {$scalingTweened}; --padding-top: {$paddingTop}px; --down-scaled: {opts.scaling}; --gap: {opts.gap}px;">
    <div class="list" style="--stack-y: {showTransitions ? $tweenedStackTransformY : $stackTransformY}px;">
        <slot></slot>
    </div>
</div>

<style lang="scss">
  .wrapper {
    --border-color: #dcdcdc;

    --padding: 3rem;
    // --scale: 1;
    --width: calc(100vw * var(--scaling));
    --height: calc(100vh * var(--scaling));
    --offset: calc((100vh * var(--scaling) * -1) - var(--padding));
    //--padding-top: 0;

    display: flex;
    flex-direction: column;
    overflow: hidden;
    margin: auto;
    height: 100vh;
    width: var(--width);
    padding-top: var(--padding-top);

    // transition-property: padding;
    // transition-duration: var(--transition-duration);
    // transition-timing-function: var(--transition-timing-function);

    // &.transitions {
    //   transition-property: width, height, transform, padding;

    //   .list {
    //       // transition-property: transform, gap;
    //     }
    // }
  }

    .list {
        display: flex;
        flex-direction: column;
        gap: var(--padding);
        transform: translate3d(0, var(--stack-y), 0);
        transform-origin: center center;
        // will-change: transform;
        // // transition-property: transform;
        // // transition-duration: var(--transition-duration);
        // // transition-timing-function: var(--transition-timing-function);
        // transition-duration: 0s; //0.185s
        // /* easeOutCubic */
        // // transition-timing-function: cubic-bezier(0.33, 1, 0.68, 1);
        // transition-timing-function: var(--transition-timing-function);

        // &.movement {
        //     transition: none;
        // }
    }

  // .wrapper.overview {
    // --padding: var(--gap);
    // --scale: var(--down-scaled);
    // --width: calc(100vw * var(--scale));
    // --height: calc(100vh * var(--scale));
    // --offset: calc((var(--height) * -1) - var(--padding));
    // --padding-top: calc((100vh * var(--down-scaled)) / 3);
  //}
</style>
