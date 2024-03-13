<!-- <svelte:options immutable={true} /> -->

<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'
  import { derived, get, type Writable } from 'svelte/store'
  import { tooltip } from '@svelte-plugins/tooltips'

  import {
    Draggable,
    Positionable,
    Resizable,
    type IPositionable,
    hasClassOrParentWithClass,
    posToAbsolute,
    rectsIntersect
  } from '@horizon/tela'

  import type { Card, CardEvents } from '../../types/index'
  import { useLogScope } from '../../utils/log'
  import type { Horizon } from '../../service/horizon'
  import { Icon } from '@horizon/icons'
  import CardContent from '../Cards/CardContent.svelte'
  import {
    applyFocusMode,
    focusModeEnabled,
    focusModeTargets,
    get1x11PaneAt,
    get1x1PaneAt,
    get2x2PaneAt,
    getCardOnPane
  } from '../../utils/focusMode'
  import { visorEnabled } from '../../utils/visor'
  import { openFlyMenu } from '../FlyMenu/FlyMenu.svelte'
  import { buildCardList, buildMultiCardList } from '../FlyMenu/flyMenu'

  export let positionable: Writable<IPositionable<any>>
  export let horizon: Horizon

  $: board = horizon.board
  $: state = board?.state
  $: selection = $state?.selection
  $: viewPort = $state?.viewPort
  $: viewOffset = $state?.viewOffset
  $: mode = $state?.mode

  const dispatch = createEventDispatcher<CardEvents>()
  const log = useLogScope('CardWrapper')

  const CONNECTION_THRESHOLD = 50

  const magicFieldParticipant = horizon.magicFieldService.createParticipant($positionable.id, {
    x: $positionable.x,
    y: $positionable.y,
    width: $positionable.width,
    height: $positionable.height
  })

  const activeField = magicFieldParticipant.inField
  const connectedField = magicFieldParticipant.connectedField
  const fieldParticipation = magicFieldParticipant.fieldParticipation

  $: selfIsField = $activeField?.id === magicFieldParticipant.id
  const magicFieldColorIdx = derived(
    [activeField, horizon.magicFieldService.fields],
    ([_activeField, _fields]) => {
      const fieldsIndex = _fields.findIndex((e) => e.id === magicFieldParticipant.id)
      if (fieldsIndex !== -1) return fieldsIndex % 4
      else if (_activeField !== null) {
        return _fields.findIndex((f) => f.id === _activeField.id) % 4
      } else return -1
    }
  )

  let isConnecting = false

  magicFieldParticipant.onFieldEnter((field) => {
    log.debug('fieldEnter', field)
  })

  magicFieldParticipant.onFieldConnect((field) => {
    log.debug('connected to field', field)
  })

  magicFieldParticipant.onFieldLeave((field) => {
    log.debug('fieldLeave', field)
    isConnecting = false
  })

  const handleMagicFieldConnect = () => {
    log.debug('handleMagicFieldConnect', $card.id)
    if (!$activeField) return

    $activeField.connect(magicFieldParticipant.id)
  }

  fieldParticipation.subscribe((p) => {
    let fieldPos: any | null = null
    if (get(activeField) !== null) {
      fieldPos = get(get(activeField)!.position)
    }
    if (
      (p &&
        p.supported &&
        fieldPos !== null &&
        rectsIntersect(
          { x: fieldPos.x, y: fieldPos.y, w: fieldPos.width, h: fieldPos.height },
          {
            x: $positionable.x,
            y: $positionable.y,
            w: $positionable.width,
            h: $positionable.height
          }
        )) ||
      (p &&
        p.supported &&
        p.distance < CONNECTION_THRESHOLD &&
        !isConnecting &&
        $mode !== 'dragging')
    ) {
      log.debug('initiating connect', p)
      isConnecting = true
      handleMagicFieldConnect()
    }
  })

  const minSize = { x: 100, y: 100 }
  const maxSize = { x: Infinity, y: Infinity }
  const DRAGGING_MENU_PADDING = 75
  const DRAG_OVER_ACTIVATION_TIMEOUT = 1000

  let el: HTMLElement
  // let menuPosition = 'top'
  // let insetMenu = false
  let headerClickTimeout: ReturnType<typeof setTimeout> | null = null
  let dragOverTimeout: ReturnType<typeof setTimeout> | null = null

  // Focus Mode
  let isDragging = false
  let isFocusDragging = false
  let focusModeBackup: null | { x: number; y: number; width: number; height: number } = null
  let focusSwitchTarget: null | number = null

  $: card = positionable as Writable<Card> // todo: fix this unnecessary cast
  $: cardTitle = $card.type[0].toUpperCase() + $card.type.slice(1)
  $: activeCardId = horizon.activeCardId
  $: active = $activeCardId === $card.id
  $: selected = $selection?.has($card.id) || false
  $: allowDuplicating = ['text', 'browser', 'ai-text', 'audio-transcriber'].includes($card.type)

  const updateCard = () => {
    log.debug('updateCard', $card)
    dispatch('change', $card)
  }

  const handleMouseDown = (event: MouseEvent) => {
    // if (event.button === 2) {
    //   selection.set(new Set([...$selection.values(), $card.id]))
    //   openFlyMenu('cursor', $selection.size > 1 ? buildMultiCardList() : buildCardList())
    //   event.stopPropagation()
    //   return
    // }

    if (event.metaKey || event.ctrlKey) {
      if ($visorEnabled) {
        $visorEnabled = false
        setTimeout(() => {
          horizon.setActiveCard($card.id)
          horizon.scrollToCardCenter($card.id)
        }, 0)
      } else {
        horizon.setActiveCard($card.id)
        horizon.scrollToCardCenter($card.id)
      }
    } else {
      // Dirty "hack" to still allow clicking the delete button
      if (hasClassOrParentWithClass(event.target, 'visor-delete')) return

      // Multi select
      if (event.shiftKey) {
        selection.update((v) => {
          v.add($card.id)
          return v
        })
      } else {
        horizon.setActiveCard($card.id)
      }
      if ($visorEnabled) {
        $visorEnabled = false
        setTimeout(() => {
          horizon.scrollToCardCenter($card.id)
        }, 0)
      }
    }

    // Focus Mode
    if ($focusModeEnabled) {
      isFocusDragging = true
      focusModeBackup = { ...$positionable }
    }

    // Focus Mode
    if ($focusModeEnabled) {
      isFocusDragging = true
      focusModeBackup = { ...$positionable }
    }
  }

  const handleDragEnd = (_: any) => {
    isDragging = false
    isFocusDragging = false
    if ($focusModeEnabled && focusModeBackup !== null) {
      if (focusSwitchTarget !== null) {
        focusModeTargets.update((v) => {
          const order = v[1]
          if (order.indexOf($card.id) !== -1) {
            const srcIndex = order.indexOf($card.id)
            order[srcIndex] = order[focusSwitchTarget!]
            order[focusSwitchTarget!] = $card.id
          } else {
            order[focusSwitchTarget!] = $card.id
          }
          return v
        })
        applyFocusMode($viewOffset!, $viewPort!, true)
      } else {
        card.update((p) => {
          p.xOverride = focusModeBackup!.xOverride
          p.yOverride = focusModeBackup!.yOverride
          p.widthOverride = focusModeBackup!.widthOverride
          p.heightOverride = focusModeBackup!.heightOverride
          p.focusStack = undefined
          return p
        })
        focusModeBackup = null
      }
    }

    // horizon.telaSettings?.update((v) => {
    //   v.CAN_SELECT = true
    //   return v
    // })

    if ($focusModeEnabled) return
    dispatch('endDrag', $card)
    const board = horizon.board
    if (!board) console.error('No board found ond rag end')
    const state = get(board!.state)
    $card.stackingOrder = get(state.stackingOrder).indexOf($card.id)
    updateCard()
  }

  // const handleMouseMove = (_e: MouseEvent) => {
  //   const rect = el.getBoundingClientRect()

  //   if (rect.y < DRAGGING_MENU_PADDING) {
  //     insetMenu = true
  //   } else {
  //     insetMenu = false
  //   }
  // }

  const handleCardHeaderMouseDown = (_e: MouseEvent) => {
    dispatch('beginDrag', $card)
    isDragging = true
    horizon.telaSettings?.update((v) => {
      v.CAN_SELECT = false
      return v
    })
    if (headerClickTimeout) {
      clearTimeout(headerClickTimeout)
      headerClickTimeout = null
      log.debug('double click')

      positionable.update((p) => {
        p.height = $viewPort.h - p.y
        return p
      })
    } else {
      headerClickTimeout = setTimeout(() => {
        headerClickTimeout = null
      }, 500)
    }
  }

  const onDragMove = (
    e: CustomEvent<{
      key: string
      clientX: number
      clientY: number
      offset: { x: number; y: number }
    }>
  ) => {
    const { clientX, clientY, offset } = e.detail
    // NOTE: Commented a lot of code as its not needed for the demo and errors for reasons yet unknown
    //const abs = posToAbsolute(clientX, clientY, $viewOffset!.x, $viewOffset!.y, $viewPort!, 1)
    // log.debug('drag move', abs)
    // magicFieldParticipant.updatePosition({
    //   x: abs.x,
    //   y: abs.y,
    //   width: $card.width,
    //   height: $card.height
    // })

    /*if (!$focusModeEnabled) return

    card.update((v) => {
      v.xOverride = abs.x - $card.widthOverride / 2
      v.yOverride = abs.y
      return v
    }):w


    // Check if has to switch places
    // TODO: This is not very clean but works for now
    const targetPane =
      $focusModeTargets[0].length === 2
        ? get1x1PaneAt(clientX, clientY, $viewPort!)
        : $focusModeTargets[0].length === 3
          ? get1x11PaneAt(clientX, clientY, $viewPort!)
          : $focusModeTargets[0].length >= 4
            ? get2x2PaneAt(clientX, clientY, $viewPort!)
            : 0
    focusSwitchTarget = targetPane
    const targetCard = getCardOnPane(targetPane)
    $focusModeTargets[0].forEach((c) => {
      c.update((v) => {
        v.dashHighlight = false
        return v
      })
    })
    targetCard.update((v) => {
      v.dashHighlight = true
      return v
    })*/
  }

  const handleResizeBegin = () => {
    dispatch('beginResize', $card)
  }
  const handleResizeEnd = () => {
    dispatch('endResize', $card)
  }

  const handleDelete = () => {
    if (headerClickTimeout) {
      clearTimeout(headerClickTimeout)
      headerClickTimeout = null
    }
    dispatch('delete', $card)
  }

  const handleDuplicate = () => {
    if (headerClickTimeout) {
      clearTimeout(headerClickTimeout)
      headerClickTimeout = null
    }
    dispatch('duplicate', $card)
  }

  function scrollTo(event: MouseEvent) {
    const button = event.target as HTMLButtonElement
    const cardID = button.getAttribute('data-card-id')
    if (cardID) {
      horizon.scrollToCardCenter(cardID)
    }
  }

  const clearDragTimeout = () => {
    log.debug('clearing drag over timeout', $card.id)
    if (dragOverTimeout) {
      clearTimeout(dragOverTimeout)
      dragOverTimeout = null
    }

    window.removeEventListener('drop', clearDragTimeout)
  }

  const handleDragEnter = (e: DragEvent) => {
    if ($visorEnabled) return // TODO: Prob make this easier component wide
    log.debug('drag enter', $card.id)
    clearDragTimeout()

    dragOverTimeout = setTimeout(() => {
      log.debug('drag over, setting active card')
      horizon.setActiveCard($card.id)
    }, DRAG_OVER_ACTIVATION_TIMEOUT)

    window.addEventListener('drop', clearDragTimeout)
  }

  const handleDragOver = (e: DragEvent) => {
    if ($visorEnabled) return // TODO: Prob make this easier component wide
    log.debug('drag over', $card.id)

    if (!dragOverTimeout) {
      handleDragEnter(e)
    }
  }

  const handleDragLeave = (e: DragEvent) => {
    if ($visorEnabled) return // TODO: Prob make this easier component wide
    const target = e.target as HTMLElement
    log.debug('drag leave', $card.id, target)

    clearDragTimeout()
  }

  // NOTE: These two are used for the focus mode stack
  const handleMouseEnter = (e: MouseEvent) => {
    if (!get(focusModeEnabled) || !$card.focusStack || isFocusDragging) return
    card.update((v) => {
      v.yOverride -= 150
      // v.zOverride += 9000
      return v
    })
  }
  const handleMouseLeave = (e: MouseEvent) => {
    if (!get(focusModeEnabled) || !$card.focusStack || isFocusDragging) return
    card.update((v) => {
      v.yOverride += 150
      // v.zOverride -= 9000
      return v
    })
  }

  let headerOpen = false
  const onHeaderMouseLeave = (e: MouseEvent) => {
    if (isDragging) return
    headerOpen = false
  }

  let headerMouseOver = false
  const handleHeaderListMouseEnter = () => {
    headerMouseOver = true
  }
  const handleHeaderListMouseLeave = () => {
    headerMouseOver = false
  }

  const handleMouseMove = (e: MouseEvent) => {
    const { clientX, clientY } = e

    if (isDragging) return
    if (!$viewOffset || !$viewPort) {
      // TODO: look into this..
      //console.warn('DRAGGG NO VIEWPORT OFFSET HEADER!!!!!')
      headerOpen = false
      return
    }
    const cardHeaderPt = {
      x: $card.x + 70 - $viewOffset?.x + $card.width / 2,
      y: $card.y - $viewOffset?.y - $viewPort?.y
    }
    const distance = Math.sqrt(
      Math.pow(cardHeaderPt.x - clientX, 2) + Math.pow(cardHeaderPt.y - clientY, 2)
    )
    if (distance <= 52) {
      if (!headerOpen) headerOpen = true
    } else if (distance >= 75) {
      if (headerOpen && !headerMouseOver) headerOpen = false
    }
  }

  onMount(() => {
    // el.addEventListener('draggable_start', onDragStart)
    el.addEventListener('draggable_move', onDragMove)
    el.addEventListener('draggable_end', handleDragEnd)
    el.addEventListener('resizable_end', updateCard)
    el.addEventListener('resizable_onMouseDown', handleResizeBegin)
    el.addEventListener('resizable_onMouseUp', handleResizeEnd)

    const unsubscribe = card.subscribe((c) => {
      magicFieldParticipant.updatePosition({
        x: c.x,
        y: c.y,
        width: c.width,
        height: c.height
      })
    })

    return () => {
      unsubscribe()
    }
  })

  onDestroy(() => {
    // el && el.addEventListener('draggable_start', onDragStart)
    el && el.addEventListener('draggable_move', onDragMove)
    el && el.removeEventListener('draggable_end', handleDragEnd)
    el && el.removeEventListener('resizable_end', updateCard)
    el && el.removeEventListener('resizable_onMouseDown', handleResizeBegin)
    el && el.removeEventListener('resizable_onMouseUp', handleResizeEnd)

    if (headerClickTimeout) {
      clearTimeout(headerClickTimeout)
      headerClickTimeout = null
    }

    if (dragOverTimeout) {
      clearTimeout(dragOverTimeout)
      dragOverTimeout = null
    }

    horizon.magicFieldService.removeParticipant(magicFieldParticipant.id)
  })
