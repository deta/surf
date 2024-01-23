<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { derived } from 'svelte/store'

  import { API } from '@horizon/core/src/lib/service/api'
  import { HorizonsManager } from '@horizon/core/src/lib/service/horizon'

  import Horizon from './Horizon.svelte'
  import { useLogScope } from '../../utils/log'
  import HorizonSwitcherItem from './HorizonSwitcherItem.svelte'
  import { useFPS } from '../../utils/performance'

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

  let showOverview = false
  let horizonListElem: HTMLElement

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

  const switchHorizon = async (id: string) => {
    const nextHorizon = $horizons.find((e) => e.id === id)
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

  const handleAddHorizon = () => {
    addHorizon()
    closeOverview()
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey) {
      if (event.key === 'n') {
        event.preventDefault()
        addHorizon()
      } else if (event.key === 'k') {
        event.preventDefault()
        log.debug('toggle overview')

        if (showOverview) {
            closeOverview()
        } else {
            showOverview = true
        }
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

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  const waitForScrollToFinish = (elem: HTMLElement) => {
    return new Promise<void>((resolve) => {
        let scrollTimeout: ReturnType<typeof setTimeout>;

        const handleScroll = () => {
            clearTimeout(scrollTimeout)
            scrollTimeout = setTimeout(() => {
                elem.removeEventListener('scroll', handleScroll)
                resolve()
            }, 100)
        }

        elem.addEventListener('scroll', handleScroll)
    })
  }

  let nextHorizonId: string | null = null
  let transitioning = false

  $: console.log('transitioning', transitioning)

  const closeOverview = () => {
    const nextHorizonElem = document.querySelector(`[data-hot-horizon="${$activeHorizonId}"]`) as HTMLElement

    // elem.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // await waitForScrollToFinish(horizonListElem)
    // console.log('scroll finished')
    
    transitioning = true
    showOverview = false
    horizonListElem.scrollTop = 0

    nextHorizonElem.ontransitionend = () => {
        console.log('transition finished')
        transitioning = false
        nextHorizonElem.ontransitionend = null
    }
  }

  const handleHorizonClick = async (e: MouseEvent, id: string) => {
    if (!showOverview) return

    e.preventDefault()
    $activeHorizonId = id

    closeOverview()

    await wait(500)
    
    switchHorizon(id)
  }

  onMount(() => {
    horizonManager.init()
  })
</script>

<svelte:window on:keydown={handleKeyDown} />

<main class="">
    <!-- fps {$fps} -->
    <!-- <div class="horizon-list">
        {#each $horizons as horizon, idx (horizon.id)}
            <HorizonSwitcherItem horizon={horizon} active={$activeHorizonId === horizon.id} idx={idx + 1} hot={$hotHorizons.includes(horizon)} on:click={() => switchHorizon(horizon.id)} />
        {/each}

        <div on:click={() => addHorizon()} class="add-horizon" style="--item-color: #f2f2f2;">
            +
        </div>
    </div> -->

    <div class="horizons-wrapper" class:overview={showOverview}>
        {#if showOverview}
            <div class="overview-header">
                <div class="add-horizon" on:click={handleAddHorizon}>
                    +
                </div>
            </div>
        {/if}

        <div bind:this={horizonListElem} class="horizons-list">
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            {#each $hotHorizons as hotHorizon, idx (hotHorizon.id)}
                {@const order = $sortedHotHorizons.findIndex(h => h === hotHorizon.id) + 1}
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <div
                    on:click={(e) => handleHorizonClick(e, hotHorizon.id)}
                    class="hot-horizon"
                    style="--offset: {idx}; --order: {order};"
                    data-first={order === 1}
                    data-last={order === $sortedHotHorizons.length}
                    data-hot-horizon={hotHorizon.id}
                    class:list-view={nextHorizonId !== hotHorizon.id && showOverview}
                    class:hidden={$activeHorizonId !== hotHorizon.id && !showOverview}
                >
                    <Horizon horizon={hotHorizon} />
                </div>
            {/each}
        </div>
    </div>
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
        // background-color: #ececec;
        font-size: 1.1rem;

        &:hover {
            filter: brightness(0.95);
        }
    }

    .overview-header {
        position: absolute;
        top: 0;
        left: 0;
        box-sizing: border-box;
        width: 100vw;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
    }

    .horizons-wrapper {
        min-height: 100vh;
        // padding: 0;
        // transition: padding var(--transition-duration) ease-out;
    }

    .horizons-list {
        --height: 100vh;
        --width: 100vw;
        --transition-duration: 0.3s;
        --scale-factor: 0.65;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3rem;
        height: 100vh;
    }

    .overview {
        // padding: 4rem;

        & .horizons-list {
            scroll-snap-type: y mandatory;
            overflow-y: scroll;
            height: 100vh;

            & [data-first="true"] {
                margin-top: 50vh;
            }

            & [data-last="true"] {
                margin-bottom: 50vh;
            }
        }
    }

    .hot-horizon {
        position: relative;
        transition-property: width, height, border-color, border-radius;
        transition-duration: var(--transition-duration);
        transition-timing-function: ease-out;
        width: var(--width);
        height: var(--height);
        border: 5px solid transparent;
        overflow: hidden;
        border-radius: 0;
        margin-top: auto;
        margin-bottom: auto;

        &.transitioning-out {
            position: absolute;
            opacity: 1;
            pointer-events: none;
            top: 100%;
            transform: translateY(-10%);
            height: calc(var(--height) * var(--scale-factor));
            width: calc(var(--width) * var(--scale-factor));

            & :global(.horizon) {
                pointer-events: none;
                opacity: 1;
                transform: translate(-50%, -50%) scale(var(--scale-factor));
            }
        }

        &.hidden {
            opacity: 0;
            pointer-events: none;
            position: absolute;
        }

        &.list-view {
            flex-shrink: 0;
            scroll-snap-align: center;
            height: calc(var(--height) * var(--scale-factor));
            width: calc(var(--width) * var(--scale-factor));
            opacity: 1;
            border-radius: 2rem;
            border-color: #cfcfcf;
            box-shadow: 0 0 2px rgba(0, 0, 0, 0.3);
            cursor: pointer;
            order: var(--order);

            & :global(.horizon) {
                pointer-events: none;
                opacity: 1;
                transform: translate(-50%, -50%) scale(var(--scale-factor));
            }
        }

        & :global(.horizon) {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(1);
            transition: transform var(--transition-duration) ease-out;
        }
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
