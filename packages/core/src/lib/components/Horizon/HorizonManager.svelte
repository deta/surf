<script lang="ts">
  import { onMount } from 'svelte'
 
  import { twoFingers, type Gesture } from "@skilitics-public/two-fingers";

  import { API } from '@horizon/core/src/lib/service/api'
  import { HorizonsManager, Horizon as IHorizon } from '@horizon/core/src/lib/service/horizon'

  import './index.scss'

  import Horizon from './Horizon.svelte'
  import { useLogScope } from '../../utils/log'
  import Stack from '../Stack/Stack.svelte'
  import StackItem from '../Stack/StackItem.svelte'
  import HorizonPreview from './HorizonPreview.svelte'

  const log = useLogScope('HorizonManager')
  const api = new API()
  const horizonManager = new HorizonsManager(api)

  const horizons = horizonManager.horizons
  const activeHorizonId = horizonManager.activeHorizonId
  const activeHorizon = horizonManager.activeHorizon

  let activeStackItemIdx = 0
  let showStackOverview = false

  activeHorizonId.subscribe((e) => {
    const newIdx = $horizons.findIndex((h) => h.id === e)
    activeStackItemIdx = newIdx
  })

  $: log.debug('horizons changed', $horizons)
  $: log.debug('activeStackItemIdx', activeStackItemIdx)

  const addHorizon = async () => {
    const newHorizon = await horizonManager.createHorizon('New Horizon ' + $horizons.length)
    await horizonManager.switchHorizon(newHorizon.id)

    activeStackItemIdx = $horizons.length - 1
    showStackOverview = false
  }

  const moveToNextHorizon = () => {
    const nextIdx = activeStackItemIdx + 1
    if (nextIdx >= $horizons.length) {
        addHorizon()
    } else {
        activeStackItemIdx = nextIdx
        if (!showStackOverview) {
            horizonManager.switchHorizon($horizons[activeStackItemIdx])
        }
    }
  }

  const moveToPreviousHorizon = () => {
    activeStackItemIdx = Math.max(0, activeStackItemIdx - 1)
    if (!showStackOverview) {
        horizonManager.switchHorizon($horizons[activeStackItemIdx])
    }
  }

  const handleHorizonChange = async (e: CustomEvent<IHorizon>) => {
    const horizon = e.detail
    log.debug('horizon changed', horizon)
    await horizonManager.updateHorizon(horizon.id, horizon.data)
  }

    const handleKeyDown = (event: KeyboardEvent) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'n') {
            event.preventDefault()
            addHorizon()
        } else if (((event.metaKey || event.ctrlKey) && event.key === 'k') || event.key === ' ' || event.code === 'Space') {
            event.preventDefault()
            if (showStackOverview) {
                horizonManager.switchHorizon($horizons[activeStackItemIdx])
                showStackOverview = false
            } else {
                showStackOverview = true
            }
        } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            moveToPreviousHorizon()
        } else if (event.key === 'ArrowDown') {
            event.preventDefault()
            moveToNextHorizon()
        }
    }

    const handleStackItemSelect = async (e: CustomEvent<number>) => {
        log.debug('select stack item idx', e.detail)
        const selectedHorizon = $horizons[e.detail]
        if (selectedHorizon) {
            log.debug('switch horizon', selectedHorizon)
            horizonManager.switchHorizon(selectedHorizon)

            activeStackItemIdx = e.detail
            showStackOverview = false
        }
    }

    let lockSwipe = false
    let SWIPE_LOCK_DURATION = 1300
    let SWIPE_THRESHOLD = 300

    const handleGestureStart = (g: Gesture) => {
        log.debug('gesture start', g)

        // const event = (g as any).event as WheelEvent | undefined
        // if (event) {
        //     event.preventDefault()
        //     event.stopPropagation()
        // }

        // lockSwipe = false
    }

    const handleGestureChange = (g: Gesture) => {
        // log.debug('gesture change', g)

        if (lockSwipe) return

        if (g.translation.y > SWIPE_THRESHOLD) {
            moveToPreviousHorizon()
            
            lockSwipe = true
            setTimeout(() => {
                lockSwipe = false
            }, SWIPE_LOCK_DURATION)
        } else if (g.translation.y < -SWIPE_THRESHOLD) {
            moveToNextHorizon()

            lockSwipe = true
            setTimeout(() => {
                lockSwipe = false
            }, SWIPE_LOCK_DURATION)
        }
    }

    const handleGestureEnd = (g: Gesture) => {
        log.debug('gesture end', g)

        const event = (g as any).event as TouchEvent | undefined

        if (g.scale < 1 && !showStackOverview) {
            log.debug('scale down')
            showStackOverview = true
        } else if (g.scale > 1 && showStackOverview) {
            log.debug('scale up')
            showStackOverview = false
        }

        // if (g.translation.y > 0) {
        //     activeStackItemIdx = Math.max(0, activeStackItemIdx - 1)
        // } else if (g.translation.y < 0) {
        //     activeStackItemIdx = Math.min($horizons.length - 1, activeStackItemIdx + 1)
        // }
    }

    // const handleWheel = (e: WheelEvent) => {
    //     if (!showStackOverview) return

    //     e.preventDefault()
    //     e.stopPropagation()

    //     log.debug('wheel', e.deltaY)


    //     if (e.deltaY < 0) {
    //         activeStackItemIdx = Math.max(0, activeStackItemIdx - 1)
    //     } else if (e.deltaY > 0) {
    //         activeStackItemIdx = Math.min($horizons.length - 1, activeStackItemIdx + 1)
    //     }
    // }

  onMount(() => {
    horizonManager.init()

    const unregister = twoFingers(document as unknown as HTMLElement, {
        onGestureStart: handleGestureStart,
        onGestureChange: handleGestureChange,
        onGestureEnd: handleGestureEnd,
    });
  })
</script>

<svelte:window on:keydown={handleKeyDown} />

<svelte:head>
    <title>{$activeHorizon?.data?.name ?? 'Space OS'} {$activeHorizon?.state}</title>
</svelte:head>

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
        options={{ transitionDuration: 0.2 }}
        bind:activeIdx={activeStackItemIdx}
        bind:showOverview={showStackOverview}
        on:select={handleStackItemSelect}
    >
        {#each $horizons as horizon, idx (horizon.id)}
            <StackItem index={idx} showOverview={showStackOverview} highlight={activeStackItemIdx === idx} on:select={handleStackItemSelect}>
                {#if horizon?.state === 'hot'}
                    <Horizon horizon={horizon} on:change={handleHorizonChange} />
                {:else}
                    <HorizonPreview horizon={horizon} />
                {/if}
            </StackItem>
        {/each}

        <!-- {#each $hotHorizons as hotHorizon (hotHorizon.id)}
            {@const idx = $sortedHorizons.findIndex((h) => h === hotHorizon.id)}
            <StackItem showOverview={showStackOverview} index={idx} on:select={() => selectStackItem(idx)}>
                <Horizon horizon={hotHorizon} />
            </StackItem>
        {/each}

        {#each $coldHorizons as coldHorizon (coldHorizon.id)}
            {@const idx = $sortedHorizons.findIndex((h) => h === coldHorizon.id)}
            <StackItem showOverview={showStackOverview} index={idx} on:select={() => selectStackItem(idx)}>
                <div>
                    {#if coldHorizon.data.previewImage}
                        <img src={coldHorizon.data.previewImage} alt="preview" />
                    {:else}
                    <p>no preview available</p>
                    {/if}
                </div>
            </StackItem>
        {/each} -->
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
