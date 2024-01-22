<script lang="ts">
    import { onMount } from "svelte";
    import { derived } from "svelte/store";

    import { API } from "@horizon/core/src/lib/service/api";
    import { HorizonsManager } from "@horizon/core/src/lib/service/horizon";

    import Horizon from "./Horizon.svelte";
    import { useLogScope } from "../../utils/log";
    import HorizonSwitcherItem from "./HorizonSwitcherItem.svelte";
    import { useFPS } from "../../utils/performance";

    const log = useLogScope('HorizonManager')
    const api = new API()
    const horizonManager = new HorizonsManager(api)
    // const fps = useFPS()

    const horizons = horizonManager.horizons
    const hotHorizons = horizonManager.hotHorizons
    const horizonStates = horizonManager.horizonStates
    const activeHorizonId = horizonManager.activeHorizonId
    const activeHorizon = horizonManager.activeHorizon

    horizons.subscribe(e => log.debug('horizons changed', e))

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
    $: log.debug('hotHorizonsSorted', $hotHorizonsSorted)

    const switchHorizon = async (id: string) => {
        const nextHorizon = $horizons.find(e => e.id === id)
        if (nextHorizon) {
            horizonManager.switchHorizon(nextHorizon.id)
        } else {
            log.error('Horizon not found', id)
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
                const indexes = $horizons.map((_e, idx) => idx + 1)
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
    <!-- fps {$fps} -->
    <div class="horizon-list">
        {#each $horizons as horizon, idx (horizon.id)}
            <HorizonSwitcherItem horizon={horizon} active={$activeHorizonId === horizon.id} idx={idx + 1} hot={$hotHorizons.includes(horizon)} on:click={() => switchHorizon(horizon.id)} />
        {/each}

        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
        <div on:click={() => addHorizon()} class="add-horizon" style="--item-color: #f2f2f2;">
            +
        </div>
    </div>
    {#each $hotHorizons as hotHorizon (hotHorizon.id)}
        <div data-hot-horizon={hotHorizon.id} class:hidden={hotHorizon.id !== $activeHorizonId} style="--offset: {$horizons.findIndex(h => h.id === hotHorizon.id)}">
            <Horizon horizon={hotHorizon} />
        </div>
    {/each}
</main>

<style lang="scss">

    .horizon-list {
        position: fixed;
        top: 0;
        left: 0;
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem;
        padding-left: 1rem;
    }

    .add-horizon {
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
        background-color: #ececec;
        font-size: 1.1rem;

        &:hover {
            filter: brightness(0.95);
        }
    }

    .hidden {
        opacity: 0;
        pointer-events: none;
        position: absolute;
    }

    :global(.preview-horizon) {
        position: absolute !important;
        opacity: 1 !important;
        top: 3.5rem;
        left: calc(1rem + (var(--offset) * (32px + 0.5rem)));
        transform: scale(0.45);
        transform-origin: 0 0;
        z-index: 100;
        border: 10px solid #fbc7ff;
        border-radius: 2rem;
        overflow: hidden;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
    }
</style>