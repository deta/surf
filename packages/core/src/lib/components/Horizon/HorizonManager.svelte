<script lang="ts">
    import { onMount } from "svelte";

    import { API } from "@horizon/core/src/lib/service/api";
    import { HorizonsManager } from "@horizon/core/src/lib/service/horizon";

    import Horizon from "./Horizon.svelte";
    import { generateRandomHue } from "../../utils/color";
  import { derived } from "svelte/store";

    const api = new API()
    const horizonManager = new HorizonsManager(api)

    const horizons = horizonManager.horizons
    const hotHorizons = horizonManager.hotHorizons
    const horizonStates = horizonManager.horizonStates
    const activeHorizonId = horizonManager.activeHorizonId
    const activeHorizon = horizonManager.activeHorizon

    horizons.subscribe(e => console.log('horizons changed', e))

    const hotHorizonsSorted = derived(horizonStates, (horizonStates) => {
        return Array.from(horizonStates.entries())
            .map(([id, state]) => ({ id, ...state }))
            .filter((horizon) => horizon.state === 'hot')
            .sort((a, b) => a.since.getTime() - b.since.getTime()) // oldest first
    })

    // $: console.log('horizons', $horizons.map(e => ({...e, state: e.getState()})))
    // $: console.log('hotHorizons', $hotHorizons.map(e => ({...e, state: e.getState()})))
    // $: console.log('activeHorizonId', $activeHorizonId)
    // $: console.log('activeHorizon', $activeHorizon)
    $: console.log('hotHorizonsSorted', $hotHorizonsSorted)

    const switchHorizon = (id: string) => {
        const nextHorizon = $horizons.find(e => e.id === id)
        if (nextHorizon) {
            horizonManager.switchHorizon(nextHorizon.id)
        } else {
            console.error('Horizon not found', id)
        }
    }

    const addHorizon = async () => {
        const newHorizon = await horizonManager.createHorizon('New Horizon' + $horizons.length)
        horizonManager.switchHorizon(newHorizon.id)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.metaKey || event.ctrlKey) {
            if ((event.metaKey || event.ctrlKey) && event.key === 'n') {
                event.preventDefault()
                addHorizon()
            } else {
                const indexes = $horizons.map((e, idx) => idx + 1)
                const index = indexes.indexOf(Number(event.key))
                if (index !== -1) {
                    event.preventDefault()
                    switchHorizon($horizons[index].id)
                }
            }
        }
    }

    onMount(() => {
        horizonManager.init()
    })
</script>

<svelte:window on:keydown={handleKeyDown} />

<main class="">
    <div class="horizon-list">
        {#each $horizons as horizon, idx (horizon.id)}
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
            <div
                on:click={() => switchHorizon(horizon.id)}
                class:active={$activeHorizonId === horizon.id}
                class="list-item horizon-item"
                style="--item-color-hue: {generateRandomHue(idx + horizon.id)};"
            >
                {idx + 1} {$hotHorizons.includes(horizon) ? '🔥' : '🧊'}
            </div>
        {/each}

        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
        <div on:click={() => addHorizon()} class="list-item add-horizon" style="--item-color: #f2f2f2;">
            +
        </div>
    </div>
    {#each $hotHorizons as hotHorizon (hotHorizon.id)}
        <div data-hot-horizon={hotHorizon.id} class:hidden={hotHorizon.id !== $activeHorizonId}>
            <Horizon horizon={hotHorizon} />
        </div>
    {/each}
</main>

<style lang="scss">

    .horizon-list {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.25rem;
        padding-left: 1rem;
    }

    .list-item {
        width: 2rem;
        height: 2rem;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.8rem;
        opacity: 0.5;
        border: 2px solid transparent;
        box-sizing: border-box;

        &:hover {
            filter: brightness(0.95);
        }
    }

    .horizon-item {
        background: hsl(var(--item-color-hue), 100%, 85%);
        color: hsl(var(--item-color-hue), 100%, 30%);

        &.active {
            opacity: 1;
            border-color: hsl(var(--item-color-hue), 100%, 80%);
        }
    }

    .add-horizon {
        background-color: #ececec;
        font-size: 1.1rem;
    }

    .hidden {
        opacity: 0;
        pointer-events: none;
        position: absolute;
    }
</style>