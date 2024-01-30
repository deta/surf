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
  import MediaImporter from './MediaImporter.svelte'
    import { advancedSpring } from '../../utils/advancedSpring'

  const log = useLogScope('HorizonManager')
  const api = new API()
  const horizonManager = new HorizonsManager(api)
  const lethargy = new Lethargy({

    // ORIGINAL MAXU:
    // sensitivity: 70,
    // delay: 80,
    // inertiaDecay: 200,

    // TEST MAXU
    sensitivity: 70,
    delay: 0,
    inertiaDecay: 43,
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

  //   $: log.debug('horizons changed', $horizons)
  //   $: log.debug('activeStackItemIdx', activeStackItemIdx)

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
    else if (event.ctrlKey && event.key === "9") {
      showFlickSettings = !showFlickSettings;
    }
  }

  const handleStackItemSelect = async (e: CustomEvent<number>) => {
    const selectedHorizon = $horizons[e.detail]
    if (selectedHorizon) {
      horizonManager.switchHorizon(selectedHorizon)

            activeStackItemIdx = e.detail
            showStackOverview = false
            setTimeout(() => $stackOverviewScrollOffset = activeStackItemIdx * 708 - (64 * activeStackItemIdx), 200)
        }
    }

    /* NEW GESTURE STUFF */

    // TODO: Remove, only for letting people adjust settings
    let showFlickSettings = false;
    let flickWeight = 1.43;
    let flickVisualWeight = 2.8;
    let flickThreshold = 135;
    let flickSpringReturn = 0.9;

    const stackOverviewScrollOffset = spring(0, {
        stiffness: 0.85,
        damping: 0.97,
    });

    let flickSpring = advancedSpring(0, {
      // stiffness: 0.25,
      // damping: 0.9,
      // stiffness: 0.65, // <- Juicy
      // damping: 0.7, // <- Juicy
      stiffness: 0.93, // <- Hefty
      damping: 1, // <- Hefty
      min: -400,
      max: 400
    })
    $: ({ inertia: flickInertia } = flickSpring);

    let stillScrolling = false;

    let canSwitchAgain = true;
    let canSwitchTimer: any = null;

    $: if (Math.abs($flickSpring) > flickThreshold && !showStackOverview && canSwitchAgain) {
      let cancel = false;
      if (Math.sign($flickSpring) > 0) {
        moveToNextHorizon();
      } else {
        moveToPreviousHorizon();
        if (activeStackItemIdx === 0) cancel = true;
      }

      if (!cancel) {
        flickSpring.set(-$flickSpring);
        //flickSpring.set(0);
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
            const eased = 1 - ((v+e.deltaY*1) / (1 * flickWeight))^2; // .../1.3)^2
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
        //if (stillScrolling) return v;// * 0.97;
        v *= flickSpringReturn;
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
  {#if showFlickSettings}
  <ul style="position: fixed;width:24%; top:0;right:0;z-index:5000;background:darkblue;font-family:monospace;color:white;padding:0.5rem;display:flex;gap:1rem;">
      <li style="display:flex;flex-direction:column;font-weight:600;">
        <span>activeStackItem:</span>
        <span>flickSpring:</span>
        <span>flickInertia:</span>
        <span>stillscrolling:</span>
        <hr style="margin-block: 0.25rem;">
        <span>Scroll Sensitivity ({lethargy.sensitivity}):</span>
        <span>Scroll Delay ({lethargy.delay}):</span>
        <span>Scroll Decay ({lethargy.inertiaDecay}):</span>
        <br>
        <span>Flick Weight ({flickWeight}):</span>
        <span>Flick Visual Weight ({flickVisualWeight}):</span>
        <span>Flick Threshold ({flickThreshold}):</span>
        <br>
        <span>Spring Stiffness ({flickSpring.stiffness}):</span>
        <span>Spring Damping ({flickSpring.damping}):</span>
        <span>Spring Return ({flickSpringReturn}):</span>
      </li>
      <li style="display:flex;flex-direction:column;">
        <span>{activeStackItemIdx}</span>
        <span>{Math.floor($flickSpring)}</span>
        <span>{Math.floor(Math.abs($flickInertia))}</span>
        <span>{stillScrolling}</span>
        <hr style="margin-block: 0.25rem;">
        <input type="range" bind:value={lethargy.sensitivity} min="1" max="100" step="1">
        <input type="range" bind:value={lethargy.delay} min="0" max="200" step="1">
        <input type="range" bind:value={lethargy.inertiaDecay} min="0" max="200" step="1">
        <br>
        <input type="range" bind:value={flickWeight} min="0.5" max="3" step="0.01">
        <input type="range" bind:value={flickVisualWeight} min="0.1" max="5" step="0.01">
        <input type="range" bind:value={flickThreshold} min="5" max="1000" step="1">
        <br>
        <input type="range" bind:value={flickSpring.stiffness} min="0" max="1" step="0.01">
        <input type="range" bind:value={flickSpring.damping} min="0" max="1" step="0.01">
        <input type="range" bind:value={flickSpringReturn} min="0" max="1" step="0.01">
      </li>
    <!-- <span>overviewOffset: {Math.floor($stackOverviewScrollOffset)}</span> -->
  </ul>
  {/if}
    <!-- fps {$fps} -->
    <!-- <div style="position: fixed;width:50%; top:0;right:0;z-index:5000;background: white;color:black;padding:0.5rem;display:flex;flex-direction:column;">
      <span>activeStackItem: {activeStackItemIdx}</span>
      <span>flickSpring: {Math.floor($flickSpring)}</span>
      <span>flickInertia: {Math.floor(Math.abs($flickInertia))}</span>
      <span>overviewOffset: {Math.floor($stackOverviewScrollOffset)}</span>
      <span>stillscrolling: {stillScrolling}</span>
    </div> -->
    <!-- <div class="horizon-list">
        {#each $horizons as horizon, idx (horizon.id)}
            <HorizonSwitcherItem horizon={horizon} active={$activeHorizon?.id === horizon.id} idx={idx + 1} hot={$hotHorizons.includes(horizon)} /> <!-- on:click={() => switchHorizon(horizon.id)}
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
    flickVisualWeight={flickVisualWeight}
    bind:activeIdx={activeStackItemIdx}
    bind:showOverview={showStackOverview}
    on:select={handleStackItemSelect}
  >
    {#each $horizons as horizon, idx (horizon.id)}
      <StackItem
        index={idx}
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
