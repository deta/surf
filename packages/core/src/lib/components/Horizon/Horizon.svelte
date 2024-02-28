<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount, tick } from 'svelte'
  import { get, writable, type Unsubscriber, type Writable } from 'svelte/store'

  import {
    Board,
    createSettings,
    createBoard,
    clamp,
    snapToGrid,
    hoistPositionable,
    hasClassOrParentWithClass,
    Positionable
  } from '@horizon/tela'
  import type { IBoard, IPositionable, Vec4 } from '@horizon/tela'

  import CardWrapper from './CardWrapper.svelte'
  import { Horizon } from '../../service/horizon'
  import { useLogScope } from '../../utils/log'
  import { requestNewPreviewImage, takePageScreenshot } from '../../utils/screenshot'
  import type { Card, CardBrowser, CardFile, CardText } from '../../types'
  import { useDebounce } from '../../utils/debounce'
  import HorizonInfo from './HorizonInfo.svelte'
  import Grid from './Grid.svelte'
  import {
    EDGE_SNAP_FACTOR,
    GRID_SIZE_COARSE,
    GRID_SIZE_FINE,
    QUICK_SNAP_THRESHOLD
  } from '../../constants/horizon'
  import { debounce, isInsideViewport, lerp, map } from '../../../../../tela/dist/utils'
  import { visorEnabled, visorPinch } from './HorizonManager.svelte'

  export let active: boolean = true
  export let horizon: Horizon
  export let inOverview: boolean = false
  export let visorSearchTerm: Writable<string>

  const REQUEST_NEW_PREVIEW_INTERVAL = 3e3
  const cards = horizon.cards
  const data = horizon.data

  const log = useLogScope('Horizon Component')
  const dispatch = createEventDispatcher<{ change: Horizon; cardChange: Card }>()

  const settings = createSettings({
    CAN_PAN: true,
    CAN_DRAW: true,
    CAN_ZOOM: false,
    CAN_SELECT: true,
    PAN_DIRECTION: 'x',
    SNAP_TO_GRID: true,
    GRID_SIZE: GRID_SIZE_COARSE,
    EDGE_SNAP_FACTOR: EDGE_SNAP_FACTOR,
    QUICK_SNAP_THRESHOLD: QUICK_SNAP_THRESHOLD,
    BOUNDS: {
      minX: 0,
      minY: 0,
      maxX: Infinity, //1920 * 7,
      maxY: Infinity,
      maxZoom: 1,
      minZoom: 1, // todo?: Do we need to make these dynamic?
      limit: 'hard'
    },
    CHUNK_WIDTH: 1920 / 4, // Should be divisible by GRID_SIZE
    CHUNK_HEIGHT: 1080 / 3, // Should be divisible by GRID_SIZE
    POSITIONABLE_KEY: 'id'
  })

  const stack = writable([] as string[])
  const board: IBoard<any, any> = createBoard(
    settings,
    stack,
    {
      viewPort: {
        x: 10,
        y: 50
      } as any
    },
    'idle',
    {}
  )

  const state = board.state
  const selectionRect = $state.selectionRect
  const selectionCss = $state.selectionCss
  const viewOffset = $state.viewOffset
  const viewPort = $state.viewPort
  const activeCardId = horizon.activeCardId

  let containerEl: HTMLElement
  let requestNewPreviewIntervalId: number | undefined
  let isDraggingCard = false

  $: log.debug('horizon state changed', horizon.state)

  $: if (!active && horizon.state !== 'hot') {
    log.error('edge case! horizon is active but not hot')
  }

  const debouncedHorizonUpdate = useDebounce((...args: Parameters<typeof horizon.updateData>) => {
    return horizon.updateData(...args)
  }, 500)

  const debouncedCardUpdate = useDebounce((...args: Parameters<typeof horizon.updateCard>) => {
    return horizon.updateCard(...args)
  }, 500)

  // Responsible for the scaling of the entire Horizon on bigger screens
  const handleWindowResize = () => {
    state.update((_state) => {
      _state.zoom.set(clamp(window.innerHeight / 1080, 1, Infinity))
      return _state
    })
  }

  const loadHorizon = () => {
    $state.stackingOrder = horizon.stackingOrder
    $state.stackingOrder.subscribe(async (e) => {
      if (horizon) {
        await horizon.storage.horizons.update(horizon.id, {
          ...horizon.data,
          stackingOrder: get(horizon.stackingOrder)
        })
      }
    })

    $state.viewOffset.set({ x: data.viewOffsetX, y: 0 })
    viewOffset.subscribe((e) => {
      debouncedHorizonUpdate({ viewOffsetX: e.x })
    })
  }

  const updatePreview = async () => {
    if (horizon && active && !inOverview) {
      log.debug(horizon.id, 'requesting new preview image')
      await requestNewPreviewImage(horizon.id)
    }
  }

  let showSelectTooltip = false
  let selectPos = { x: 0, y: 0 }
  let selectSecondaryAction = false // if true, create a text card instead of a browser card
  const onModSelectChange = (
    e: CustomEvent<{
      event: MouseEvent
      rect: Vec4
    }>
  ) => {
    const event = e.detail.event

    showSelectTooltip = true
    selectPos = {
      x: event.clientX,
      y: event.clientY
    }

    // Right click
    selectSecondaryAction = event.which === 3 || event.button === 2
  }

  const onModSelectEnd = (
    e: CustomEvent<{
      event: MouseEvent
      rect: Vec4
    }>
  ) => {
    showSelectTooltip = false
    const { rect, event } = e.detail
    let pos = { x: rect.x, y: rect.y }
    let size = { x: rect.w, y: rect.h }
    // Snap
    pos.x = $settings.SNAP_TO_GRID ? snapToGrid(pos.x, $settings.GRID_SIZE!) : pos.x
    pos.y = $settings.SNAP_TO_GRID ? snapToGrid(pos.y, $settings.GRID_SIZE!) : pos.y
    size.x = $settings.SNAP_TO_GRID ? snapToGrid(size.x, $settings.GRID_SIZE!) : size.x
    size.y = $settings.SNAP_TO_GRID ? snapToGrid(size.y, $settings.GRID_SIZE!) : size.y

    if (size.x < 90 || size.y < 90) {
      return
      // if (!e.detail.event.shiftKey) return
      pos = {
        x: pos.x - 90,
        y: pos.y - 90
      }
      size = {
        x: 180,
        y: 180
      }
    }

    log.debug('mod select end', e.detail.event)

    const position = {
      x: pos.x,
      y: pos.y,
      width: size.x,
      height: size.y
    }

    // Right click
    if (event.which === 3 || event.button === 2) {
      log.debug('creating new text card', position)
      horizon.addCardText('', position, true)
    } else {
      log.debug('creating new browser card', position)
      horizon.addCardBrowser('', position, true)
    }
  }

  const handleCardChange = async (e: CustomEvent<Card>) => {
    const card = e.detail
    log.debug('card changed', card)
    debouncedCardUpdate(card.id, card).then(() => {
      dispatch('cardChange', card)
      updatePreview()
    })
  }

  const handleCardLoad = () => {
    log.debug('card finished loading')
    updatePreview()
  }

  const handleCardDelete = async (e: CustomEvent<Card>) => {
    const card = e.detail
    log.debug('deleting card', card)
    await horizon.deleteCard(card.id)
    updatePreview()
  }

  const handleCardDuplicate = async (e: CustomEvent<Card>) => {
    const card = e.detail
    log.debug('duplicating card', card)

    const newCardStore = await horizon.duplicateCardWithoutData(card.id, {
      width: card.width,
      height: card.height,
      x: card.x + card.width + 50,
      y: card.y
    })

    const newCard = get(newCardStore)
    horizon.scrollToCard(newCard)
    horizon.setActiveCard(newCard.id)
  }

  const handleCardBeginDrag = (e: CustomEvent<Card>) => {
    isDraggingCard = true
  }

  const handleCardEndDrag = (e: CustomEvent<Card>) => {
    isDraggingCard = false
  }

  const handleCardBeginResize = (e: CustomEvent<Card>) => {
    isDraggingCard = true // well.. actually its resizing this should be one var.. not sure if we need to distinguish sooner or later though.
  }
  const handleCardEndResize = (e: CustomEvent<Card>) => {
    isDraggingCard = false
  }

  const handlePositionableEnter = (e: CustomEvent<string>) => {
    hoistPositionable(e.detail, containerEl)
  }

  const handleMouseDown = (e: MouseEvent) => {
    if (!hasClassOrParentWithClass(e.target as HTMLElement, 'card')) {
      $activeCardId = null
    }
  }

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || (e.key === 'Escape' && $visorEnabled && $activeCardId !== null)) {
      // Prevent centering in text cards & browsers for now.
      const card = $cards.find((c) => get(c).id === $activeCardId)
      if (!card) return
      if (get(card).type === 'text' || get(card).type === 'browser') return

      $visorEnabled = false
      horizon.scrollToCardCenter($activeCardId)
      horizon.moveCardToStackingTop($activeCardId)
    } else if ((e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) && $visorEnabled) {
      visorSelectPrev()
    } else if ((e.key === 'ArrowRight' || e.key === 'Tab') && $visorEnabled) {
      visorSelectNext()
    }
    // TODO: old, remove?
    // if (e.key === 'Control' && isDraggingCard) {
    //   $settings.GRID_SIZE = GRID_SIZE_FINE
    // }
    // if (!hasClassOrParentWithClass(e.target as HTMLElement, 'card')) {
    // }
  }

  // TODO: old, remove?
  // $: {
  //   if (!isDraggingCard) {
  //     $settings.GRID_SIZE = GRID_SIZE_COARSE
  //   }
  // }

  const handleKeyup = (e: KeyboardEvent) => {
    if (e.key === 'Escape') $activeCardId = null
    // if (!hasClassOrParentWithClass(e.target as HTMLElement, 'card')) {
    // }
    // TODO: old, remove?
    // if (e.key === 'Control') {
    //   $settings.GRID_SIZE = GRID_SIZE_COARSE
    // }
  }

  $: {
    if ($visorEnabled && visorScroll) {
      const targetCenter = visorListTargets.toSorted((a, b) => {
        const aCenter = a.x + a.width / 2
        const bCenter = b.x + b.width / 2
        return (
          Math.abs($viewOffset.x - visorScroll + $viewPort.w / 2 - aCenter) -
          Math.abs($viewOffset.x - visorScroll + $viewPort.w / 2 - bCenter)
        )
      })[0]
      if (!targetCenter) console.warn('no target center!')
      if (targetCenter) {
        horizon.setActiveCard(targetCenter.id)
        debounce('center_visor', 360, () => {
          const centerOffset =
            targetCenter.x +
            ((VISOR_CARD_SIZE.w / 2) * 1) / VISOR_SCALE_FAC -
            ($viewOffset.x - visorScroll + $viewPort.w / 2)
          visorScroll -= centerOffset
          applyVisorList()
        })
      }
    }
  }
  const handleWheel = (e: WheelEvent) => {
    if (!$visorEnabled) return

    if ($viewOffset.x - visorScroll < visorScrollMin) {
      visorScroll += $viewOffset.x - visorScroll - visorScrollMin
    }
    if ($viewOffset.x - visorScroll > visorScrollMax) {
      visorScroll += $viewOffset.x - visorScroll - visorScrollMax
    }
    if (!e.ctrlKey) {
      visorScroll = visorScroll - e.deltaX
      applyVisorList()
    }
  }

  // TODO fix types to get rid of this type conversion
  $: positionables = cards as unknown as Writable<Writable<IPositionable<any>>[]>

  /* VISOR */

  // How much +- x margin to animate in visor mode
  const VISOR_CULL_X_MARGIN = 850
  const VISOR_CARD_SIZE = { w: 30 * 10, h: 30 * 12 }
  const VISOR_SCALE_FAC = 0.5

  // let visorCardsBackup: { id: string, x: number, y: number, width: number, height: number }[] = []
  // Target positions for displaying as visor list
  let visorListTargets: { id: string; x: number; y: number; width: number; height: number }[] = []

  // TODO: Make use of this -> Shoudl auto resturn to this after search is canceled / empty query again
  let visorInitFocussedId: string | null = null

  let visorScroll = 0
  let visorScrollMin = 0
  let visorScrollMax = 0

  /**
   * Computes offsets to display cards as the corrct visor list.
   * @param targetCards Optional subset of cards (e.g. search results)
   * @param activeCard
   */
  const computeVisorList = (
    contents: Writable<Card>[],
    focusCard?: Writable<Card>,
    autoFocus = false,
    force = false
  ) => {
    if (visorListTargets.length > 0 && !force) return
    const visibleCards = $cards.filter((c) => {
      const _c = get(c)
      return isInsideViewport(
        _c.x,
        _c.y,
        _c.width,
        _c.height,
        $viewOffset.x,
        $viewOffset.y,
        $viewPort,
        get($state.zoom),
        200,
        200
      )
    })
    // TODO: We should probably fall back to getting closest in current viewport
    // when active but outside visible area?
    let focusedCard: Writable<Card> | undefined = focusCard
    // if ($activeCardId !== undefined && visibleCards.find((c) => get(c).id === $activeCardId) !== undefined) {
    //   focusedCard = visibleCards.find((c) => get(c).id === $activeCardId)!
    // }
    // TODO: Case? Do we ned this feat?
    if (focusCard === undefined) {
      if (!autoFocus) {
        focusedCard = contents?.at(0) || undefined //|| $cards.find((c) => get(c).id === $activeCardId)
      } else {
        // Find closest card to viewPort center
        focusedCard =
          focusedCard ||
          visibleCards.sort((a, b) => {
            const aCenter = get(a).x + get(a).width / 2
            const bCenter = get(b).x + get(b).width / 2
            return (
              Math.abs($viewOffset.x + $viewPort.w / 2 - aCenter) -
              Math.abs($viewOffset.x + $viewPort.w / 2 - bCenter)
            )
          })[0]
        // No on screen, closest of all
        focusedCard =
          focusedCard ||
          $cards.sort((a, b) => {
            const aCenter = get(a).x + get(a).width / 2
            const bCenter = get(b).x + get(b).width / 2
            return (
              Math.abs($viewOffset.x + $viewPort.w / 2 - aCenter) -
              Math.abs($viewOffset.x + $viewPort.w / 2 - bCenter)
            )
          })[0]
      }
    }

    if (focusedCard) horizon.setActiveCard(get(focusedCard).id) // TODO?: Only if not active already?

    const activeCardIdx =
      focusedCard === undefined ? 0 : contents.findIndex((c) => get(c).id === get(focusedCard!).id)
    const tagetScreenCenter = $viewOffset.x + $viewPort.w / 2
    visorListTargets = contents
      .sort((a, b) => get(a).x - get(b).x)
      .map((c, i) => {
        const _c = get(c)
        const relativeCardIdx = i - activeCardIdx // Offset from center target
        const newX =
          tagetScreenCenter +
          relativeCardIdx * VISOR_CARD_SIZE.w -
          (VISOR_CARD_SIZE.w / 2) * (1 / VISOR_SCALE_FAC) +
          $settings.GRID_SIZE * relativeCardIdx
        const newY = $viewPort.h / 2 - (VISOR_CARD_SIZE.h / 2) * (1 / VISOR_SCALE_FAC)

        return {
          id: _c.id,
          x: newX,
          y: newY,
          width: VISOR_CARD_SIZE.w * (1 / VISOR_SCALE_FAC),
          height: VISOR_CARD_SIZE.h * (1 / VISOR_SCALE_FAC)
        }
      })

    // Hide all others
    $cards
      .filter((c) => !visorListTargets.find((t) => t.id === get(c).id))
      .forEach((c) => {
        c.update((_c) => {
          // This makes it fly in/out happily from the bottom screen edge
          // const min = Math.ceil(0);
          // const max = Math.floor($viewPort.w);
          // _c.xOverride =  $viewOffset.x + Math.floor(Math.random() * (max - min + 1)) + min;
          _c.xOverride =
            $viewOffset.x +
            map(0, get($cards.sort((a, b) => get(a).x - get(b).x).at(-1)!).x, 0, $viewPort.w, _c.x)
          _c.yOverride = $viewPort.h
          return _c
        })
      })
  }
  const applyVisorList = () => {
    function _update() {
      $cards.forEach((c) => {
        const target = visorListTargets.find((t) => t.id === get(c).id)
        const targetCardX = target?.x || 0
        const activeCardX = visorListTargets.find((t) => t.id === $activeCardId)?.x || 0
        const targetCardIdx = visorListTargets.findIndex((t) => t.id === get(c).id)
        const activeCardIdx = visorListTargets.findIndex((t) => t.id === $activeCardId)
        const offset = targetCardIdx - activeCardIdx
        const fac = lerp(0.3, 1, map(Math.abs(targetCardX - activeCardX), 0, 800, 0, 1))
        if (!target) return
        c.update((_c) => {
          _c.xOverride = visorScroll + target.x
          _c.yOverride = target.y
          _c.widthOverride = target.width
          _c.heightOverride = target.height
          // _c.scaleOverride = offset === 0 ? 100*VISOR_SCALE_FAC : (100*VISOR_SCALE_FAC-(VISOR_SCALE_FAC + fac))
          _c.scaleOverride = offset === 0 ? 100 * VISOR_SCALE_FAC + 10 : 100 * VISOR_SCALE_FAC
          _c.zOverride = offset === 0 ? 100 : 0
          return _c
        })
      })
    }
    requestAnimationFrame(_update)

    if (visorListTargets.length === 0) {
      visorScrollMin = 0
      visorScrollMax = 0
      visorScroll = 0
    } else {
      const sortedTargets = visorListTargets.toSorted((a, b) => a.x - b.x)
      visorScrollMin =
        sortedTargets[0].x - $viewPort.w / 2 + (VISOR_CARD_SIZE.w / 2) * (1 / VISOR_SCALE_FAC)
      visorScrollMax =
        sortedTargets.at(-1).x - $viewPort.w / 2 + (VISOR_CARD_SIZE.w / 2) * (1 / VISOR_SCALE_FAC)
    }
  }

  const visorSelectNext = () => {
    const activeCardIdx = visorListTargets.findIndex((c) => c.id === $activeCardId)
    if (activeCardIdx === -1) return
    const next = activeCardIdx + 1 > visorListTargets.length - 1 ? 0 : activeCardIdx + 1
    $activeCardId = visorListTargets[next]?.id || $activeCardId
    const targetCenter = visorListTargets.find((c) => c.id === $activeCardId)
    if (!targetCenter) return
    const centerOffset =
      targetCenter.x +
      ((VISOR_CARD_SIZE.w / 2) * 1) / VISOR_SCALE_FAC -
      ($viewOffset.x - visorScroll + $viewPort.w / 2)
    visorScroll -= centerOffset
    applyVisorList()
  }
  const visorSelectPrev = () => {
    const activeCardIdx = visorListTargets.findIndex((c) => c.id === $activeCardId)
    if (activeCardIdx === -1) return
    const prev = activeCardIdx - 1 < 0 ? visorListTargets.length - 1 : activeCardIdx - 1
    $activeCardId = visorListTargets[prev]?.id || $activeCardId
    const targetCenter = visorListTargets.find((c) => c.id === $activeCardId)
    if (!targetCenter) return
    const centerOffset =
      targetCenter.x +
      ((VISOR_CARD_SIZE.w / 2) * 1) / VISOR_SCALE_FAC -
      ($viewOffset.x - visorScroll + $viewPort.w / 2)
    visorScroll -= centerOffset
    applyVisorList()
  }

  // Simple throttle function
  const throttle = (func: Function, limit: number) => {
    let inThrottle: boolean
    return function () {
      const args = arguments
      const context = this
      if (!inThrottle) {
        func.apply(context, args)
        inThrottle = true
        setTimeout(() => (inThrottle = false), limit)
      }
    }
  }

  // This block handles the pinch transitions
  $: {
    if (!$visorEnabled && $visorPinch > 1) {
      if (visorListTargets.length === 0)
        throttle(
          () =>
            computeVisorList(
              $cards,
              $activeCardId !== null ? $cards.find((e) => get(e).id == $activeCardId) : undefined,
              true
            ),
          300
        )()
      const inView = $cards.filter((c) => {
        const _c = get(c)
        return isInsideViewport(
          _c.x,
          _c.y,
          _c.width,
          _c.height,
          $viewOffset.x,
          $viewOffset.y,
          $viewPort,
          get($state.zoom),
          VISOR_CULL_X_MARGIN,
          400
        )
      })
      const progress = clamp($visorPinch / 32, 0, 1)
      function _update() {
        inView.forEach((c) => {
          const original = get(c)
          const target = visorListTargets.find((t) => t.id === get(c).id)
          // const domEl = document.querySelector(`[data-id="${get(c).id}"]`) as HTMLElement
          if (!target || !original) return

          // TODO: Look into this, maybe CSS Animations can save our CPUs
          // domEl.style.setProperty('--targetX', `${lerp(original.x, target.x, progress)}px`)
          // domEl.style.setProperty('--targetY', `${lerp(original.y, target.y, progress)}px`)
          // domEl.style.setProperty('--targetWidth', `${lerp(original.width, target.width, progress)}px`)
          // domEl.style.setProperty('--targetHeight', `${lerp(original.height, target.height, progress)}px`)
          // domEl.style.setProperty('--targetOpacity', `${lerp(0, 100, map(Math.abs(($viewOffset.x + $viewPort.w / 2) - target.x), 0, 800, 0, 1))}%`)
          // domEl.classList.add('moveAnim')
          c.update((_c) => {
            _c.xOverride = lerp(original.x, target.x, progress)
            _c.yOverride = lerp(original.y, target.y, progress)
            _c.widthOverride = lerp(original.width, target.width, progress)
            _c.heightOverride = lerp(original.height, target.height, progress)
            _c.scaleOverride = lerp(100, 100 * VISOR_SCALE_FAC, progress)
            return _c
          })
        })
      }
      requestAnimationFrame(_update) // Thank god this saved performance lol
    } else if ($visorEnabled && $visorPinch < -1) {
      const inView = $cards.filter((c) => {
        const _c = get(c)
        return isInsideViewport(
          _c.x,
          _c.y,
          _c.width,
          _c.height,
          $viewOffset.x,
          $viewOffset.y,
          $viewPort,
          get($state.zoom),
          VISOR_CULL_X_MARGIN,
          400
        )
      })
      const progress = clamp(-$visorPinch / 40, 0, 1)
      function _update() {
        inView.forEach((c) => {
          const original = get(c) //inView.find(b => get(b).id === get(c).id)
          // const target = get(c).find(t => t.id === get(c).id)
          // const domEl = document.querySelector(`[data-id="${get(c).id}"]`) as HTMLElement
          if (!original) return
          // TODO: Look into this, maybe CSS Animations can save our CPUs
          // domEl.style.setProperty('--targetX', `${lerp(original.x, target.x, progress)}px`)
          // domEl.style.setProperty('--targetY', `${lerp(original.y, target.y, progress)}px`)
          // domEl.style.setProperty('--targetWidth', `${lerp(original.width, target.width, progress)}px`)
          // domEl.style.setProperty('--targetHeight', `${lerp(original.height, target.height, progress)}px`)
          // domEl.style.setProperty('--targetOpacity', `${lerp(0, 100, map(Math.abs(($viewOffset.x + $viewPort.w / 2) - target.x), 0, 800, 0, 1))}%`)
          // domEl.classList.add('moveAnim')
          c.update((_c) => {
            _c.xOverride = lerp(original.xOverride, original.x, progress)
            _c.yOverride = lerp(original.yOverride, original.y, progress)
            _c.widthOverride = lerp(original.widthOverride, original.width, progress)
            _c.heightOverride = lerp(original.heightOverride, original.height, progress)
            _c.scaleOverride = lerp(100, 100 * VISOR_SCALE_FAC, progress)
            return _c
          })
        })
      }
      requestAnimationFrame(_update)
    }
  }

  $: if ($visorEnabled) {
    handleVisorOpen()
  } else {
    handleVisorClose()
  }

  $: $visorEnabled && $visorSearchTerm !== '' && handleSearchChange($visorSearchTerm)
  let lastVisorSearchTerm = ''
  $: if ($visorEnabled && $visorSearchTerm === '' && $visorSearchTerm !== lastVisorSearchTerm) {
    computeVisorList($cards, undefined, true, true)
    applyVisorList()
  }

  const handleSearchChange = (query: string = '') => {
    lastVisorSearchTerm = query
    horizon.setActiveCard(null)
    const results =
      query === ''
        ? $cards
        : $cards.filter((c) => {
            const card = get(c)
            if (card.type === 'text') {
              return JSON.stringify((card as CardText).data.content)
                .toLowerCase()
                .includes(query.toLowerCase())
            } else if (card.type === 'browser') {
              const entry = horizon.historyEntriesManager.getEntry(
                (card as CardBrowser).data.historyStackIds[
                  (card as CardBrowser).data.currentHistoryIndex
                ]
              )
              return `${entry?.title} ${entry?.url}`.toLowerCase().includes(query.toLowerCase())
            } else if (card.type === 'file') {
              return (card as CardFile).data.name?.toLowerCase().includes(query.toLowerCase())
            }
          })
    computeVisorList(
      results,
      results.find((c) => get(c).id === $activeCardId) || undefined,
      false,
      true
    )
    applyVisorList()
  }

  onDestroy(
    cards.subscribe((v) => {
      if ($visorEnabled) handleSearchChange($visorSearchTerm)
    })
  )

  let visorLastActiveCardID: string | null = null
  let visorActiveCardSub: Unsubscriber
  let backupActiveCardID: string | null = null
  const handleVisorOpen = () => {
    backupActiveCardID = $activeCardId
    $settings.CAN_PAN = false
    $settings.CAN_DRAW = false
    $settings.CAN_SELECT = false

    if (visorListTargets.length === 0)
      computeVisorList($cards, $cards.find((c) => get(c).id === $activeCardId) || undefined, true)
    applyVisorList()
    if (visorInitFocussedId === null) {
      visorInitFocussedId = $activeCardId
    }
  }
  const handleVisorClose = () => {
    visorActiveCardSub && visorActiveCardSub()
    if (visorListTargets.length === 0) return
    function _update() {
      $cards.forEach((c) => {
        c.update((_c) => {
          _c.xOverride = undefined
          _c.yOverride = undefined
          _c.widthOverride = undefined
          _c.heightOverride = undefined
          _c.scaleOverride = undefined
          return _c
        })
      })
    }
    requestAnimationFrame(_update)

    if ($activeCardId !== backupActiveCardID) {
      horizon.scrollToCardCenter($activeCardId)
    }

    visorListTargets = []
    visorInitFocussedId = null
    visorScroll = 0
    $settings.CAN_PAN = true
    $settings.CAN_DRAW = true
    $settings.CAN_SELECT = true
  }

  onMount(() => {
    // const stack = [...$cards].sort((a, b) => { return get(a).stacking_order - get(b).stacking_order }).map((e) => get(e).id);

    loadHorizon()
    handleWindowResize()

    // @ts-ignore
    window.api.registerPreviewImageHandler(horizon.id, (blob: Blob) => {
      horizon?.setPreviewImage(blob)
    })

    horizon.attachBoard(board)
    horizon.attachSettings(settings)

    stack.set(get(horizon.stackingOrder))
    $state.stackingOrder = stack

    requestNewPreviewIntervalId = setInterval(updatePreview, REQUEST_NEW_PREVIEW_INTERVAL)
  })

  onDestroy(() => {
    horizon.detachBoard()
    horizon.detachSettings()
    clearInterval(requestNewPreviewIntervalId)
    window.api.unregisterPreviewImageHandler(horizon.id)
  })
