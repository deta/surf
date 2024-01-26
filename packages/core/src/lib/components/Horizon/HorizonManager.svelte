<script lang="ts">
  import { onMount } from 'svelte'
  import { derived } from 'svelte/store'

  import { twoFingers, type Gesture } from "@skilitics-public/two-fingers";
  import { Lethargy } from "lethargy-ts";


  import { API } from '@horizon/core/src/lib/service/api'
  import { HorizonsManager } from '@horizon/core/src/lib/service/horizon'

  import './index.scss'

  import Horizon from './Horizon.svelte'
  import { useLogScope } from '../../utils/log'
  import Stack from '../Stack/Stack.svelte'
  import StackItem from '../Stack/StackItem.svelte'
    import HorizonPreview from './HorizonPreview.svelte'
    import { tweened } from 'svelte/motion'
    import { cubicIn, quintIn } from 'svelte/easing'

  const log = useLogScope('HorizonManager')
  const api = new API()
  const horizonManager = new HorizonsManager(api)
  const lethargy = new Lethargy();
  // const fps = useFPS()

  const horizons = horizonManager.horizons
  const hotHorizons = horizonManager.hotHorizons
  const coldHorizons = horizonManager.coldHorizons
  const sortedHorizons = horizonManager.sortedHorizons
  const horizonStates = horizonManager.horizonStates
  const activeHorizon = horizonManager.activeHorizon

  let activeStackItemIdx = 0
  let showStackOverview = false

  horizons.subscribe((e) => log.debug('horizons changed', e))

  $: log.debug('sortedHorizons', $sortedHorizons)
  $: log.debug('activeStackItemIdx', activeStackItemIdx)
  $: log.debug('horizonStates', Array.from($horizonStates).map(([id, state]) => ({ id, ...state })))

  const addHorizon = async () => {
    const newHorizon = await horizonManager.createHorizon(`Horizon ${$horizons.length + 1}`)
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
        // } else {
        //     const indexes = $horizons.map((_e, idx) => idx + 1)
        //     const index = indexes.indexOf(Number(event.key))
        //     if (index !== -1) {
        //         event.preventDefault()
        //         switchHorizon($horizons[index].id)
        //     }
        // }
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
        // log.debug('gesture start', g)

        // const event = (g as any).event as WheelEvent | undefined
        // if (event) {
        //     event.preventDefault()
        //     event.stopPropagation()
        // }

        // lockSwipe = false
    }

    const handleGestureChange = (g: Gesture) => {
        // log.debug('gesture change', g)

        // if (lockSwipe) return

        // if (g.translation.y > SWIPE_THRESHOLD) {
        //     moveToPreviousHorizon()
            
        //     lockSwipe = true
        //     setTimeout(() => {
        //         lockSwipe = false
        //     }, SWIPE_LOCK_DURATION)
        // } else if (g.translation.y < -SWIPE_THRESHOLD) {
        //     moveToNextHorizon()

        //     lockSwipe = true
        //     setTimeout(() => {
        //         lockSwipe = false
        //     }, SWIPE_LOCK_DURATION)
        // }
    }

    const handleGestureEnd = (g: Gesture) => {
        const event = (g as any).event as TouchEvent | undefined

        if (g.scale < 1 && !showStackOverview) {
            log.debug('scale down')
            showStackOverview = true
        } else if (g.scale > 1 && showStackOverview) {
            log.debug('scale up')
            showStackOverview = false
        }
    }

    /* 
        Flow:

        - on wheel event, check if it's intentional scroll
        - if it is, start tracking the movement and apply movementOffset to the stack to reflect user's intention
        - if threshold is reached, switch to next/previous horizon and reset movementOffset
        - if intentional scroll ends reset movementOffset
    */

    let lastWheelDeltaY = 0
    let accelarating = false
    let movementOffset = 0
    const movementOffsetTweened = tweened(0, { duration: 100, easing: cubicIn })

    let timeout: ReturnType<typeof setTimeout> | undefined

    const SCROLL_TIMEOUT = 300
    const INTENTIONAL_SCROLL_DELAY = 300
    const SCROLL_BOUNDS = window.innerHeight
    const INTENTIONAL_SCROLL_THRESHOLD = SCROLL_BOUNDS * 0.3

    let lastIntentionalScrollTime = 0
    let scrollDistance = 0
    let trackingMovement = false

    // $: console.log('movementOffset', $movementOffsetTweened)

    const scrollToMovement = (scrollDistance: number) => {
        const limitedScroll = Math.max(Math.min(scrollDistance, SCROLL_BOUNDS), -SCROLL_BOUNDS) * -1
        
        const eased = quintIn(limitedScroll / 100)

        return limitedScroll
    }

    const handleIntentionalScrollChange = (e: WheelEvent) => {
        // round to get rid of jitter
        // movementOffset += Math.round((e.deltaY * -1) / 10) * 10
        // movementOffsetTweened.set(movementOffset)
    }

    const handleIntentionalScrollStart = (e: WheelEvent) => {
        trackingMovement = true
        log.debug('intentional scroll start')
    }

    const handleIntentionalScrollEnd = (e: WheelEvent) => {
        trackingMovement = false
        scrollDistance = 0
        movementOffset = 0
        log.debug('intentional scroll end')
    }

    const handleWheel = (e: WheelEvent) => {
        const isIntentional = lethargy.check(e);

        clearTimeout(timeout)

        if (trackingMovement) {
            scrollDistance += e.deltaY

            movementOffset = scrollToMovement(scrollDistance)

            if (movementOffset >= INTENTIONAL_SCROLL_THRESHOLD) {
                handleIntentionalScrollEnd(e)
                moveToPreviousHorizon()
            } else if (movementOffset <= -INTENTIONAL_SCROLL_THRESHOLD) {
                handleIntentionalScrollEnd(e)
                moveToNextHorizon()
            }
        }

        if (isIntentional) {
            lastIntentionalScrollTime = Date.now()

            if (!trackingMovement) {
                handleIntentionalScrollStart(e)
            }

            handleIntentionalScrollChange(e)
        } else {
            const timeDelta = Date.now() - lastIntentionalScrollTime
            if (trackingMovement && timeDelta > INTENTIONAL_SCROLL_DELAY) {
                handleIntentionalScrollEnd(e)
            }
        }

        timeout = setTimeout(() => {
            handleIntentionalScrollEnd(e)
        }, SCROLL_TIMEOUT)
    }

  onMount(() => {
    horizonManager.init()

    const unregister = twoFingers(document as unknown as HTMLElement, {
        onGestureStart: handleGestureStart,
        onGestureChange: handleGestureChange,
        onGestureEnd: handleGestureEnd,
    });


  })
</script>

<svelte:window on:keydown={handleKeyDown} on:wheel={handleWheel} />

<svelte:head>
    <title>{$activeHorizon?.data.name}</title>
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
        movementOffset={movementOffset}
        bind:activeIdx={activeStackItemIdx}
        bind:showOverview={showStackOverview}
        on:select={handleStackItemSelect}
    >
        {#each $horizons as horizon, idx (horizon.id)}
            <StackItem index={idx} showOverview={showStackOverview} highlight={activeStackItemIdx === idx} on:select={handleStackItemSelect}>
                {#if $horizonStates.get(horizon.id)?.state === 'hot'}
                    <Horizon horizon={horizon} />
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
