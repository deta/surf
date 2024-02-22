<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'
  import { get, writable, type Writable } from 'svelte/store'

  import {
    Board,
    createSettings,
    createBoard,
    clamp,
    snapToGrid,
    hoistPositionable,
    hasClassOrParentWithClass
  } from '@horizon/tela'
  import type { IBoard, IPositionable, Vec4 } from '@horizon/tela'

  import CardWrapper from './CardWrapper.svelte'
  import { Horizon } from '../../service/horizon'
  import { useLogScope } from '../../utils/log'
  import { requestNewPreviewImage, takePageScreenshot } from '../../utils/screenshot'
  import type { Card } from '../../types/index'
  import { useDebounce } from '../../utils/debounce'
  import HorizonInfo from './HorizonInfo.svelte'
  import Grid from './Grid.svelte'
  import {
    EDGE_SNAP_FACTOR,
    GRID_SIZE_COARSE,
    GRID_SIZE_FINE,
    QUICK_SNAP_THRESHOLD
  } from '../../constants/horizon'

  export let active: boolean = true
  export let horizon: Horizon
  export let inOverview: boolean = false

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

  // TODO fix types to get rid of this type conversion
  $: positionables = cards as unknown as Writable<Writable<IPositionable<any>>[]>

  // onDestroy(
  //   $state.stackingOrder.subscribe((e) => {
  //     $cards.forEach((c) => {
  //       // TODO: THis succs for many perf reason. get rid of it!
  //       c.update((_c) => {
  //         _c.stacking_order = get($state.stackingOrder).indexOf(get(c).id)
  //         horizon.updateCard(_c.id, { stacking_order: _c.stacking_order })
  //         return _c
  //       })
  //     })
  //   })
  // )

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

<svelte:window on:resize={handleWindowResize} on:keyup={handleKeyup} on:keydown={handleKeydown} />

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
    </svelte:fragment>

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
