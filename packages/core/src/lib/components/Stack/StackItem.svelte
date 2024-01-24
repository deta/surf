<script lang="ts">
    import { createEventDispatcher } from "svelte"

    export let showOverview: boolean

    const dispatch = createEventDispatcher<{select: void}>()

    const handleClick = (e: MouseEvent) => {
        if (!showOverview) return
        console.log('click')

        e.preventDefault()
        dispatch('select')
    }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
<div on:click={handleClick} class="item" class:overview={showOverview}>
    <div class="content">
        <slot></slot>
    </div>
</div>

<style lang="scss">
    .item {
        flex-shrink: 0;
        height: var(--height);
        transition-property: height, border-radius, border;
        transition-duration: var(--transition-duration);
        transition-timing-function: var(--transition-timing-function);

        width: 100%;
        overflow: hidden;

        box-sizing: border-box;
        border: 0px solid transparent;
        border-radius: 0;
    }

    .content {
        height: 100%;
        width: 100%;
        position: relative;
    }

    .overview {
        &.item {
            border-width: 4px;
            border-color: var(--border-color);
            border-radius: 2rem;
            cursor: pointer;
        }

        .content {
            pointer-events: none;
        }
    }
</style>