</script>

<svelte:window on:mousemove={handleMouseMove} />

<!-- TODO: Obacht! Had the issue on old Horizon app, that ids can start
  with numbers -> Cannot use them in css selctors for example. Maybe add `id-` prefix -->
<!-- style="{$visorEnabled ? 'scale: 0.5;' : ''}" -->
<Positionable
  {positionable}
  data-id={$positionable.id}
  class="card magic-{$magicFieldColorIdx} {$positionable.id} {$positionable.type} {$fieldParticipation?.supported
    ? 'magic-field-active'
    : ''} {!!$connectedField || (selfIsField && $activeField)
    ? 'magic-field-connected'
    : ''} {$fieldParticipation?.supported
    ? `magic-field-${$fieldParticipation.relativePosition}`
    : ''} {active ? 'active' : ''} {selected ? 'selected' : ''} {$positionable.dashHighlight ===
  true
    ? 'dash-highlight'
    : ''}"
  style="--magic-field-distance: {($fieldParticipation?.distance ?? 0) / 200}"
  contained={false}
  on:mousedown={handleMouseDown}
  on:dragenter={handleDragEnter}
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
  on:mouseleave={onHeaderMouseLeave}
  bind:el
>
  {#if !$visorEnabled}
    {#if !$focusModeEnabled || $card.focusStack}
      <Resizable {positionable} direction="top-right" {minSize} {maxSize} />
      <Resizable {positionable} direction="top-left" {minSize} {maxSize} />
      <Resizable {positionable} direction="bottom-right" {minSize} {maxSize} />
      <Resizable {positionable} direction="bottom-left" {minSize} {maxSize} />
      <Resizable {positionable} direction="top" {minSize} {maxSize} />
      <Resizable {positionable} direction="bottom" {minSize} {maxSize} />
      <Resizable {positionable} direction="left" {minSize} {maxSize} />
      <Resizable {positionable} direction="right" {minSize} {maxSize} />
    {/if}
    <div class="draggable-bar">
      <Draggable {positionable} />
    </div>

    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <!-- <div
        on:mousedown={handleCardHeaderMouseDown}
        class="card-header"
        data-position="top"
        data-inset={false}
        data-hide={false}
      >
        <Draggable {positionable} class="">
          <div class="card-header-content">
            <!-- <div class="card-title">{cardTitle}</div> --
            <div class="card-header-actions">
              <button on:click={handleDelete}>
                <Icon name="close" />
              </button>
              <!-- <button on:click={handleCopy}>
                <Icon name="copy" />
              </button> --
            </div>

            <!-- svelte-ignore a11y-no-static-element-interactions --
            <div class="card-drag-indicator">
              <div></div>
              <div></div>
              <div></div>
            </div>

            <div class="card-header-actions end-placement">
              {#if allowDuplicating}
                <button
                  use:tooltip={{ content: 'Create similar', action: 'hover' }}
                  on:click={handleDuplicate}
                >
                  <Icon name="add" />
                </button>
              {/if}
            </div>
          </div>
        </Draggable>
      </div>-->
    <div
      class="cardHeader"
      data-double={!allowDuplicating}
      class:closed={!headerOpen}
      on:mousedown={handleCardHeaderMouseDown}
    >
      <ul on:mouseenter={handleHeaderListMouseEnter} on:mouseleave={handleHeaderListMouseLeave}>
        <li>
          <button on:click={handleDelete}>
            <Icon name="close" color="currentColor" size="14px" />
          </button>
        </li>
        <li class:active={isDragging}>
          <Draggable {positionable}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 8H20"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M4 16H20"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </Draggable>
        </li>
        {#if allowDuplicating}
          <li>
            <button
              use:tooltip={{ content: 'Create similar', action: 'hover' }}
              on:click={handleDuplicate}
            >
              <Icon name="add" color="currentColor" size="14px" />
            </button>
          </li>
        {/if}
      </ul>
    </div>
  {:else}
    <button class="visor-delete" on:click|capture={handleDelete}>
      <Icon name="close" />
    </button>
  {/if}

  <!-- {#if !!$activeField && $fieldParticipation?.supported}
    <div on:click={handleMagicFieldConnect} class="connect-btn connect-edge-{$fieldParticipation.relativePosition}" style="--connect-distance: {$fieldParticipation.distance}px;">✨</div>
  {/if} -->

  <div class="content tela-ignore" style={$visorEnabled || !active ? 'pointer-events: none;' : ''}>
    <CardContent {positionable} {horizon} {magicFieldParticipant} on:load on:change on:delete />
  </div>
</Positionable>

<style lang="scss">
  .draggable-bar {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 10px;
    z-index: 299;
  }

  :global(.card) {
    .visor-delete {
      pointer-events: all;
      position: absolute;
      top: -18px;
      right: -18px;
      background: #eee;
      border: 2px solid #eee;
      z-index: 10;
      width: 36px;
      height: 36px;
      border-radius: 100%;
      padding: 4px;
      display: flex;
      justify-items: center;
      align-items: center;
      cursor: pointer;
      display: none;
    }
    &:hover .visor-delete {
      display: block;
    }
  }

  .card-header {
    position: absolute;
    z-index: 301;
    opacity: 0;

    &[data-position='right'],
    &[data-position='left'] {
      height: 90%;
      max-height: 200px;
      top: 50%;

      .card-header-content {
        flex-direction: column;
        height: 100%;
        padding: 8px 5px;
      }

      .card-header-actions {
        align-items: flex-start;
      }

      .end-placement {
        flex: 1;
        align-items: flex-end;
      }

      .card-drag-indicator {
        flex-grow: 1;
        display: flex;
        gap: 4px;

        div {
          background: #999999;
          height: 100%;
          width: 1px;
        }
      }
    }

    &[data-position='right'] {
      right: 30px;
      transform: translate(100%, -50%);

      .card-header-content {
        border-left: none;
        border-top-right-radius: var(--theme-border-radius);
        border-bottom-right-radius: var(--theme-border-radius);
      }
    }

    &[data-position='left'] {
      left: 30px;
      transform: translate(-100%, -50%);

      .card-header-content {
        border-right: none;
        border-top-left-radius: var(--theme-border-radius);
        border-bottom-left-radius: var(--theme-border-radius);
      }
    }

    &[data-position='top'],
    &[data-position='bottom'] {
      width: 90%;
      max-width: 200px;
      left: 50%;

      .card-header-content {
        width: 100%;
        padding: 5px 8px;
      }

      .card-header-actions {
        align-items: flex-end;
      }

      .end-placement {
        flex: 1;
        justify-content: flex-end;
      }

      .card-drag-indicator {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;

        div {
          background: #999999;
          height: 1px;
          width: 100%;
        }
      }
    }

    &[data-position='top'] {
      // top: 0;
      transform: translate(-50%, -100%);

      // .card-header-content {
      //   border-bottom: none;
      //   border-top-left-radius: var(--theme-border-radius);
      //   border-top-right-radius: var(--theme-border-radius);
      // }
    }

    &[data-position='bottom'] {
      bottom: 0;
      transform: translate(-50%, 100%);

      .card-header-content {
        border-top: none;
        border-bottom-left-radius: var(--theme-border-radius);
        border-bottom-right-radius: var(--theme-border-radius);
      }
    }

    &[data-position='top']:not([data-inset='true']) {
      top: 0;

      .card-header-content {
        border-top-left-radius: var(--theme-border-radius);
        border-top-right-radius: var(--theme-border-radius);
      }
    }

    &[data-position='top'][data-inset='true'] {
      top: 29px;

      .card-header-content {
        border-top: none;
        border-bottom-left-radius: var(--theme-border-radius);
        border-bottom-right-radius: var(--theme-border-radius);
      }
    }
  }

  .card-header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border: 2px solid #ddd;
    background-color: #f5f5f5;
    overflow: hidden;
  }

  :global(.draggable) {
    height: 100%;
  }

  :global(.card:hover),
  :global(.dragging) {
    .card-header:not([data-hide='true']) {
      display: block;
      opacity: 1;
      z-index: 100000;
      &[data-position='right'] {
        right: 0;
      }

      &[data-position='left'] {
        left: 0;
      }
    }
  }

  :global(.card:hover.active),
  :global(.dragging.active) {
    .card-header {
      &[data-position='top'] {
        z-index: 0;
      }

      .tela-board .resizable {
        z-index: 0;
      }
    }
  }

  .card-header-actions {
    flex: 1;
    display: flex;
    gap: 0.5rem;
    color: #979797;

    button {
      background: transparent;
      border: none;
      outline: none;
      cursor: pointer;
      padding: 0;
      margin: 0;
      color: inherit;
      display: flex;
      align-items: center;
      justify-content: center;

      &:hover {
        color: #7b7b7b;
      }
    }
  }

  .connect-btn {
    position: absolute;
    width: 5rem;
    height: 5rem;
    background: rgba(255, 127, 191);
    border: 2px solid rgba(255, 127, 191);
    border-radius: var(--theme-border-radius);
    z-index: 10000;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;

    --button-width: 3rem;
    --button-height: 3rem;
    --button-offset: calc(-1.5rem - (var(--connect-distance) / 2));
  }

  .connect-edge-left {
    top: 50%;
    left: var(--button-offset);
    transform: translate(0%, -50%);
    width: var(--button-width);
    height: var(--button-height);
  }

  .connect-edge-right {
    top: 50%;
    right: var(--button-offset);
    transform: translate(0%, -50%);
    width: var(--button-width);
    height: var(--button-height);
  }

  .connect-edge-top {
    top: var(--button-offset);
    left: 50%;
    transform: translate(-50%, 0%);
    width: var(--button-height);
    height: var(--button-width);
  }

  .connect-edge-bottom {
    bottom: var(--button-offset);
    left: 50%;
    transform: translate(-50%, 0%);
    width: var(--button-height);
    height: var(--button-width);
  }

  // .card-title {
  //   padding: 0 10px;
  //   white-space: nowrap;
  //   overflow: hidden;
  //   text-overflow: ellipsis;
  //   font-size: 0.9rem;
  // }
</style>
