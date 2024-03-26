<script lang="ts">
  import { onDestroy, onMount, setContext, tick } from 'svelte'
  import { get, writable } from 'svelte/store'
  import { draw, fade } from 'svelte/transition'

  import { Lethargy } from 'lethargy-ts'
  import { twoFingers, type Gesture } from '@horizon/core/src/lib/utils/two-fingers'

  import { API } from '@horizon/core/src/lib/service/api'
  import { HorizonsManager, Horizon as IHorizon } from '@horizon/core/src/lib/service/horizon'

  import { Drawer } from '@horizon/drawer'

  import './index.scss'
  import '@horizon/drawer/src/index.scss'

  import Horizon from './Horizon.svelte'
  import { useLogScope } from '../../utils/log'
  import Stack from '../Stack/Stack.svelte'
  import StackItem from '../Stack/StackItem.svelte'
  import HorizonPreview from './HorizonPreview.svelte'
  import { spring } from 'svelte/motion'
  import MediaImporter from './MediaImporter.svelte'
  import { advancedSpring } from '../../utils/advancedSpring'
  import { wait } from '../../utils/time'
  import type { Card } from '../../types/index'
  import { Icon } from '@horizon/icons'
  import HorizonInfo from './HorizonInfo.svelte'
  import { isModKeyPressed } from '../../utils/keyboard'
  import { requestNewPreviewImage } from '../../utils/screenshot'
  import { createCheatSheetCard } from '../../utils/demoHorizon'
  import DrawerWrapper from './DrawerWrapper.svelte'
  import { ResourceManager } from '../../service/resources'
  import { expoOut } from 'svelte/easing'
  import AppBar from './AppBar.svelte'
  import SplashScreen from '../SplashScreen.svelte'
  import { visorEnabled, visorPinch } from '../../utils/visor'
  import { FEEDBACK_PAGE_URL } from '../../constants/card'
  import { Telemetry } from '../../service/telemetry'

  const log = useLogScope('HorizonManager')
  const api = new API()

  let telemetryAPIKey = ''
  let telemetryActive = false
  if (import.meta.env.PROD) {
    telemetryAPIKey = import.meta.env.R_VITE_TELEMETRY_API_KEY
    telemetryActive = true
  }

  const telemetry = new Telemetry({
    apiKey: telemetryAPIKey,
    active: telemetryActive,
    trackHostnames: false
  })

  const resourceManager = new ResourceManager(telemetry)
  const horizonManager = new HorizonsManager(api, resourceManager, telemetry)

  setContext('horizonsManager', horizonManager)

  const lethargy = new Lethargy({
    // ORIGINAL MAXU:
    // sensitivity: 70,
    // delay: 80,
    // inertiaDecay: 200,

    // TEST MAXU
    sensitivity: 70,
    delay: 0,
    inertiaDecay: 43
  })
  // const fps = useFPS()

  const horizons = horizonManager.horizons
  const activeHorizonId = horizonManager.activeHorizonId
  const activeHorizon = horizonManager.activeHorizon

  const SORTING_TIMEOUT = 10000
  const OVERVIEW_HORIZON_SCALING = 0.6
  const OVERVIEW_HORIZON_GAP = 64
  const TRANSITION_DURATION = 200 // ms
  const SAFE_AREA_PADDING = 64

  const activeStackItemIdx = writable(0)
  const showStackOverview = writable(false)

  let disabledTransitions = true
  let sortingTimeout: ReturnType<typeof setTimeout> | null = null
  let sortedHorizons: string[] = []
  let initialSorting = false
  let overScrollTimeout: ReturnType<typeof setTimeout> | null = null
  let moveToStackItem: (idx: number) => Promise<void>
  let drawer: Drawer

  $: selectedHorizonId = sortedHorizons[$activeStackItemIdx]

  const addHorizon = async () => {
    disabledTransitions = true

    const newHorizon = await horizonManager.createHorizon('New Horizon ' + $horizons.length)
    if ($showStackOverview) {
      $showStackOverview = false
      $stackOverviewScrollOffset = 0

      await wait(TRANSITION_DURATION)
    }

    await horizonManager.switchHorizon(newHorizon.id)
    await moveToStackItem(0)
    await sortHorizons()
  }

  const openUrlHandler = (url: string) => {
    log.debug('open url', url)

    if (!$activeHorizon) {
      log.debug('no active horizon')
      return
    }

    const board = $activeHorizon.board
    if (!board) {
      log.debug('no active board')
      return
    }

    const state = get(board.state)
    const viewport = get(state.viewPort)
    const viewoffset = get(state.viewOffset)

    const width = Math.max(((viewport.w - SAFE_AREA_PADDING * 2) * 3) / 4, 800)
    const height = Math.max(((viewport.h - SAFE_AREA_PADDING * 2) * 3) / 4, 500)

    log.debug('Creating browser card with opened URL:', url)
    $activeHorizon.addCardBrowser(
      url,
      {
        x: viewoffset.x + viewport.w / 2 - width / 2,
        y: viewoffset.y + viewport.h / 2 - height / 2 - 50,
        width: width,
        height: height
      },
      {
        foreground: true,
        trigger: 'protocol'
      }
    )
  }

  const deleteHorizon = async (horizon: IHorizon) => {
    log.debug('Confirm delete horizon', horizon.id)
    const confirm = window.confirm(`Are you sure you want to delete ${horizon.data.name}?`)
    if (confirm) {
      await horizonManager.deleteHorizon(horizon)

      if (horizon.id === $activeHorizonId || horizon.id === selectedHorizonId) {
        const nextHorizon = sortedHorizons[$activeStackItemIdx - 1]
        if (nextHorizon) {
          changeActiveHorizon(nextHorizon, true)
        } else {
          changeActiveHorizon(sortedHorizons[$activeStackItemIdx + 1], true)
        }
      } else {
        closeOverview()
      }
    } else {
      log.debug('Delete horizon canceled')
    }
  }

  const sortHorizons = async () => {
    disabledTransitions = true
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
    $activeStackItemIdx = newHorizonStackIdx

    await wait(200) // TODO: probably a better way to do this but needed to wait for the stack to update
    disabledTransitions = false
  }

  const createSortingTimeout = () => {
    if (sortingTimeout) {
      clearTimeout(sortingTimeout)
    }

    sortingTimeout = setTimeout(() => {
      log.debug('sorting timeout reached')
      sortingTimeout = null
      sortHorizons()
    }, SORTING_TIMEOUT)
  }

  const changeSelectedHorizon = (horizonId: string) => {
    const horizonStackIdx = sortedHorizons.findIndex((h) => h === horizonId)
    $activeStackItemIdx = horizonStackIdx
    // $stackOverviewScrollOffset = 0
  }

  const changeActiveHorizon = async (horizonId: string, sortImmediately = false) => {
    log.debug('Changing active horizon', horizonId)

    $activeHorizon?.activeCardId.set(null)
    $showStackOverview = false

    const horizonStackIdx = sortedHorizons.findIndex((h) => h === horizonId)
    await moveToStackItem(horizonStackIdx)

    await horizonManager.switchHorizon(horizonId)

    if (sortImmediately) {
      sortHorizons()
    } else {
      createSortingTimeout()
    }
  }

  const closeOverview = async () => {
    // to prevent too much movement disable transitions. Scaling is unaffected
    disabledTransitions = true
    setTimeout(() => {
      disabledTransitions = false
    }, TRANSITION_DURATION * 2)

    await tick()

    $showStackOverview = false
    $stackOverviewScrollOffset = 0

    await wait(TRANSITION_DURATION)
  }

  const selectHorizonAndCloseOverview = () => {
    log.debug('closing overview')

    // if the user scrolled we switch to the closest horizon
    if ($stackOverviewScrollOffset !== 0) {
      const horizonHeight = window.innerHeight * OVERVIEW_HORIZON_SCALING + OVERVIEW_HORIZON_GAP
      const horizonsIndexOffset = Math.round($stackOverviewScrollOffset / horizonHeight)
      const closestHorizonId = sortedHorizons[$activeStackItemIdx + horizonsIndexOffset]

      log.debug('switching to closest horizon', closestHorizonId)
      if (closestHorizonId !== $activeHorizonId) {
        changeActiveHorizon(closestHorizonId)
      }

      // if the user selected a different horizon using the arrow keys we switch to it
    } else if ($activeHorizonId !== selectedHorizonId) {
      log.debug('switching to selected horizon', selectedHorizonId)
      changeActiveHorizon(selectedHorizonId)
    } else {
      closeOverview()
    }
  }

  const moveToNextHorizon = async () => {
    if (overScrollTimeout) clearTimeout(overScrollTimeout)

    const nextIdx = $activeStackItemIdx + 1
    if (nextIdx >= $horizons.length) {
      $stackOverviewScrollOffset = 200
      overScrollTimeout = setTimeout(() => {
        $stackOverviewScrollOffset = 0
      }, 200)
      return
    }

    const nextHorizon = sortedHorizons[nextIdx]

    if ($showStackOverview) {
      changeSelectedHorizon(nextHorizon)
      $stackOverviewScrollOffset = 0
    } else {
      changeActiveHorizon(nextHorizon)
    }
  }

  const moveToPreviousHorizon = async () => {
    if (overScrollTimeout) clearTimeout(overScrollTimeout)

    const nextIdx = $activeStackItemIdx - 1

    // if we are on the first horizon and the user presses up we create a new horizon
    if (nextIdx < 0) {
      $stackOverviewScrollOffset = -200
      overScrollTimeout = setTimeout(() => {
        $stackOverviewScrollOffset = 0
      }, 200)
      // addHorizon()
      return
    }

    const nextHorizon = sortedHorizons[nextIdx]
    if ($showStackOverview) {
      changeSelectedHorizon(nextHorizon)
      $stackOverviewScrollOffset = 0
    } else {
      changeActiveHorizon(nextHorizon)
    }
  }

  const handleHorizonChange = async (e: CustomEvent<IHorizon>) => {
    const horizon = e.detail
    log.debug('horizon changed', horizon)
  }

  const handleCardChange = async (e: CustomEvent<Card>) => {
    const card = e.detail
    log.debug('card changed', card)

    // const activeHorizonIdx = sortedHorizons.findIndex((h) => h === $activeHorizonId)
    // if (activeHorizonIdx !== 0) {
    //   sortHorizons()
    // }
  }

  const handleKeyDown = async (event: KeyboardEvent) => {
    // prevent tabbing out of an active card
    if (event.key === 'Tab') {
      const activeCardId = $activeHorizon?.activeCardId
      const cardId = activeCardId && get(activeCardId)
      if (cardId) {
        log.debug('preventing tab')
        event.preventDefault()
      }
    }

    if (drawer?.isShown()) {
      if (event.key === 'Escape') {
        drawer.close()
        return
      }
    }

    if (!isModKeyPressed(event)) return

    if (event.key === 'n') {
      event.preventDefault()
      addHorizon()
    } else if (event.key === 'o') {
      event.preventDefault()
      if ($showStackOverview) {
        selectHorizonAndCloseOverview()
      } else {
        $showStackOverview = true
      }
    } else if (event.key === 'w' && $activeHorizon) {
      event.preventDefault()
      const activeCardId = $activeHorizon.activeCardId

      if (activeCardId) {
        const cardId = get(activeCardId)
        if (!cardId) return
        await $activeHorizon.deleteCard(cardId)
      }
    } else if (event.key === 'g') {
      if (drawer.isShown()) {
        drawer.close()
      } else {
        drawer.open()
      }
    } else if (event.key === 'f') {
      if (drawer.isShown()) {
        if (drawer.getSize() === 'full') {
          drawer.setSize('normal')
        } else {
          drawer.setSize('full')
        }
      }
    } else if (event.key === 'Escape') {
      event.preventDefault()
      window.location.reload()
      // } else if (event.key === 'ArrowUp') {
      //   event.preventDefault()
      //   moveToPreviousHorizon()
      // } else if (event.key === 'ArrowDown') {
      //   event.preventDefault()
      //   moveToNextHorizon()
    } else if (event.key === '9') {
      showFlickSettings = !showFlickSettings
    } else if (event.key === 'f' && !$showStackOverview) {
      $visorEnabled = !$visorEnabled
    }
  }

  const handleStackItemSelect = async (e: CustomEvent<number>) => {
    const selectedHorizon = sortedHorizons[e.detail]
    if (selectedHorizon) {
      changeActiveHorizon(selectedHorizon)
    }
  }

  $: if (!initialSorting && $horizons && $horizons.length > 0) {
    // log.debug('initial sorting')
    initialSorting = true
    sortedHorizons = $horizons.map((h) => h.id)
  }

  // prevent sorting when overview is open
  $: if ($showStackOverview && sortingTimeout) {
    clearTimeout(sortingTimeout)
    sortingTimeout = null
  }

  $: if (!$showStackOverview && $activeStackItemIdx !== 0 && !sortingTimeout) {
    log.debug('edge case, no sorting timeout but not on first horizon')
    createSortingTimeout()
  }

  /* VISOR */
  let visorSearchEl: HTMLElement
  let visorSearchVal = writable('')

  const VISOR_PINCH_WEIGHT = 0.65

  $: if ($visorEnabled) {
    handleVisorOpen()
  } else {
    handleVisorClose()
  }

  $: if (!$visorEnabled && $visorPinch > 40) $visorEnabled = true
  $: if ($visorEnabled && $visorPinch < -30) $visorEnabled = false

  const handleVisorOpen = () => {
    tick().then(() => visorSearchEl?.focus())
  }
  const handleVisorClose = () => {
    visorEnabled.set(false)
    tick().then(() => ($visorSearchVal = ''))
  }

  function InvLerp(a, b, v) {
    return (v - a) / (b - a)
  }

  function exponentialDecay(x: number, initialValue: number, decayRate: number) {
    return initialValue * Math.exp(-decayRate * x)
  }

  let lastTime = performance.now()
  // TODO: Fix & unify this crappy code
  let pinchFrameId: number | null = null
  function frame() {
    if (Math.abs($visorPinch) > 0.01) requestAnimationFrame(frame)
    else {
      $visorPinch = 0
      pinchFrameId = null
    }
    const dt = performance.now() - lastTime
    // const dtx = mapRange(dt, 0, 16.6, 0, 1);
    lastTime = performance.now()
    visorPinch.update((v) => {
      return exponentialDecay(0.43, v, 0.45)
    })
  }
  $: if (Math.abs($visorPinch) > 0.01 && pinchFrameId === null)
    pinchFrameId = requestAnimationFrame(frame)

  /* NEW GESTURE STUFF */

  // TODO: Remove, only for letting people adjust settings
  let showFlickSettings = false
  let flickWeight = 1.43
  let flickVisualWeight = 2.8
  let flickThreshold = 135
  let flickSpringReturn = 0.9

  const stackOverviewScrollOffset = spring(0, {
    stiffness: 0.85,
    damping: 0.97
  })

  let flickSpring = spring<number>(0, {
    // stiffness: 0.25,
    // damping: 0.9,
    // stiffness: 0.65, // <- Juicy
    // damping: 0.7, // <- Juicy
    stiffness: 0.93, // <- Hefty
    damping: 1 // <- Hefty
    // min: -400,
    // max: 400
  })
  // $: ({ inertia: flickInertia } = flickSpring)

  // let stillScrolling = false

  // let canSwitchAgain = true
  // let canSwitchTimer: any = null

  // $: if (Math.abs($flickSpring) > flickThreshold && !$showStackOverview && canSwitchAgain) {
  //   let cancel = false
  //   if (Math.sign($flickSpring) > 0) {
  //     moveToNextHorizon()
  //   } else {
  //     moveToPreviousHorizon()
  //     if ($activeStackItemIdx === 0) cancel = true
  //   }

  //   if (!cancel) {
  //     flickSpring.set(-$flickSpring)
  //     //flickSpring.set(0);
  //     canSwitchTimer && clearTimeout(canSwitchTimer)
  //     canSwitchTimer = setTimeout(() => {
  //       canSwitchAgain = true
  //     }, 800)
  //     canSwitchAgain = false
  //   }
  // }

  const handleGestureEnd = (g: Gesture) => {
    log.debug('gesture end', g)
    return

    if (g.shiftKey) {
      log.debug('ignoring gesture as shift is pressed')
      return
    }

    if (g.scale < 1 && !$showStackOverview) {
      log.debug('pinch out')
      $showStackOverview = true
    } else if (g.scale > 1 && $showStackOverview) {
      log.debug('pinch in')
      selectHorizonAndCloseOverview()
    }
  }

  $: if ($showStackOverview) $visorEnabled = false

  let wheelResetTimer: any = null
  function handleWheel(e: WheelEvent) {
    if (e.ctrlKey) {
      const fac = 1 - InvLerp(0, 100, $visorPinch)
      $visorPinch += e.deltaY * VISOR_PINCH_WEIGHT * fac
    }
    if ($visorEnabled) {
      const state = $activeHorizon?.board?.state
      const offset = state && get(state).viewOffset
      // $activeHorizon?.board?.panTo(get(offset!).x + e.deltaX, get(offset!).y, { hard: true })
      // offset!.update(
      //   (viewOffset) => {
      //     let newX = viewOffset.x + e.deltaX
      //     return {
      //       x: newX,
      //       y: viewOffset.y
      //     }
      //   },
      //   { duration: 350, easing: expoOut }
      // )
    }
    if ($showStackOverview) {
      const isIntentional = lethargy.check(e)

      const horizonHeight = window.innerHeight * OVERVIEW_HORIZON_SCALING + OVERVIEW_HORIZON_GAP
      stackOverviewScrollOffset.update((v) => {
        v += e.deltaY
        // v = Math.min(0, Math.max(v, 2000));
        const max = ($horizons.length - $activeStackItemIdx - 1) * horizonHeight
        const min = $activeStackItemIdx * horizonHeight * -1
        if (overScrollTimeout) clearTimeout(overScrollTimeout)
        if (v > max) {
          if (!isIntentional) return max
          overScrollTimeout = setTimeout(() => {
            $stackOverviewScrollOffset = max
          }, 200)

          return max + 200
        } else if (v < min) {
          if (!isIntentional) return min
          overScrollTimeout = setTimeout(() => {
            $stackOverviewScrollOffset = min
          }, 200)

          return min - 200
        }

        return v
      })
    } else {
      // const isIntentional = lethargy.check(e)
      // if (isIntentional) {
      //   if (!stillScrolling) stillScrolling = true
      //   if (!isAnimating) requestAnimationFrame(frame)
      //   // DISABLE FLICKING FOR USER-TESTING BUILD
      //   // flickSpring.update((v: number) => {
      //   //   const eased = 1 - ((v+e.deltaY*1) / (1 * flickWeight))^2; // .../1.3)^2
      //   //   v = -eased;
      //   //   //v += e.deltaY;
      //   //   return v;
      //   // });
      //   wheelResetTimer && clearTimeout(wheelResetTimer)
      //   wheelResetTimer = setTimeout(() => {
      //     stillScrolling = false
      //   }, 80)
      // }
    }
  }

  // let isAnimating = false
  // function frame() {
  //   requestAnimationFrame(frame)
  //   isAnimating = true
  //   flickSpring.update((v: number) => {
  //     //if (stillScrolling) return v;// * 0.97;
  //     v *= flickSpringReturn
  //     if (Math.abs(v) < 0.01) {
  //       v = 0
  //       isAnimating = false
  //     }
  //     return v
  //   })
  // }
  // // TODO: (Performance) We shuld only kick it off once the spring is changed probably and stop it after it settled!
  // onMount(frame)

  const openFeedbackCard = () => {
    openUrlHandler(FEEDBACK_PAGE_URL)
  }

  let unregisterTwoFingers: ReturnType<typeof twoFingers> | null = null
  onMount(async () => {
    unregisterTwoFingers = twoFingers(window as unknown as HTMLElement, {
      onGestureEnd: handleGestureEnd
    })

    const horizonId = await horizonManager.init()
    log.debug('initialized', horizonId)

    sortHorizons()

    // TODO: for safety we wait a bit before we tell the app that we are ready, we need a better way to do this
    setTimeout(() => {
      window.api.appIsReady()
    }, 2000)

    window.api.registerMainNewWindowHandler((details: { url: string }) =>
      openUrlHandler(details.url)
    )
    window.api.onOpenURL((url: string) => openUrlHandler(url))

    window.api.onOpenCheatSheet(() => {
      log.debug('open cheat sheet')
      if ($activeHorizon) {
        const board = $activeHorizon.board
        if (!board) return
        const state = get(board.state)
        const viewport = get(state.viewPort)
        const viewoffset = get(state.viewOffset)
        const width = Math.max(viewport.w / 2 - SAFE_AREA_PADDING * 2, 600)
        const height = viewport.h - SAFE_AREA_PADDING * 2

        createCheatSheetCard($activeHorizon, {
          x: viewoffset.x + viewport.w / 2 - width / 2,
          y: viewoffset.y + viewport.h / 2 - height / 2 - 50,
          width: width,
          height: height
        })
      }
    })

    window.api.onOpenFeedbackPage(() => {
      log.debug('open feedback page')
      openFeedbackCard()
    })

    window.api.onAdBlockerStateChange((_partition: string, state: boolean) => {
      log.debug('adblocker state changed', state)
      if ($activeHorizon) {
        $activeHorizon.adblockerState.set(state)
      }
    })
  })

  onDestroy(() => {
    if (unregisterTwoFingers) unregisterTwoFingers()
  })
