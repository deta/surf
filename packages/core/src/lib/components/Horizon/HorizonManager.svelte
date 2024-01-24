<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { derived } from 'svelte/store'

  import { API } from '@horizon/core/src/lib/service/api'
  import { HorizonsManager } from '@horizon/core/src/lib/service/horizon'

  import Horizon from './Horizon.svelte'
  import { useLogScope } from '../../utils/log'
  import HorizonSwitcherItem from './HorizonSwitcherItem.svelte'
  import { useFPS } from '../../utils/performance'
    import Switcher from '../SwitcherPrototype.svelte'
    import Stack from '../Stack/Stack.svelte'
    import StackItem from '../Stack/StackItem.svelte'

  const log = useLogScope('HorizonManager')
  const api = new API()
  const horizonManager = new HorizonsManager(api)
  // const fps = useFPS()

  const horizons = horizonManager.horizons
  const hotHorizons = horizonManager.hotHorizons
  const sortedHotHorizons = horizonManager.sortedHotHorizons
  const horizonStates = horizonManager.horizonStates
  const activeHorizonId = horizonManager.activeHorizonId
  const activeHorizon = horizonManager.activeHorizon

  let activeStackItemIdx = 0
  let showStackOverview = false

  horizons.subscribe((e) => log.debug('horizons changed', e))

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

  const addHorizon = async () => {
    const newHorizon = await horizonManager.createHorizon('New Horizon' + $horizons.length)
    await horizonManager.switchHorizon(newHorizon.id)

    activeStackItemIdx = $hotHorizons.length - 1
  }

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.metaKey || event.ctrlKey) {
            if (event.key === 'n') {
                event.preventDefault()
                addHorizon()
            } else if (event.key === 'k' || event.key === ' ' || event.code === 'Space') {
                event.preventDefault()
                showStackOverview = !showStackOverview
            } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                activeStackItemIdx = Math.max(0, activeStackItemIdx - 1)
            } else if (event.key === 'ArrowDown') {
                event.preventDefault()
                activeStackItemIdx = Math.min($hotHorizons.length - 1, activeStackItemIdx + 1)
            }
            // } else {
            //     const indexes = $horizons.map((_e, idx) => idx + 1)
            //     const index = indexes.indexOf(Number(event.key))
            //     if (index !== -1) {
            //         event.preventDefault()
            //         switchHorizon($horizons[index].id)
            //     }
            // }
        }
    }

    const handleStackItemSelect = (e: CustomEvent<number>) => {
        log.debug('select stack item', e.detail)
        const selectedHorizon = $hotHorizons[e.detail]
        if (selectedHorizon) {
            horizonManager.switchHorizon(selectedHorizon)
        }
    }

  onMount(() => {
    horizonManager.init()
  })
</script>

<svelte:window on:keydown={handleKeyDown} />

