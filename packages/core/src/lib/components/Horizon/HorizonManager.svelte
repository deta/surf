<script lang="ts">
  import { onMount } from 'svelte'
  import { derived, writable } from 'svelte/store'

  import { Lethargy } from "lethargy-ts";


  import { API } from '@horizon/core/src/lib/service/api'
  import { HorizonsManager, Horizon as IHorizon } from '@horizon/core/src/lib/service/horizon'

  import './index.scss'

  import Horizon from './Horizon.svelte'
  import { useLogScope } from '../../utils/log'
  import Stack from '../Stack/Stack.svelte'
  import StackItem from '../Stack/StackItem.svelte'
  import HorizonPreview from './HorizonPreview.svelte'
  import HorizonSwitcherItem from './HorizonSwitcherItem.svelte'
  import { spring } from 'svelte/motion'

  const log = useLogScope('HorizonManager')
  const api = new API()
  const horizonManager = new HorizonsManager(api)
  const lethargy = new Lethargy({
    sensitivity: 70,
    delay: 20,
    inertiaDecay: 200,
  });
  // const fps = useFPS()

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
            setTimeout(() => $stackOverviewScrollOffset = 0, 200)
        }
    }

    /* NEW GESTURE STUFF */

    const stackOverviewScrollOffset = spring(0, {
        stiffness: 0.85,
        damping: 0.97,
    });

    // const snapSpring = spring(0, {
    //   stiffness: 0.85,
    //   damping: 0.97,
    // });
    const snapSpring = writable(0);
    let stillScrolling = false;

    let canSwitchAgain = true;
    let canSwitchTimer: any = null;

    $: if (Math.abs($snapSpring) > 720 && !showStackOverview && canSwitchAgain) {
      let cancel = false;
      if (Math.sign($snapSpring) > 0) {
        moveToNextHorizon();
      } else {
        moveToPreviousHorizon();
        if (activeStackItemIdx === 0) cancel = true;
      }

      if (!cancel) {
        snapSpring.set(-$snapSpring);
        canSwitchTimer && clearTimeout(canSwitchTimer);
        canSwitchTimer = setTimeout(() => {
          canSwitchAgain = true;
        }, 800);
        canSwitchAgain = false;
      }
    }

    let wheelResetTimer: any = null;
    function handleWheel(e: WheelEvent) {
      if (showStackOverview) {
        stackOverviewScrollOffset.update((v) => {
          v += e.deltaY;
          // v = Math.min(0, Math.max(v, 2000));
          // v = Math.min(Math.max(v, 0),  2000);
          return v;
        });
        // if ($stackOverviewScrollOffset < 0) stackOverviewScrollOffset.set(0, { hard: true  })
      }
      else {
        const isIntentional = lethargy.check(e);

        if (isIntentional) {
          if (!stillScrolling) stillScrolling = true;
          if (!isAnimating) requestAnimationFrame(frame);
          snapSpring.update((v) => {
            v += e.deltaY;
            return v;
          });
          console.log('intentional', e.deltaY);

          wheelResetTimer && clearTimeout(wheelResetTimer);
          wheelResetTimer = setTimeout(() => {
            stillScrolling = false;
          }, 80);
        }
      }
    }

    let isAnimating = false;
    function frame() {
      requestAnimationFrame(frame);
      isAnimating = true;
      snapSpring.update(v => {
        if (stillScrolling) return v;// * 0.97;
        v *= 0.96;
        if (Math.abs(v) < 0.01) {
          v = 0;
          isAnimating = false;
        }
        return v;
      });
      // Calculate the velocity from the change in scroll
      // const velocity = (scrollCounter - lastScrollCnt) / diff;

      // scrollRate.update(v => {
      //   v = $scrollCounter - lastScrollCnt // (Date.now() - lastFrameTime)
      //   // v *= 0.9;
      //   // if (v < 0.01) v = 0;
      //   return v;
      // });
      // lastScrollCnt = $scrollCounter;
      // lastFrameTime = Date.now();
      // $snapWheel = 0;
    }
    onMount(frame)

    /*let lockSwipe = false
    let SWIPE_LOCK_DURATION = 1300
    let SWIPE_THRESHOLD = 300

    const handleGestureEnd = (g: any) => {
        const event = (g as any).event as TouchEvent | undefined

        if (g.scale < 1 && !showStackOverview) {
            log.debug('scale down')
            showStackOverview = true
        } else if (g.scale > 1 && showStackOverview) {
            log.debug('scale up')
            showStackOverview = false
        }
    }*/

    /*
        Flow:

        - on wheel event, check if it's intentional scroll
        - if it is, start tracking the movement and apply movementOffset to the stack to reflect user's intention
        - if threshold is reached, switch to next/previous horizon and reset movementOffset
        - if intentional scroll ends reset movementOffset
    */

    /*let lastWheelDeltaY = 0
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
    }*/

  onMount(() => {
    horizonManager.init()
  })
</script>

<svelte:window on:keydown={handleKeyDown} on:wheel={handleWheel} />

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
        movementOffset={snapSpring}
        overviewOffset={stackOverviewScrollOffset}
        bind:activeIdx={activeStackItemIdx}
        bind:showOverview={showStackOverview}
        on:select={handleStackItemSelect}
    >
        {#each $horizons as horizon, idx (horizon.id)}
            <StackItem index={idx} showOverview={showStackOverview} highlight={activeStackItemIdx === idx} on:select={handleStackItemSelect}>
                {#if horizon?.state === 'hot'}
                    <Horizon horizon={horizon} active={$activeHorizonId === horizon.id} on:change={handleHorizonChange} />
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