</script>

<svelte:window on:keydown={handleKeyDown} on:wheel={handleWheel} />

<svelte:head>
  <title
    >{$showStackOverview ? 'Horizon Overview' : $activeHorizon?.data?.name ?? 'Space OS'}
    {$showStackOverview ? '' : $activeHorizon?.state === 'hot' ? '🔥' : '🧊'}</title
  >
</svelte:head>

<SplashScreen />
<AppBar
  horizon={activeHorizon}
  on:createHorizon={() => addHorizon()}
  on:toggleOasis={() => (drawer.isShown() ? drawer.close() : drawer.open())}
  on:openFeedback={() => openFeedbackCard()}
/>

{#if $visorEnabled}
  <div id="visor">
    <form>
      <input
        type="text"
        placeholder="Search for anything"
        bind:value={$visorSearchVal}
        bind:this={visorSearchEl}
      />
    </form>
  </div>
{/if}

<!-- <span style="background:blue;color:white;position:fixed;z-index:9999;top:0;left:40%"
  >{Math.floor($visorPinch)}</span
> -->
<main class="" class:overview={$showStackOverview}>
  <!-- fps {$fps} -->
  <!-- <div style="position: fixed;width:50%; top:0;right:0;z-index:5000;background: white;color:black;padding:0.5rem;display:flex;flex-direction:column;">
      <span>activeStackItem: {$activeStackItemIdx}</span>
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

  {#if !$showStackOverview && $activeHorizon}
    <MediaImporter horizon={$activeHorizon} />
  {/if}

  {#if $activeHorizon}
    <DrawerWrapper bind:drawer horizon={$activeHorizon} {resourceManager} />
  {/if}

  <Stack
    options={{
      transitionDuration: TRANSITION_DURATION,
      scaling: OVERVIEW_HORIZON_SCALING,
      gap: OVERVIEW_HORIZON_GAP
    }}
    movementOffset={flickSpring}
    overviewOffset={stackOverviewScrollOffset}
    showTransitions={!disabledTransitions}
    activeIdx={activeStackItemIdx}
    showOverview={showStackOverview}
    on:select={handleStackItemSelect}
    bind:moveToStackItem
  >
    {#each $horizons as horizon (horizon.id)}
      <StackItem
        order={sortedHorizons.findIndex((h) => h === horizon.id)}
        showOverview={$showStackOverview}
        active={$activeHorizonId === horizon.id && !$showStackOverview}
        on:select={handleStackItemSelect}
      >
        {#if horizon.state === 'hot'}
          <div
            style="display: {!horizon.previewImageObjectURL ||
            (!$showStackOverview && !disabledTransitions)
              ? 'block'
              : 'none'};"
          >
            <Horizon
              {horizon}
              active={$activeHorizonId === horizon.id && !$showStackOverview}
              visorSearchTerm={visorSearchVal}
              inOverview={$showStackOverview}
              {resourceManager}
              on:change={handleHorizonChange}
              on:cardChange={handleCardChange}
            />
          </div>
        {/if}

        <div
          style="display: {horizon.state !== 'hot' ||
          (horizon.state === 'hot' &&
            horizon.previewImageObjectURL &&
            ($showStackOverview || disabledTransitions))
            ? 'block'
            : 'none'}; width: 100%; height: 100%"
        >
          {#key $showStackOverview}
            <HorizonPreview {horizon} />
          {/key}
        </div>

        <svelte:fragment slot="layer">
          {#if $showStackOverview}
            <HorizonInfo {horizon} />

            <button
              on:click|preventDefault|stopPropagation={() => deleteHorizon(horizon)}
              transition:fade={{ duration: TRANSITION_DURATION / 2 }}
              class="horizon-action"
            >
              <Icon name="close" />
            </button>
          {/if}
        </svelte:fragment>
      </StackItem>
    {/each}

    <!-- {#each $hotHorizons as hotHorizon (hotHorizon.id)}
            {@const idx = $sortedHorizons.findIndex((h) => h === hotHorizon.id)}
            <StackItem showOverview={$showStackOverview} index={idx} on:select={() => selectStackItem(idx)}>
                <Horizon horizon={hotHorizon} />
            </StackItem>
        {/each}

        {#each $coldHorizons as coldHorizon (coldHorizon.id)}
            {@const idx = $sortedHorizons.findIndex((h) => h === coldHorizon.id)}
            <StackItem showOverview={$showStackOverview} index={idx} on:select={() => selectStackItem(idx)}>
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
    transform: translate(-50%, -50%) scale(var(--scaling));
    // transition: transform var(--transition-duration) var(--transition-timing-function);
  }

  .horizon-action {
    appearance: none;
    outline: none;
    position: absolute;
    z-index: 100;
    top: 0.75rem;
    right: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f5f5;
    padding: 0.5rem;
    border-radius: var(--theme-border-radius);
    border: 1px solid #ddd;
    cursor: pointer;
  }

  #visor {
    position: fixed;
    z-index: 100;
    top: 0;
    left: 0;
    bottom: 80%;
    right: 0;

    form {
      margin-top: 4rem;

      display: flex;
      justify-content: center;

      input {
        background: none;
        border: none;
        font-size: 2rem;
        text-align: center;

        &:focus {
          outline: none;
        }
      }
    }
  }
</style>
