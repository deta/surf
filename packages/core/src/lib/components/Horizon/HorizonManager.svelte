<script lang="ts">
    import { onMount } from "svelte";

    import { API } from "@horizon/core/src/lib/service/api";
    import { HorizonsManager } from "@horizon/core/src/lib/service/horizon";

    import Horizon from "./Horizon.svelte";

    const api = new API()
    const horizonManager = new HorizonsManager(api)

    const horizons = horizonManager.horizons
    const hotHorizons = horizonManager.hotHorizons
    const activeHorizonId = horizonManager.activeHorizonId
    const activeHorizon = horizonManager.activeHorizon

    horizons.subscribe(e => console.log('horizons changed', e))

    $: console.log('horizons', $horizons.map(e => ({...e, state: e.getState()})))
    $: console.log('hotHorizons', $hotHorizons.map(e => ({...e, state: e.getState()})))
    $: console.log('activeHorizonId', $activeHorizonId)
    $: console.log('activeHorizon', $activeHorizon)

    const handleSwitch = () => {
        const nextHorizon = $horizons.find(e => e.id !== $activeHorizonId)
        if (nextHorizon) {
            horizonManager.switchHorizon(nextHorizon.id)
        }
    }

    onMount(() => {
        horizonManager.init()
    })
</script>

<main class="">
    <button on:click={handleSwitch}>Switch Horizon</button>
    {#each $hotHorizons as hotHorizon (hotHorizon.id)}
        <div data-hot-horizon={hotHorizon.id} class:hidden={hotHorizon.id !== $activeHorizonId}>
            <Horizon horizon={hotHorizon} />
        </div>
    {/each}
</main>

<style>
    .hidden {
        opacity: 0;
        pointer-events: none;
        position: absolute;
    }
</style>