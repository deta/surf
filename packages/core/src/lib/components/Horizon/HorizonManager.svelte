<script lang="ts">
  import { onMount, tick } from 'svelte'
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
  import MediaImporter from './MediaImporter.svelte'
    import { advancedSpring } from '../../utils/advancedSpring'
    import { wait } from '../../utils/time'

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

  const SORTING_TIMEOUT = 2000

  let activeStackItemIdx = 0
  let showStackOverview = false
  let sortingInProgress = false
  let sortingTimeout: ReturnType<typeof setTimeout> | null = null
  let sortedHorizons: string[] = []
  let initialSorting = false

  const addHorizon = async () => {
    const newHorizon = await horizonManager.createHorizon('New Horizon ' + $horizons.length)
    await horizonManager.switchHorizon(newHorizon.id)

    activeStackItemIdx = $horizons.length - 1
    showStackOverview = false
  }

  const sortHorizons = async () => {
    sortingInProgress = true
    log.debug('test sortHorizons', $horizons)
    const oldHorizonStackIdx = sortedHorizons.findIndex((h) => h === $activeHorizonId)

    const newSorting = [...$horizons]
      .sort((a, b) => {
        if (!a || !b) return 0
        return b.lastUsed - a.lastUsed
      })
      .map((h) => h.id)

    const newHorizonStackIdx = newSorting.findIndex((h) => h === $activeHorizonId)

    log.debug('test sorting', { old: sortedHorizons, new: newSorting })
    log.debug('test indexing', { old: oldHorizonStackIdx, new: newHorizonStackIdx })

    sortedHorizons = newSorting
    activeStackItemIdx = newHorizonStackIdx

    await wait(200) // TODO: probably a better way to do this but needed to wait for the stack to update
    sortingInProgress = false
  }

  const createSortingTimeout = () => {
    sortingTimeout = setTimeout(() => {
      log.debug('sorting timeout reached')
      sortingTimeout = null
      sortHorizons()
    }, SORTING_TIMEOUT)
  }

  const changeActiveHorizon = async (horizonId: string) => {
    await horizonManager.switchHorizon(horizonId)

    const horizonStackIdx = sortedHorizons.findIndex((h) => h === horizonId)
    activeStackItemIdx = horizonStackIdx

    if (sortingTimeout) {
      clearTimeout(sortingTimeout)
      sortingTimeout = null
    }

    createSortingTimeout()
  }

  const moveToNextHorizon = () => {
    // $preventSorting = true
    const nextIdx = activeStackItemIdx + 1
    if (nextIdx >= $horizons.length) {
      addHorizon()
    } else {
      changeActiveHorizon(sortedHorizons[nextIdx])
      // activeStackItemIdx = nextIdx
      // if (!showStackOverview) {
      //   horizonManager.switchHorizon($horizons[activeStackItemIdx])
      // }
    }
  }

  const moveToPreviousHorizon = () => {
    // $preventSorting = true
    const nextIdx = Math.max(0, activeStackItemIdx - 1)
    changeActiveHorizon(sortedHorizons[nextIdx])
    // activeStackItemIdx = Math.max(0, activeStackItemIdx - 1)
    // if (!showStackOverview) {
    //   horizonManager.switchHorizon($horizons[activeStackItemIdx])
    // }
  }

  const handleHorizonChange = async (e: CustomEvent<IHorizon>) => {
    const horizon = e.detail
    log.debug('horizon changed', horizon)
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'n') {
      event.preventDefault()
      addHorizon()
    } else if (
      (event.metaKey || event.ctrlKey) &&
      (event.key === 'k' || event.key === ' ' || event.code === 'Space')
    ) {
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
    const selectedHorizon = sortedHorizons[e.detail]
    if (selectedHorizon) {
        changeActiveHorizon(selectedHorizon)
        showStackOverview = false
        $stackOverviewScrollOffset = 0
        // setTimeout(() => $stackOverviewScrollOffset = activeStackItemIdx * 708 - (64 * activeStackItemIdx), 200)
      }
  }
  
  $: if (!initialSorting && $horizons && $horizons.length > 0) {
    // log.debug('initial sorting')
    initialSorting = true
    sortedHorizons = $horizons.map((h) => h.id)
  }

  // prevent sorting when overview is open
  $: if (showStackOverview && sortingTimeout) {
    clearTimeout(sortingTimeout)
    sortingTimeout = null
  }

  $: if (!showStackOverview && activeStackItemIdx !== 0 && !sortingTimeout) {
    log.debug('edge case, no sorting timeout but not on first horizon')
    createSortingTimeout()
  }

    /* NEW GESTURE STUFF */

    const stackOverviewScrollOffset = spring(0, {
        stiffness: 0.85,
        damping: 0.97,
    });

    const flickSpring = advancedSpring(0, {
      // stiffness: 0.25,
      // damping: 0.9,
      stiffness: 0.65, // <- Juicy
      damping: 0.7, // <- Juicy
      min: -400,
      max: 400
    })
    const flickInertia = flickSpring.inertia;

    let stillScrolling = false;

    let canSwitchAgain = true;
    let canSwitchTimer: any = null;

    $: if (Math.abs($flickSpring) > 400 && !showStackOverview && canSwitchAgain) {
      let cancel = false;
      if (Math.sign($flickSpring) > 0) {
        moveToNextHorizon();
      } else {
        moveToPreviousHorizon();
        if (activeStackItemIdx === 0) cancel = true;
      }

      if (!cancel) {
        flickSpring.set(-$flickSpring);
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

          flickSpring.update((v: number) => {
            const eased = 1 - ((v+e.deltaY*1) / 1.3)^2;
            v = -eased;
            //v += e.deltaY;
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
      flickSpring.update((v: number) => {
        if (stillScrolling) return v;// * 0.97;
        v *= 0.96;
        if (Math.abs(v) < 0.01) {
          v = 0;
          isAnimating = false;
        }
        return v;
      });
    }
    // TODO: (Performance) We shuld only kick it off once the spring is changed probably and stop it after it settled!
    onMount(frame)

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

  {#if !showStackOverview && $activeHorizon}
    <MediaImporter horizon={$activeHorizon} />
  {/if}

  <Stack
    options={{ transitionDuration: 0.2 }}
    movementOffset={flickSpring}
    overviewOffset={stackOverviewScrollOffset}
    showTransitions={!sortingInProgress}
    bind:activeIdx={activeStackItemIdx}
    bind:showOverview={showStackOverview}
    on:select={handleStackItemSelect}
  >
    {#each $horizons as horizon, idx (horizon.id)}
      <StackItem
        order={sortedHorizons.findIndex((h) => h === horizon.id)}
        showOverview={showStackOverview}
        highlight={activeStackItemIdx === idx}
        on:select={handleStackItemSelect}
      >
        {#if horizon?.state === 'hot'}
          <Horizon
            {horizon}
            active={$activeHorizonId === horizon.id}
            on:change={handleHorizonChange}
          />
        {:else}
          <HorizonPreview {horizon} />
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