<main class="" class:overview={showStackOverview}>
    <!-- fps {$fps} -->
    <!-- <div class="horizon-list">
        {#each $horizons as horizon, idx (horizon.id)}
            <HorizonSwitcherItem horizon={horizon} active={$activeHorizonId === horizon.id} idx={idx + 1} hot={$hotHorizons.includes(horizon)} on:click={() => switchHorizon(horizon.id)} />
        {/each}

        <div on:click={() => addHorizon()} class="add-horizon" style="--item-color: #f2f2f2;">
            +
        </div>
    </div> -->

    <Stack
        len={$hotHorizons.length - 1}
        options={{ transitionDuration: 0.2 }}
        bind:activeIdx={activeStackItemIdx}
        bind:showOverview={showStackOverview}
        on:select={handleStackItemSelect}
        let:selectItem={selectStackItem}
    >
        {#each $hotHorizons as hotHorizon, idx (hotHorizon.id)}
            <StackItem showOverview={showStackOverview} on:select={() => selectStackItem(idx)}>
                <Horizon horizon={hotHorizon} />
            </StackItem>
        {/each}
    </Stack>
</main>

<style lang="scss">
    main {
        min-height: 100vh;
        background: #efefef;
    }

    :global(.horizon) {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(var(--scale));
        transition: transform var(--transition-duration) var(--transition-timing-function);
    }

    // .horizon-list {
    //     position: fixed;
    //     top: 0;
    //     left: 0;
    //     z-index: 1000;
    //     display: flex;
    //     align-items: center;
    //     gap: 0.5rem;
    //     padding: 0.5rem;
    //     padding-left: 1rem;
    // }

    // .add-horizon {
    //     width: 2rem;
    //     height: 2rem;
    //     border-radius: 8px;
    //     cursor: pointer;
    //     display: flex;
    //     align-items: center;
    //     justify-content: center;
    //     font-size: 0.8rem;
    //     opacity: 0.5;
    //     border: 2px solid transparent;
    //     box-sizing: border-box;
    //     // background-color: #ececec;
    //     font-size: 1.1rem;

    //     &:hover {
    //         filter: brightness(0.95);
    //     }
    // }

    // .overview-header {
    //     position: absolute;
    //     top: 0;
    //     left: 0;
    //     box-sizing: border-box;
    //     width: 100vw;
    //     display: flex;
    //     align-items: center;
    //     justify-content: center;
    //     padding: 1rem;
    // }

    // .horizons-wrapper {
    //     min-height: 100vh;
    //     // padding: 0;
    //     // transition: padding var(--transition-duration) ease-out;
    // }

    // .horizons-list {
    //     --height: 100vh;
    //     --width: 100vw;
    //     --transition-duration: 0.3s;
    //     --scale-factor: 0.65;
    //     display: flex;
    //     flex-direction: column;
    //     align-items: center;
    //     gap: 3rem;
    //     height: 100vh;
    // }

    // .overview {
    //     // padding: 4rem;

    //     & .horizons-list {
    //         scroll-snap-type: y mandatory;
    //         overflow-y: scroll;
    //         height: 100vh;

    //         & [data-first="true"] {
    //             margin-top: 50vh;
    //         }

    //         & [data-last="true"] {
    //             margin-bottom: 50vh;
    //         }
    //     }
    // }

    // .hot-horizon {
    //     position: relative;
    //     transition-property: width, height, border-color, border-radius;
    //     transition-duration: var(--transition-duration);
    //     transition-timing-function: ease-out;
    //     width: var(--width);
    //     height: var(--height);
    //     border: 5px solid transparent;
    //     overflow: hidden;
    //     border-radius: 0;
    //     margin-top: auto;
    //     margin-bottom: auto;

    //     &.transitioning-out {
    //         position: absolute;
    //         opacity: 1;
    //         pointer-events: none;
    //         top: 100%;
    //         transform: translateY(-10%);
    //         height: calc(var(--height) * var(--scale-factor));
    //         width: calc(var(--width) * var(--scale-factor));

    //         & :global(.horizon) {
    //             pointer-events: none;
    //             opacity: 1;
    //             transform: translate(-50%, -50%) scale(var(--scale-factor));
    //         }
    //     }

    //     &.hidden {
    //         opacity: 0;
    //         pointer-events: none;
    //         position: absolute;
    //     }

    //     &.list-view {
    //         flex-shrink: 0;
    //         scroll-snap-align: center;
    //         height: calc(var(--height) * var(--scale-factor));
    //         width: calc(var(--width) * var(--scale-factor));
    //         opacity: 1;
    //         border-radius: 2rem;
    //         border-color: #cfcfcf;
    //         box-shadow: 0 0 2px rgba(0, 0, 0, 0.3);
    //         cursor: pointer;
    //         order: var(--order);

    //         & :global(.horizon) {
    //             pointer-events: none;
    //             opacity: 1;
    //             transform: translate(-50%, -50%) scale(var(--scale-factor));
    //         }
    //     }

    //     & :global(.horizon) {
    //         position: absolute;
    //         top: 50%;
    //         left: 50%;
    //         transform: translate(-50%, -50%) scale(1);
    //         transition: transform var(--transition-duration) ease-out;
    //     }
    // }

    // :global(.preview-horizon) {
    //     position: absolute !important;
    //     opacity: 1 !important;
    //     top: 3.5rem;
    //     left: calc(1rem + (var(--offset) * (32px + 0.5rem)));
    //     transform: scale(0.45);
    //     transform-origin: 0 0;
    //     z-index: 100;
    //     border: 10px solid #fbc7ff;
    //     border-radius: 2rem;
    //     overflow: hidden;
    //     box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
    // }
</style>
