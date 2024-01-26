<script lang="ts" context="module">
    export type StackOptions = {
        transitionDuration: number
        transitionTimingFunction: string
        scaling: number
    }

</script>

<script lang="ts">
    export let showOverview = false
    export let activeIdx = 0
    export let movementOffset = 0

    const MOVEMENT_LIMIT = window.innerHeight / 2

    $: limitedOffset = Math.max(Math.min(movementOffset, MOVEMENT_LIMIT), -MOVEMENT_LIMIT)

    export let options: Partial<StackOptions> = {}

    const opts = Object.assign({
        transitionDuration: 0.2,
        transitionTimingFunction: 'ease-in-out',
        scaling: 0.6
    }, options)
</script>

<div class="wrapper" class:overview={showOverview} style="--transition-duration: {opts.transitionDuration}s; --transition-timing-function: {opts.transitionTimingFunction}; --down-scaled: {opts.scaling};">
    <div class="list" style="--current: {activeIdx}; --movement-offset: {limitedOffset}px;" class:movement={limitedOffset !== 0}>
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
        transform: translateY(calc((var(--current) * var(--offset)) + var(--movement-offset)));
        transform-origin: center 0;

        transition-property: transform, gap;
        transition-duration: var(--transition-duration);
        transition-timing-function: var(--transition-timing-function);

        &.movement {
            transition: none;
        }
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