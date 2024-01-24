<script lang="ts" context="module">
    export type StackOptions = {
        transitionDuration: number
        transitionTimingFunction: string
        scaling: number
    }

</script>

<script lang="ts">
    import { createEventDispatcher } from "svelte"

    export let showOverview = false
    export let activeIdx = 0
    export let len: number

    export let options: Partial<StackOptions> = {}

    const dispatch = createEventDispatcher<{ select: number }>()

    const opts = Object.assign({
        transitionDuration: 0.2,
        transitionTimingFunction: 'ease-in-out',
        scaling: 0.6
    }, options)

    const handleKeyDown = (e: KeyboardEvent) => {
        console.log(e.key)
        if (e.key === 'ArrowUp') {
            e.preventDefault()
            activeIdx = Math.max(0, activeIdx - 1)
        } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            activeIdx = Math.min(len, activeIdx + 1)
        } else if (e.key === ' ' || e.code === 'Space') {
            e.preventDefault()
            showOverview = !showOverview
        }
    }

    const selectItem = (idx: number) => {
        console.log('select', idx)
        activeIdx = idx
        showOverview = false
        dispatch('select', idx)
    }
</script>

<svelte:window on:keydown={handleKeyDown}></svelte:window>

<div class="wrapper" class:overview={showOverview} style="--transition-duration: {opts.transitionDuration}s; --transition-timing-function: {opts.transitionTimingFunction}; --down-scaled: {opts.scaling};">
    <div class="list" style="--current: {activeIdx};">
        <slot {selectItem}></slot>
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
        transform: translateY(calc(var(--current) * var(--offset)));
        transform-origin: center 0;

        transition-property: transform, gap;
        transition-duration: var(--transition-duration);
        transition-timing-function: var(--transition-timing-function);
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