</script>

<svelte:window
  on:resize={handleWindowResize}
  on:keyup={handleKeyup}
  on:keydown={handleKeydown}
  on:wheel={handleWheel}
/>

{#if showSelectTooltip}
  <div class="cursor-tooltip" style="--select-x: {selectPos.x}px; --select-y: {selectPos.y}px;">
    {selectSecondaryAction ? 'New Text Card' : 'New Browser Card'}
  </div>
{/if}

<div
  data-horizon={horizon.id}
  data-horizon-state={horizon.state}
  data-horizon-active={active}
  class="horizon"
>
  {#if !inOverview}
    <HorizonInfo {horizon} on:change />
  {/if}

  <Board
    {settings}
    {board}
    {positionables}
    on:modSelectChange={onModSelectChange}
    on:modSelectEnd={onModSelectEnd}
    on:positionableEnter={handlePositionableEnter}
    on:mousedown={handleMouseDown}
    bind:containerEl
    let:positionable
  >
    <svelte:fragment slot="selectRect">
      <div
        class="selectionRect"
        style="left: {snapToGrid($selectionRect?.x || 0, $settings.GRID_SIZE)}px; top: {snapToGrid(
          $selectionRect?.y || 0,
          $settings.GRID_SIZE
        )}px; width: {snapToGrid(
          $selectionRect?.w || 0,
          $settings.GRID_SIZE
        )}px; height: {snapToGrid(
          $selectionRect?.h || 0,
          $settings.GRID_SIZE
        )}px; z-index: 9999999;"
      >
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"
          ><defs
            ><pattern
              id="a"
              patternUnits="userSpaceOnUse"
              width="20"
              height="20"
              patternTransform="scale(0.5) rotate(135)"
              ><rect x="0" y="0" width="100%" height="100%" fill="currentColor" /><path
                d="M0 10h20z"
                stroke-width="1.5"
                stroke="currentColor"
                fill="none"
              /></pattern
            ></defs
          ><rect width="800%" height="800%" transform="translate(0,0)" fill="url(#a)" /></svg
        >
      </div>
      <!-- <div class="selectionRectShadow" style="left: {snapToGrid($selectionRect?.x || 0, $settings.GRID_SIZE)}px; top: {snapToGrid($selectionRect?.y || 0, $settings.GRID_SIZE)}px; width: {snapToGrid($selectionRect?.w || 0, $settings.GRID_SIZE)}px; height: {snapToGrid($selectionRect?.h || 0, $settings.GRID_SIZE)}px; z-index: 9999999;"></div> -->
    </svelte:fragment>

    <svelte:fragment slot="raw">
      <Grid dotColor="var(--color-text)" dotSize={1} dotOpacity={isDraggingCard ? 50 : 35} />

      <div
        class="abyss-indicator"
        style="position:absolute; top: 1080px; left: {$viewOffset.x - 20}px; z-index: -1;"
      >
        <svg
          version="1.1"
          width={$viewPort.w + 200}
          viewBox="0 0 3200 30"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <clipPath id="clip">
              <rect x="0" width="100%" height="30" />
            </clipPath>
            <path
              id="wave"
              d="m764 23c-8 10-8-10-16 0s-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0-8-10-16 0"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
            </path></defs
          >
          <g clip-path="url(#clip)">
            <use xlink:href="#wave" x="0" y="0" />
            <use xlink:href="#wave" x="1600" y="0" />
            <use xlink:href="#wave" x="2400" y="0" />
            <!-- <animateTransform
                  type="translate"
                  attributeName="transform"
                  from="0 0"
                  to="-16 0"
                  begin="0s"
                  dur="2s"
                  fill="remove"
                  repeatCount="indefinite"/>
        </path> -->
          </g>
        </svg>
        <small
          >Welcome to the Abyss! <br />Stuff down here might not be visible on smaller screens.
          <br />This line is a temporary measure.</small
        >
      </div>
    </svelte:fragment>

    <!-- TODO: Bit Hacky but works for now -->
    {#if $visorEnabled}
      <Positionable
        style="background: rgba(223, 39, 127, 0.8);"
        positionable={writable({
          id: 'visor_center_indicator',
          x: $viewOffset.x + $viewPort.w / 2,
          y: $viewPort.h / 2,
          width: 1,
          height: $viewPort.h / 2
        })}
      ></Positionable>
    {/if}

    <CardWrapper
      {positionable}
      {horizon}
      on:load={handleCardLoad}
      on:change={handleCardChange}
      on:delete={handleCardDelete}
      on:duplicate={handleCardDuplicate}
      on:beginDrag={handleCardBeginDrag}
      on:endDrag={handleCardEndDrag}
      on:beginResize={handleCardBeginResize}
      on:endResize={handleCardEndResize}
    />
  </Board>
</div>

<style>
  .cursor-tooltip {
    position: absolute;
    top: var(--select-y);
    left: var(--select-x);
    background: #000;
    color: #fff;
    font-size: 0.8rem;
    padding: 2px 4px;
    border-radius: 4px;
    border: 1px solid #1c1c1c;
    pointer-events: none;
    z-index: 1000;
  }
  .abyss-indicator {
    width: 115%;
    height: 120px;
    /* background: linear-gradient(0deg, rgba(255, 255, 255, 0) 10%, rgb(245, 245, 245) 100%); */
    padding: 0.5rem;
    position: relative;
    user-select: none;
  }
  .abyss-indicator > svg {
    position: absolute;
    top: -23px;
    color: rgb(236, 236, 236);
  }
  .abyss-indicator > small {
    position: absolute;
    top: 1.5rem;
    left: 2rem;
    color: rgb(196, 196, 196);
    font-weight: 400;
    font-size: 0.8rem;
  }
</style>
