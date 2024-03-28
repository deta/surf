<script lang="ts">
  import { get, writable, type Unsubscriber, type Writable, derived } from 'svelte/store'
  import { createEventDispatcher, getContext, onDestroy, onMount, setContext, tick } from 'svelte'

  import {
    Board,
    createSettings,
    createBoard,
    clamp,
    snapToGrid,
    hoistPositionable,
    hasClassOrParentWithClass,
    applyBounds,
    Positionable
  } from '@horizon/tela'
  import type { IBoard, IPositionable, Vec4 } from '@horizon/tela'

  import CardWrapper from './CardWrapper.svelte'
  import { Horizon, HorizonsManager } from '../../service/horizon'
  import { useLogScope } from '../../utils/log'
  import { requestNewPreviewImage, takePageScreenshot } from '../../utils/screenshot'
  import type { Card, CardBrowser } from '../../types/index'
  import { useDebounce } from '../../utils/debounce'
  import HorizonInfo from './HorizonInfo.svelte'
  import Grid from './Grid.svelte'
  import {
    APP_BAR_WIDTH,
    EDGE_SNAP_FACTOR,
    GRID_SIZE_COARSE,
    GRID_SIZE_FINE,
    QUICK_SNAP_THRESHOLD,
    SAFE_AREA_PADDING
  } from '../../constants/horizon'
  import { debounce, isInsideViewport, lerp, map } from '../../../../../tela/dist/utils'
  import { quadInOut } from 'svelte/easing'
  import { fade } from 'svelte/transition'
  import {
    applyFocusMode,
    focusModeEnabled,
    focusModeTargets,
    enterFocusMode,
    resetFocusMode
  } from '../../utils/focusMode'
  import { visorEnabled, visorPinch } from '../../utils/visor'
  import { buildDefaultList, buildMultiCardList } from '../FlyMenu/flyMenu'
  import FlyMenu, {
    closeFlyMenu,
    flyMenuItems,
    flyMenuOpen,
    flyMenuType,
    openFlyMenu
  } from '../FlyMenu/FlyMenu.svelte'
  import { ResourceManager, type ResourceNote } from '../../service/resources'
  import { SERVICES } from '@horizon/web-parser'
  import Minimap from './Minimap.svelte'
  import { TelemetryEventTypes } from '@horizon/types'
  import { useActionsService } from '../../service/actions'
  import { isModKeyAndKeyPressed } from '../../utils/keyboard'
  import { Icon } from '@horizon/icons'
  import { summarizeText } from '../../service/ai'

  export let active: boolean = true
  export let horizon: Horizon
  export let resourceManager: ResourceManager
  export let inOverview: boolean = false
  export let visorSearchTerm: Writable<string>

  setContext<Horizon>('horizon', horizon)

  const horizonsManager = getContext<HorizonsManager>('horizonsManager')
  const REQUEST_NEW_PREVIEW_INTERVAL = 3e3
  const cards = horizon.cards
  const data = horizon.data

  const log = useLogScope('Horizon Component')
  const dispatch = createEventDispatcher<{ change: Horizon; cardChange: Card }>()

  const actionsService = useActionsService()

  const settings = createSettings({
    CAN_PAN: true,
    CAN_DRAW: false,
    CAN_ZOOM: false,
    CAN_SELECT: false,
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

  const board: IBoard<any, any> = createBoard(
    settings,
    horizon.stackingOrder,
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
  const selection = $state.selection
  const selectionRect = $state.selectionRect
  const selectionCss = $state.selectionCss
  const viewOffset = $state.viewOffset
  const viewPort = $state.viewPort
  const activeCardId = horizon.activeCardId

  let containerEl: HTMLElement
  let requestNewPreviewIntervalId: number | undefined
  let isDraggingCard = false
  let showMagicInput = false
  let magicInputValue = ''
  let loadingMagicInput = false
  let magicInputResponse = ''

  $: horizonTint = horizon?.tint

  $: if (!active && horizon.state !== 'hot') {
    log.error('edge case! horizon is active but not hot')
  }

  const debouncedHorizonUpdate = useDebounce((...args: Parameters<typeof horizon.updateData>) => {
    return horizon.updateData(...args)
  }, 500)

  const debouncedCardUpdate = useDebounce((...args: Parameters<typeof horizon.updateCard>) => {
    return horizon.updateCard(...args)
  }, 500)

  const handleMagicInputRun = async () => {
    try {
      if (!magicInputValue) return

      const actions = actionsService.getActions()
      if (!actions) return

      log.debug('Running magic input', magicInputValue, actions)

      loadingMagicInput = true
      magicInputResponse = ''

      // @ts-expect-error
      const response = await window.api.aiFunctionCalls(magicInputValue, actions)
      log.debug('Magic input response', response)
      magicInputResponse = response
    } catch (e) {
      log.error('Error running magic input', e)
      magicInputResponse = 'failed to do magic: ' + e
    } finally {
      loadingMagicInput = false
    }
  }

  // Responsible for the scaling of the entire Horizon on bigger screens
  const handleWindowResize = () => {
    state.update((_state) => {
      _state.zoom.set(clamp(window.innerHeight / 1080, 1, Infinity))
      return _state
    })
    if ($focusModeEnabled) applyFocusMode($viewOffset, $viewPort, true)
    if ($visorEnabled) applyVisorList()
  }

  let unsubscribeViewOffset: Unsubscriber

  const loadHorizon = () => {
    $state.viewOffset.set({ x: data.viewOffsetX, y: 0 })

    if (unsubscribeViewOffset) {
      unsubscribeViewOffset()
    }

    unsubscribeViewOffset = viewOffset.subscribe((e) => {
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

    if (e.detail.event.metaKey) {
      $modSelectConfigurator = { x: selectPos.x, y: selectPos.y, width: 0, height: 0 }
    }

    // Right click
    //selectSecondaryAction = event.which === 3 || event.button === 2
  }

  let modSelectConfigurator: Writable<
    | {
        x: number
        y: number
        width: number
        height: number
      }
    | undefined
  > = writable(undefined)
  onDestroy(
    modSelectConfigurator.subscribe((v) => {
      if (v === undefined) closeFlyMenu()
    })
  )
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

    if (size.x < 101 || size.y < 101) {
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

    // Meta
    if (e.detail.event.metaKey) {
      $modSelectConfigurator = { x: pos.x, y: pos.y, width: size.x, height: size.y }
      openFlyMenu('cursor', buildDefaultList())
    } else {
      // Right click
      if (event.which === 3 || event.button === 2) {
        log.debug('creating new text card', position)
        horizon.addCardText('', position, undefined, undefined, {
          trigger: 'draw',
          foreground: true
        })
      } else {
        log.debug('creating new browser card', position)
        horizon.addCardBrowser('', position, { trigger: 'draw', foreground: true })
      }
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

    if (card.type === 'ai-text' || card.type === 'audio-transcriber') {
      await horizon.addCardText(
        card.summarizedText,
        {
          width: card.width,
          height: card.height,
          x: card.x + card.width + 50,
          y: card.y
        },
        undefined,
        undefined,
        { trigger: 'duplicate' }
      )
      // const newCardStore = await horizon.addTextCard(card.id, {
      //   width: card.width,
      //   height: card.height,
      //   x: card.x + card.width + 50,
      //   y: card.y
      // })
      //
      // const newCard = get(newCardStore)
      // horizon.scrollToCard(newCard)
      // horizon.setActiveCard(newCard.id)

      return
    }

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
      $modSelectConfigurator = undefined
    }

    // if (e.button === 2) {
    //   console.warn('ipen fly', $selection.size)
    //   openFlyMenu('cursor', $selection.size > 1 ? buildMultiCardList() : buildDefaultList())
    // } else {
    //   closeFlyMenu()
    // }
  }

  const handleKeydown = (e: KeyboardEvent) => {
    // Visor keys
    if (e.key === 'Enter' && $visorEnabled && $activeCardId !== null) {
      // Prevent centering in text cards & browsers for now.
      const card = $cards.find((c) => get(c).id === $activeCardId)
      if (!card) {
        console.error(
          `[Visor] Trying to close and switch to card ${$activeCardId}, but this card doesn't exist!`
        )
        return
      }

      $visorEnabled = false
      setTimeout(() => {
        horizon.scrollToCardCenter($activeCardId)
        horizon.moveCardToStackingTop($activeCardId)
      }, 800)
    } else if (e.key === 'f' && e.metaKey) {
      visorEnabled.set(!get(visorEnabled))
      if ($visorEnabled) closeFlyMenu()
    } else if ((e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) && $visorEnabled) {
      visorSelectPrev()
    } else if ((e.key === 'ArrowRight' || e.key === 'Tab') && $visorEnabled) {
      visorSelectNext()
    } else if (isModKeyAndKeyPressed(e, 'p')) {
      if (showMagicInput) {
        showMagicInput = false
        magicInputResponse = ''
        magicInputValue = ''
      } else {
        showMagicInput = true
      }
    }

    // Focus Mode keys
    // NOTE: Removed for launch demo
    /*else if (e.code === 'Space' && e.shiftKey) {
      // TODO: Need to handle forwared shift + space key frorm browserCard!
      e.preventDefault()
      e.stopPropagation()
      if ($activeCardId !== null) {
        const target = $cards.find((e) => get(e).id === $activeCardId)
        if (!target) console.error('Well this shoudl thappen!') // TODO: better err msg
      }

      if (!$focusModeEnabled && get($state.selection).size > 0) {
        closeFlyMenu()
        enableFocusMode([...get($state.selection)])
      } else if (!$focusModeEnabled && $activeCardId !== null) {
        closeFlyMenu()
        enableFocusMode([$activeCardId])
      } else {
        disableFocusMode()
      }
    } else if (e.key === 'Escape') {
      if ($focusModeEnabled) {
        disableFocusMode()
      }
    }*/

    // General keys
    // NOTE: Disabled for demo launch
    // else if (e.key === 'k' && e.metaKey) {
    //   if ($flyMenuOpen) closeFlyMenu()
    //   else {
    //     openFlyMenu('cmdk', buildDefaultList())
    //   }
    // }
    else if (e.key === 'Tab' && e.altKey) {
      // Alternative alt + K / L ?
      //if (e.location !== 2) return
      if (e.shiftKey) {
        tryFocusPrevCard() // TODO: refac/rename
      } else {
        tryFocusNextCard() // TODO: refac/rename
      }
    }
    // NOTE: Disabled for demo launch
    // else if (e.key === 'a' && e.metaKey && e.target === document.querySelector('body')) {
    //   e.preventDefault()
    //   $state.selection.update((v) => {
    //     v.clear()
    //     $cards.forEach((c) => {
    //       v.add(get(c).id)
    //     })
    //     return v
    //   })
    // }

    // NOTE: Temporary? Windowmanagement shortcuts for demo launch
    else if (e.altKey && $activeCardId !== null) {
      e.preventDefault()
      e.stopPropagation()
      const card = $cards.find((e) => get(e).id === $activeCardId)
      if (!card) return
      horizon.moveCardToStackingTop($activeCardId) // FIX: THIS
      if (e.key === 'ArrowLeft') {
        card.update((v) => {
          v.x = $viewOffset.x
          v.y = 0
          v.width = $viewPort.w / 2 - 5
          v.height = $viewPort.h
          return v
        })
      } else if (e.key === 'ArrowRight') {
        card.update((v) => {
          v.x = $viewOffset.x + $viewPort.w / 2 + 5
          v.y = 0
          v.width = $viewPort.w / 2 - 5
          v.height = $viewPort.h
          return v
        })
      } else if (e.code === 'KeyU') {
        card.update((v) => {
          v.x = $viewOffset.x
          v.y = 0
          v.width = $viewPort.w / 2 - 5
          v.height = $viewPort.h / 2 - 5
          return v
        })
      } else if (e.code === 'KeyI') {
        card.update((v) => {
          v.x = $viewOffset.x + $viewPort.w / 2 + 5
          v.y = 0
          v.width = $viewPort.w / 2 - 5
          v.height = $viewPort.h / 2 - 5
          return v
        })
      } else if (e.code === 'KeyJ') {
        card.update((v) => {
          v.x = $viewOffset.x
          v.y = $viewPort.h / 2 + 5
          v.width = $viewPort.w / 2 - 5
          v.height = $viewPort.h / 2 - 5
          return v
        })
      } else if (e.code === 'KeyK') {
        card.update((v) => {
          v.x = $viewOffset.x + $viewPort.w / 2 + 5
          v.y = $viewPort.h / 2 + 5
          v.width = $viewPort.w / 2 - 5
          v.height = $viewPort.h / 2 - 5
          return v
        })
      } else if (e.key === 'Enter') {
        card.update((v) => {
          if (v.isMaximized === true) {
            v.x = v.maximizeBackup.x
            v.y = v.maximizeBackup.y
            v.width = v.maximizeBackup.width
            v.height = v.maximizeBackup.height
            v.isMaximized = undefined
            v.maximizeBackup = undefined
          } else {
            v.isMaximized = true
            v.maximizeBackup = { x: v.x, y: v.y, width: v.width, height: v.height }
            v.x = $viewOffset.x
            v.y = 0
            v.width = $viewPort.w
            v.height = $viewPort.h
          }
          return v
        })
      }
    }

    // Slice navigation
    else if (e.metaKey && e.key === 'ArrowRight') {
      const target = $viewOffset.x + $viewPort.w
      const adjusted = target - (target % $viewPort.w)
      requestAnimationFrame(() => $state.viewOffset.set({ x: adjusted, y: 0 }, { duration: 50 }))
    } else if (e.metaKey && e.key === 'ArrowLeft') {
      const startDif = $viewOffset.x % $viewPort.w
      const target =
        Math.abs(startDif) <= 35 ? $viewOffset.x - $viewPort.w : $viewOffset.x - startDif
      requestAnimationFrame(() =>
        $state.viewOffset.set({ x: clamp(target, 0, Infinity), y: 0 }, { duration: 50 })
      )
    } else if (e.key === 'Escape') {
      $modSelectConfigurator = undefined
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
    if (e.key === 'Escape') {
      $activeCardId = null
      $visorEnabled = false
    }
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

  /* FOCUS MODE*/
  const enableFocusMode = (cardIds?: string[]) => {
    return
    if (cardIds === undefined) return
    $state.selection.set(new Set())

    const focusCards = $cards.filter((c) => cardIds.includes(get(c).id))
    focusModeTargets.set([focusCards, [...focusCards.slice(0, 4).map((e) => get(e).id)]]) // TODO: Get order somewhere? nono only for stacks?!

    $settings.CAN_DRAW = false
    $settings.CAN_PAN = false
    $settings.CAN_SELECT = false
    applyFocusMode($viewOffset, $viewPort)
  }
  const disableFocusMode = () => {
    return
    const [cards, _] = $focusModeTargets

    cards.forEach((c) => {
      if (get(c).isTemporary) {
        cards.splice(cards.indexOf(c), 1)
        horizon.deleteCard(get(c).id)
      }
    })

    resetFocusMode() // TODO: Can this be auto subscription inside focusMode.ts ?

    $settings.CAN_DRAW = true
    $settings.CAN_PAN = true
    $settings.CAN_SELECT = true
  }

  /* RAPID SWITCHING */
  const tryFocusNextCard = () => {
    if ($activeCardId === null) {
      const closest = $cards.toSorted((a, b) => {
        const aCenter = get(a).x + get(a).width / 2
        const bCenter = get(b).x + get(b).width / 2
        return (
          Math.abs($viewOffset.x + $viewPort.w / 2 - aCenter) -
          Math.abs($viewOffset.x + $viewPort.w / 2 - bCenter)
        )
      })[0]
      horizon.setActiveCard(get(closest).id)
    }

    // Find card next to it
    const current = $cards.find((e) => get(e).id === $activeCardId)
    if (!current) return // TODO: Error
    const target = $cards
      .filter(
        (e) =>
          get(e).id !== $activeCardId &&
          (get(e).x > get(current).x || (get(e).x === get(current).x && get(e).y > get(current).y))
      )
      //.toSorted((a, b) => get(a).y - get(b).y)
      .toSorted((a, b) => get(a).x - get(b).x || get(a).y - get(b).y)
      .at(0)
    if (!target) return
    horizon.scrollToCardCenter(get(target).id)
    horizon.setActiveCard(get(target).id)
  }
  const tryFocusPrevCard = () => {
    if ($activeCardId === null) {
      const closest = $cards.toSorted((a, b) => {
        const aCenter = get(a).x + get(a).width / 2
        const bCenter = get(b).x + get(b).width / 2
        return (
          Math.abs($viewOffset.x + $viewPort.w / 2 - aCenter) -
          Math.abs($viewOffset.x + $viewPort.w / 2 - bCenter)
        )
      })[0]
      horizon.setActiveCard(get(closest).id)
    }

    // Find card next to it
    const current = $cards.find((e) => get(e).id === $activeCardId)
    if (!current) return // TODO: Error
    const target = $cards
      .filter(
        (e) =>
          get(e).id !== $activeCardId &&
          (get(e).x < get(current).x || (get(e).x === get(current).x && get(e).y < get(current).y))
      )
      .toSorted((a, b) => get(b).x - get(a).x || get(b).y - get(a).y)
      .at(0)
    if (!target) return
    horizon.scrollToCardCenter(get(target).id)
    horizon.setActiveCard(get(target).id)
  }

  const handleFlyCommand = async (
    e: CustomEvent<{ cmd: string; origin: 'cursor' | 'cmdk'; targetRect: any }>
  ) => {
    let { cmd, origin, targetRect } = e.detail
    cmd = cmd.toLowerCase()

    // Close preview if open
    if ($modSelectConfigurator !== undefined) $modSelectConfigurator = undefined

    // const CARD_W = 550
    // const CARD_H = 420
    // const position = {
    //   x: origin === 'cursor' ? targetX - CARD_W / 2 : $viewOffset.x + $viewPort.w / 2 - CARD_W / 2,
    //   y: origin === 'cursor' ? targetY - CARD_H / 2 : $viewOffset.y + $viewPort.h / 2 - CARD_H / 2,
    //   width: CARD_W,
    //   height: CARD_H
    // }
    // const bound = applyBounds(position, $settings)
    // position.x = bound.x
    // position.y = bound.y

    // TODO: Support all cmds
    // -- Global
    if (cmd === 'new horizon') {
      // TODO: impl
    } else if (cmd === 'delete horizon') {
      // TODO: impl
    }

    // -- APPS
    // TODO: Make app path dynamic for apps (?concept)
    console.log('[FlyMenu] cmd: ', cmd)
    if (SERVICES.map((e) => e.id).includes(cmd)) {
      const card = await horizon.addCardBrowser(
        SERVICES.find((e) => e.id === cmd)!.url,
        targetRect,
        {
          foreground: true,
          trigger: 'draw'
        }
      )
      if (origin === 'cmdk') {
        card.update((v) => {
          v.isTemporary = true
          return v
        })
      }
      //if (origin === 'cmdk') enterFocusMode([get(card).id], horizon.board, horizon.cards)
    }
    if (cmd === 'text') {
      await horizon.addCardText('', targetRect, { name: 'New Text Card' }, [], {
        foreground: true,
        trigger: 'draw'
      })
      //if (origin === 'cmdk') enterFocusMode([get(card).id], horizon.board, horizon.cards)
    } else if (cmd === 'browser') {
      await horizon.addCardBrowser('', targetRect, {
        foreground: true,
        trigger: 'draw'
      })
      //if (origin === 'cmdk') enterFocusMode([get(card).id], horizon.board, horizon.cards)
    } else if (cmd === 'summarize') {
      horizon.addCardAIText(targetRect, { trigger: 'draw' })
    } else if (cmd === 'transcribe') {
      horizon.addCardAudioTranscriber(targetRect, { trigger: 'draw' })
    }

    // -- Card actions
    /*else if (cmd === 'focus card' || cmd === 'focus cards') {
      enableFocusMode([...$selection.values()])
    } else if (cmd === 'unpin card') {
      horizon.deleteCard([...$selection.values()][0])
    } else if (cmd === 'unpin cards') {
      for (let id of $selection.values()) {
        horizon.deleteCard(id)
      }
    }*/
  }

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
    // TODO: Case? Do we need this feat?
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
      .filter(
        (c, i, a) => a.findIndex((e) => get(e).id === get(c).id) === i
      ) /* Removes duplicates -> fix gap */
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

  // TODO: Move this into utils! Simple throttle function
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
    blockSearchTracking = false
  }

  $: $visorEnabled && $visorSearchTerm !== '' && handleSearchChange($visorSearchTerm)
  let lastVisorSearchTerm = ''
  $: if ($visorEnabled && $visorSearchTerm === '' && $visorSearchTerm !== lastVisorSearchTerm) {
    computeVisorList($cards, undefined, true, true)
    applyVisorList()
  }

  let blockSearchTracking = false
  $: if ($visorEnabled && $visorSearchTerm !== '' && !blockSearchTracking) {
    blockSearchTracking = true
    trackVisorSearch()
  }

  const trackVisorSearch = () => {
    horizonsManager.telemetry.trackEvent(TelemetryEventTypes.VisorSearch, {})
  }

  const handleSearchChange = async (query: string = '') => {
    lastVisorSearchTerm = query
    horizon.setActiveCard(null)
    const resources = await resourceManager.searchResources(
      query,
      [ResourceManager.SearchTagDeleted(false)],
      { semanticEnabled: true, semanticDistanceThreshold: 1.0 }
    )
    let results = $cards
    if (query !== '') {
      results = []
      for (const _card of $cards) {
        const card = get(_card)
        if (card.type === 'browser') {
          // TODO: if resourceId -> search ffs
          const entry = horizon.historyEntriesManager.getEntry(
            (card as CardBrowser).data.historyStackIds[
              (card as CardBrowser).data.currentHistoryIndex
            ]
          )
          if (`${entry?.title} ${entry?.url}`.toLowerCase().includes(query.toLowerCase()))
            results.push(_card)
        } else if (card.type === 'text' && card.resourceId !== null) {
          const resource = (await resourceManager.getResource(card.resourceId)) as ResourceNote
          get(resource.parsedData)?.toLowerCase().includes(query.toLowerCase()) &&
            results.push(_card)
        }
        if (card.resourceId) {
          const k = resources.findIndex((e) => e.id === card.resourceId)
          if (k !== -1) results.push(_card)
        }
      }
    }
    computeVisorList(
      results,
      results.find((c) => get(c).id === $activeCardId) || undefined,
      false,
      true
    )
    applyVisorList()
  }

  // Try to cleanup
  onDestroy(
    cards.subscribe((v) => {
      if ($visorEnabled) handleSearchChange($visorSearchTerm)
      if (v.length <= 0) $visorEnabled = false
    })
  )

  let visorLastActiveCardID: string | null = null
  let visorActiveCardSub: Unsubscriber
  let backupActiveCardID: string | null = null
  const handleVisorOpen = () => {
    if ($focusModeEnabled) focusModeEnabled.set(false)

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
    if (visorListTargets.length !== 0) {
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
        const target = $cards.find((e) => get(e).id === $activeCardId)
        if (target) horizon.scrollToCardCenter($activeCardId)
      }
    }

    visorListTargets = []
    visorInitFocussedId = null
    visorScroll = 0
    $settings.CAN_PAN = true
    $settings.CAN_DRAW = true
    //$settings.CAN_SELECT = true
  }

  onMount(() => {
    // const stack = [...$cards].sort((a, b) => { return get(a).stackingOrder - get(b).stackingOrder }).map((e) => get(e).id);

    loadHorizon()
    handleWindowResize()

    // @ts-ignore
    window.api.registerPreviewImageHandler(horizon.id, (blob: Blob) => {
      horizon?.setPreviewImage(blob)
    })

    horizon.attachBoard(board)
    horizon.attachSettings(settings)

    // TODO: register summarize action
    actionsService.registerAction({
      handle: (args) => summarizeText(args.text),
      id: 'summarize_text',
      name: 'Summarize Text',
      description: 'Summarizes text or tables and returns the summary as text',
      type: 'system',
      inputs: {
        text: {
          type: 'string',
          description: 'text or table content to summarize'
        }
      },
      output: {
        type: 'string',
        description: 'summarized text'
      }
    })

    requestNewPreviewIntervalId = setInterval(updatePreview, REQUEST_NEW_PREVIEW_INTERVAL)
  })

  onDestroy(() => {
    if ($focusModeEnabled) disableFocusMode()

    horizon.detachBoard()
    horizon.detachSettings()
    clearInterval(requestNewPreviewIntervalId)
    window.api.unregisterPreviewImageHandler(horizon.id)

    if (unsubscribeViewOffset) {
      unsubscribeViewOffset()
    }

    actionsService.unregisterAction('summarize_text')
  })

  // HACK: Sketchy way to fix the noise "issue"
  let showNoise = false
  onMount(() => {
    setTimeout(() => {
      showNoise = true
    }, 100)
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
    {$modSelectConfigurator !== undefined
      ? 'New'
      : selectSecondaryAction
        ? 'New Text Card'
        : 'New Browser Card'}
  </div>
{/if}

<div
  data-horizon={horizon.id}
  data-horizon-state={horizon.state}
  data-horizon-active={active}
  class="horizon"
  style="--horizon-tint: {$horizonTint};"
>
  <svg
    class="noiseBg"
    style="{showNoise ? 'opacity: 1;' : ''} {inOverview ? 'opacity: 0;' : ''}"
    viewBox="0 0 {$viewPort.w} {$viewPort.h + $viewPort.y}"
    xmlns="http://www.w3.org/2000/svg"
  >
    <filter id="noiseFilter">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
    </filter>

    <rect width="100%" height="100%" filter="url(#noiseFilter)" />
  </svg>
  <!-- <svg class="noiseBg" viewBox="0 0 {$viewPort.w} {$viewPort.h}"><defs><filter id="nnnoise-filter" x="-20%" y="-20%" width="140%" height="140%" filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse" color-interpolation-filters="linearRGB">
	      <feTurbulence type="turbulence" baseFrequency="0.171" numOctaves="4" seed="15" stitchTiles="stitch" x="0%" y="0%" width="100%" height="100%" result="turbulence"></feTurbulence>
	      <feSpecularLighting surfaceScale="4" specularConstant="0.4" specularExponent="20" lighting-color="#6b00ff" x="0%" y="0%" width="100%" height="100%" in="turbulence" result="specularLighting">
    		<feDistantLight azimuth="3" elevation="60"></feDistantLight>
  	</feSpecularLighting>

</filter></defs><rect width="100%" height="100%" fill="#ffffffff"></rect><rect width="700" height="700" fill="#6b00ff" filter="url(#nnnoise-filter)"></rect></svg> -->
  <div class="tintBg"></div>

  <Minimap {cards} {viewOffset} {viewPort} />

  {#if showMagicInput}
    <div class="magic-input-wrapper magic-glow">
      <div class="magic-input">
        {#if magicInputResponse}
          <div class="output">
            <p>{magicInputResponse}</p>
          </div>
        {/if}

        <form on:submit|preventDefault={handleMagicInputRun}>
          <input bind:value={magicInputValue} placeholder="what do you want to do?" />
          <button type="submit" disabled={loadingMagicInput}>
            {#if loadingMagicInput}
              <Icon name="spinner" />
            {:else}
              <Icon name="sparkles" />
            {/if}
          </button>
        </form>
      </div>
    </div>
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
        class="selectionRect {$state.mode}"
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
        {#if get($state.mode) === 'modSelect'}
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <pattern
              id="dotGrid"
              x="{$selectionRect.w / 18 / 2}px"
              y="{$selectionRect.h / 18 / 2}px"
              width="{$selectionRect.w / 18}px"
              height="{$selectionRect.h / 18}px"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="0.5" cy="0.5" r="1" fill="rgba(0,0,0,0.25)" fill-opacity="100%" />
            </pattern>

            <!-- Left square with user space tiles -->
            <rect x="0" y="0" width="100%" height="100%" fill="url(#dotGrid)" />
          </svg>
        {/if}
        <!-- <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"
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
        > -->
      </div>
      <!-- <div class="selectionRectShadow" style="left: {snapToGrid($selectionRect?.x || 0, $settings.GRID_SIZE)}px; top: {snapToGrid($selectionRect?.y || 0, $settings.GRID_SIZE)}px; width: {snapToGrid($selectionRect?.w || 0, $settings.GRID_SIZE)}px; height: {snapToGrid($selectionRect?.h || 0, $settings.GRID_SIZE)}px; z-index: 9999999;"></div> -->
    </svelte:fragment>

    <svelte:fragment slot="raw">
      <!-- <Grid dotColor="var(--color-text)" dotSize={1} dotOpacity={isDraggingCard ? 50 : 35} /> -->

      <!-- <FlyMenu {viewOffset} {viewPort} on:command={handleFlyCommand} /> -->
      <FlyMenu
        {viewOffset}
        {viewPort}
        origin={modSelectConfigurator}
        on:command={handleFlyCommand}
      />

      {#if $modSelectConfigurator !== undefined}
        <div
          class="drawMenu"
          style="top: {$modSelectConfigurator.y}px; left: {$modSelectConfigurator.x}px; width: {$modSelectConfigurator.width}px; height: {$modSelectConfigurator.height}px;"
        ></div>
      {/if}

      {#if $focusModeEnabled}
        <div
          class="focus-background"
          style="top: {-$viewPort.y}px;left: {$viewOffset.x -
            $viewPort.x}px; bottom: -{$viewPort.y}px;"
          transition:fade={{ duration: 110, easing: quadInOut }}
        ></div>
      {/if}

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

<style lang="scss">
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
    left: 6rem;
    width: 60ch;
    color: rgb(196, 196, 196);
    font-weight: 400;
    font-size: 0.8rem;
  }
  .noiseBg {
    position: absolute;
    inset: 0;
    z-index: 0;
    opacity: 0;
    filter: contrast(340%) brightness(200%);
    transition: opacity 600ms ease-out;
    /* mix-blend-mode: color-dodge; */
  }
  .tintBg {
    background: linear-gradient(30deg, rgba(17, 13, 244, 0.364) 10%, rgba(155, 119, 233, 0.15) 50%);
    background: linear-gradient(30deg, var(--horizon-tint) 10%, transparent 50%);
    position: absolute;
    z-index: 10;
    inset: 0;
    mix-blend-mode: color-dodge;

    transition: all 2.5s ease; /* TODO: This doesnt work!? */
  }
  .horizon {
    /* background: linear-gradient(to top right, rgba(24, 68, 227, 0.657) 10%, transparent 50%); */
  }

  .magic-input-wrapper {
    position: absolute;
    bottom: 1.5rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 100000;
    width: 700px;
    max-width: 80%;
  }

  .magic-input {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: rgb(255, 255, 255);
    border-radius: 8px;
    padding: 0.5rem;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(0, 0, 0, 0.1);

    form {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .output {
      padding: 0.5rem;
      padding-bottom: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.25rem;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    }

    input {
      border: none;
      outline: none;
      padding: 0.5rem;
      border-radius: 8px;
      font-size: 1rem;
      flex-grow: 1;
      width: 100%;
    }

    button {
      appearance: none;
      border: none;
      outline: none;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-size: 1rem;
      background: rgb(223, 39, 127);
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }
  }
</style>
