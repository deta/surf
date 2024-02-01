<script lang="ts" context="module">
  export type StackOptions = {
    transitionDuration: number
    transitionTimingFunction: string
    scaling: number
    gap: number
  }
</script>

<script lang="ts">
    import { lerp } from "@horizon/tela"

    import { onMount } from "svelte"
    import { quadInOut, quadOut, quintInOut } from "svelte/easing"
    import { tweened } from "svelte/motion"
    import type { Writable } from "svelte/store"

    export let showOverview = false
    export let activeIdx = 0
    export let movementOffset: Writable<number>
    export let overviewOffset: Writable<number>
    export let showTransitions = true

    export let flickVisualWeight: number;

    let windowHeight: number;

    const MOVEMENT_LIMIT = window.innerHeight / 2

    $: limitedOffset = Math.max(Math.min($movementOffset, MOVEMENT_LIMIT), -MOVEMENT_LIMIT)

    // $: lerpedMovement = $movementOffset * lerp(1, 0.8, Math.abs($movementOffset) / 1000);
    // $: limitedMovementOffset = Math.max(Math.min($movementOffset, 100), -100)

    $: verticalOffsetZoom = activeIdx * -windowHeight - (48 * activeIdx);
    $: verticalOffsetOverview = activeIdx * 708 - (64 * activeIdx);

    $: targetOffsetZoom = verticalOffsetZoom - (activeIdx === 0 ? Math.max(-20, ($movementOffset / flickVisualWeight)) : ($movementOffset / flickVisualWeight));
    $: targetOffsetOverview = verticalOffsetOverview - $overviewOffset;

    //$: targetOffset = $overviewOffset // showOverview ? $overviewOffset : (activeIdx === 0 ? Math.max(-20, ($movementOffset / flickVisualWeight)) : ($movementOffset / flickVisualWeight));

    // $: verticalOffset = activeIdx * -windowHeight - (48 * activeIdx);
    // $: targetOffset = verticalOffset - (showOverview ? ($overviewOffset) : 0) - (activeIdx === 0 ? Math.max(-10, ($movementOffset / 2.8)) : ($movementOffset / 2.8));
    $: transformCss = `transform: translate3d(0px, ${targetOffset}px, 0px)`

    // function frame() {
    //   requestAnimationFrame(frame)
    //   verticalOffset += (targetOffset - verticalOffset) * 0.1
    // }
    // onMount(frame)

    export let options: Partial<StackOptions> = {}

    // let horizonOffset // <- position to target
    // let movementOffset // <- offset to add

    const opts = Object.assign({
      transitionDuration: 170,
      transitionTimingFunction: 'ease-in-out',
      scaling: 0.6,
      gap: 64,
    }, options)

    const tweenedOptions = {
      duration: opts.transitionDuration,
      easing: quadOut,
    }

    const scaling = tweened(1, tweenedOptions)
    const current = tweened(0, tweenedOptions)
    const paddingTop = tweened(0, tweenedOptions)
    const targetOffset = tweened(0, tweenedOptions)

    // TODO: probably better way to set these so nothing gets blocked
    $: $current = activeIdx
    $: $scaling = showOverview ? opts.scaling : 1
    $: $paddingTop = showOverview ? ((windowHeight * opts.scaling) / 3) : 0
    $: $targetOffset = $overviewOffset
</script>

<svelte:window bind:innerHeight={windowHeight} />

<div class="wrapper" class:overview={showOverview} class:transitions={showTransitions} style="--transition-duration: {opts.transitionDuration / 1000}s; --transition-timing-function: {opts.transitionTimingFunction}; --scaling: {$scaling}; --padding-top: {$paddingTop}px; --down-scaled: {opts.scaling}; --gap: {opts.gap}px;">
    <div class="list" style="--current: {showTransitions ? $current : activeIdx}; --target-offset: {showTransitions ? $targetOffset : $overviewOffset}px;" class:movement={limitedOffset !== 0}>
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
        transform: translate3d(0, calc((var(--current) * var(--offset)) - var(--target-offset)), 0);
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
