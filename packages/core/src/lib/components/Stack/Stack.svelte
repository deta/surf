<script lang="ts" context="module">
  export type StackOptions = {
    transitionDuration: number
    transitionTimingFunction: string
    scaling: number
  }
</script>

<script lang="ts">
    import { lerp } from "@horizon/tela"

    import { onMount } from "svelte"
    import type { Writable } from "svelte/store"

    export let showOverview = false
    export let activeIdx = 0
    export let movementOffset: Writable<number>
    export let overviewOffset: Writable<number>

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

    $: targetOffset = showOverview ? targetOffsetOverview : targetOffsetZoom;

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
        transitionDuration: 0.17,
        transitionTimingFunction: 'ease-in-out',
        scaling: 0.6
    }, options)
</script>

<svelte:window bind:innerHeight={windowHeight} />

<div class="wrapper" class:overview={showOverview} style="--transition-duration: {opts.transitionDuration}s; --transition-timing-function: {opts.transitionTimingFunction}; --down-scaled: {opts.scaling};">
    <div class="list" style="{transformCss};--current: {activeIdx}; --movement-offset: -{limitedOffset}px;" class:movement={limitedOffset !== 0}>
        <slot></slot>
    </div>
</div>

<style lang="scss">
  .wrapper {
    --border-color: #dcdcdc;

    --padding: 3rem;
    --scale: 1;
    --width: calc(100vw * var(--scale));
    --height: calc(100vh * var(--scale));
    --offset: calc((var(--height) * -1) - var(--padding));
    --padding-top: 0;

    display: flex;
    flex-direction: column;
    overflow: hidden;
    margin: auto;
    height: 100vh;
    width: var(--width);
    padding-top: var(--padding-top);

    transition-property: width, height, transform, padding;
    transition-duration: var(--transition-duration);
    transition-timing-function: var(--transition-timing-function);
  }

    .list {
        display: flex;
        flex-direction: column;
        gap: var(--padding);
        // transform: translateY(calc((var(--current) * var(--offset)) + var(--movement-offset)));
        transform-origin: center 0;
        will-change: transform;

        transition-property: transform, gap;
        // transition-duration: var(--transition-duration);
        // transition-timing-function: var(--transition-timing-function);
        transition-duration: 0.205s; //0.185s
        /* easeOutCubic */
        // transition-timing-function: cubic-bezier(0.33, 1, 0.68, 1);
        transition-timing-function: cubic-bezier(0.25, 1, 0.5, 1);

        // &.movement {
        //     transition: none;
        // }
    }

  .wrapper.overview {
    --padding: 4rem;
    --scale: var(--down-scaled);
    --width: calc(100vw * var(--scale));
    --height: calc(100vh * var(--scale));
    --offset: calc((var(--height) * -1) - var(--padding));
    --padding-top: calc(var(--height) / 3);
  }
</style>
