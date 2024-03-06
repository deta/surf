import { get, writable, type Writable } from 'svelte/store'
import type { Card } from '../types'
import { APP_BAR_WIDTH } from '../constants/horizon'

export const focusModeEnabled = writable(false)

// Stores array of cards used in focus mode, Set of ids that are active panes,
// and array of ids in order of pane layout (top left -> clockwise)
export const focusModeTargets = writable([[], []] as [Writable<Card>[], string[]])

const PANE_GAP = 10

/**
 * Applies focus mode layout to given cards
 * TODO: ViewPort can be extracted from board sveltecontext?
 */
export function applyFocusMode(
  viewOffset: { x: number; y: number },
  viewPort: { w: number; h: number },
  force = false
) {
  if (get(focusModeEnabled) && !force) return
  focusModeEnabled.set(true)

  const Z_OVERRIDE = 9000 // NOTE: This should be dynamicly extracted from all cards on active horizon but its fine for now
  let [cards, order] = get(focusModeTargets)
  cards.sort((a, b) => get(a).x - get(b).x)

  const AVAILABLE_WIDTH = viewPort.w - APP_BAR_WIDTH
  const AVAILABLE_HEIGHT = cards.length > 4 ? viewPort.h - 25 : viewPort.h

  // const used = cards.filter(e => order.includes(get(e).id)
  // if (used.length < 4) {

  // if (cards.length > 4) {
  //   const stack = cards.filter(e => !order.includes(get(e).id))
  // }

  let activePanes: string[] = [] // Store active panes here -> we know what to put on in the stack
  if (cards.length === 0) return
  else if (cards.length <= 1) {
    const pane = order[0] !== undefined ? cards.find((e) => get(e).id === order[0]) : cards[0]
    pane?.update((v) => {
      v.xOverride = viewOffset.x + APP_BAR_WIDTH
      v.yOverride = 0
      v.widthOverride = AVAILABLE_WIDTH
      v.heightOverride = AVAILABLE_HEIGHT
      v.zOverride = Z_OVERRIDE
      return v
    })
  } else if (cards.length <= 2) {
    const pane1 = order[0] !== undefined ? cards.find((e) => get(e).id === order[0]) : cards[0]
    const pane2 = order[1] !== undefined ? cards.find((e) => get(e).id === order[1]) : cards[1]
    pane1?.update((v) => {
      v.xOverride = viewOffset.x + APP_BAR_WIDTH
      v.yOverride = 0
      v.widthOverride = AVAILABLE_WIDTH / 2 - PANE_GAP / 2
      v.heightOverride = AVAILABLE_HEIGHT
      v.zOverride = Z_OVERRIDE
      return v
    })
    pane2?.update((v) => {
      v.xOverride = viewOffset.x + APP_BAR_WIDTH + AVAILABLE_WIDTH / 2 + PANE_GAP / 2
      v.yOverride = 0
      v.widthOverride = AVAILABLE_WIDTH / 2 - PANE_GAP / 2
      v.heightOverride = AVAILABLE_HEIGHT
      v.zOverride = Z_OVERRIDE
      return v
    })
  } else if (cards.length <= 3) {
    const pane1 = order[0] !== undefined ? cards.find((e) => get(e).id === order[0]) : cards[0]
    const pane2 = order[1] !== undefined ? cards.find((e) => get(e).id === order[1]) : cards[1]
    const pane3 = order[2] !== undefined ? cards.find((e) => get(e).id === order[2]) : cards[2]
    pane1?.update((v) => {
      v.xOverride = viewOffset.x + APP_BAR_WIDTH
      v.yOverride = 0
      v.widthOverride = AVAILABLE_WIDTH / 2 - PANE_GAP / 2
      v.heightOverride = AVAILABLE_HEIGHT
      v.zOverride = Z_OVERRIDE
      return v
    })
    pane2?.update((v) => {
      v.xOverride = viewOffset.x + APP_BAR_WIDTH + AVAILABLE_WIDTH / 2 + PANE_GAP / 2
      v.yOverride = 0
      v.widthOverride = AVAILABLE_WIDTH / 2 - PANE_GAP / 2
      v.heightOverride = AVAILABLE_HEIGHT / 2 - PANE_GAP / 2
      v.zOverride = Z_OVERRIDE
      return v
    })
    pane3?.update((v) => {
      v.xOverride = viewOffset.x + APP_BAR_WIDTH + AVAILABLE_WIDTH / 2 + PANE_GAP / 2
      v.yOverride = AVAILABLE_HEIGHT / 2 + PANE_GAP / 2
      v.widthOverride = AVAILABLE_WIDTH / 2 - PANE_GAP / 2
      v.heightOverride = AVAILABLE_HEIGHT / 2 - PANE_GAP / 2
      v.zOverride = Z_OVERRIDE
      return v
    })
  } else {
    const pane1 = order[0] !== undefined ? cards.find((e) => get(e).id === order[0]) : cards[0]
    const pane2 = order[1] !== undefined ? cards.find((e) => get(e).id === order[1]) : cards[1]
    const pane3 = order[2] !== undefined ? cards.find((e) => get(e).id === order[2]) : cards[2]
    const pane4 = order[3] !== undefined ? cards.find((e) => get(e).id === order[3]) : cards[3]
    activePanes = [get(pane1).id, get(pane2).id, get(pane3).id, get(pane4).id]
    pane1?.update((v) => {
      v.xOverride = viewOffset.x + APP_BAR_WIDTH
      v.yOverride = 0
      v.widthOverride = AVAILABLE_WIDTH / 2 - PANE_GAP / 2
      v.heightOverride = AVAILABLE_HEIGHT / 2 - PANE_GAP / 2
      v.zOverride = Z_OVERRIDE
      return v
    })
    pane2?.update((v) => {
      v.xOverride = viewOffset.x + APP_BAR_WIDTH + AVAILABLE_WIDTH / 2 + PANE_GAP / 2
      v.yOverride = 0
      v.widthOverride = AVAILABLE_WIDTH / 2 - PANE_GAP / 2
      v.heightOverride = AVAILABLE_HEIGHT / 2 - PANE_GAP / 2
      v.zOverride = Z_OVERRIDE
      return v
    })
    pane3?.update((v) => {
      v.xOverride = viewOffset.x + APP_BAR_WIDTH
      v.yOverride = AVAILABLE_HEIGHT / 2 + PANE_GAP / 2
      v.widthOverride = AVAILABLE_WIDTH / 2 - PANE_GAP / 2
      v.heightOverride = AVAILABLE_HEIGHT / 2 - PANE_GAP / 2
      v.zOverride = Z_OVERRIDE
      return v
    })
    pane4?.update((v) => {
      v.xOverride = viewOffset.x + APP_BAR_WIDTH + AVAILABLE_WIDTH / 2 + PANE_GAP / 2
      v.yOverride = AVAILABLE_HEIGHT / 2 + PANE_GAP / 2
      v.widthOverride = AVAILABLE_WIDTH / 2 - PANE_GAP / 2
      v.heightOverride = AVAILABLE_HEIGHT / 2 - PANE_GAP / 2
      v.zOverride = Z_OVERRIDE
      return v
    })
  }

  cards.forEach((e) => {
    e.update((v) => {
      v.focusStack = false
      v.dashHighlight = false
      return v
    })
  })
  if (cards.length > 4) {
    cards = cards.filter((e) => !activePanes.includes(get(e).id))
    for (let i = 0; i < cards.length; i++) {
      const STACK_CARD_WIDTH = 175
      const TOTAL_WIDTH = (STACK_CARD_WIDTH / 2) * cards.length
      const card = cards[i]
      card.update((v) => {
        v.xOverride =
          viewOffset.x +
          APP_BAR_WIDTH +
          viewPort.w / 2 -
          TOTAL_WIDTH / 2 +
          (i * STACK_CARD_WIDTH) / 3
        v.yOverride = viewPort.h - 15
        v.widthOverride = STACK_CARD_WIDTH
        v.heightOverride = 250
        v.zOverride = Z_OVERRIDE + 1 + i
        v.focusStack = true
        return v
      })
    }
  }
}

export function resetFocusMode() {
  if (!get(focusModeEnabled)) return
  focusModeEnabled.set(false)

  const [cards, order] = get(focusModeTargets)

  cards.forEach((c) => {
    c.update((v) => {
      v.xOverride = undefined
      v.yOverride = undefined
      v.widthOverride = undefined
      v.heightOverride = undefined
      v.zOverride = undefined
      v.focusStack = undefined
      v.dashHighlight = undefined
      return v
    })
  })

  focusModeTargets.set([[], []])
}

export function getCardOnPane(pane: number) {
  const [cards, order] = get(focusModeTargets)
  const t = cards.findIndex((e) => get(e).id === order[pane])
  return cards[t] || cards[pane]
}

// HELPERS

/**
 * Returns the pane id at given x and y coordinates for the 2x2 layout
 * @param x
 * @param y
 */
export function get2x2PaneAt(
  x: number,
  y: number,
  viewPort: { w: number; h: number; x: number; y: number }
): number | null {
  const { w, h, x: offsetX, y: offsetY } = viewPort
  const halfWidth = w / 2
  const halfHeight = h / 2
  if (x < halfWidth + offsetX) {
    if (y < halfHeight + offsetY) return 0
    else return 2
  } else {
    if (y < halfHeight + offsetY) return 1
    else return 3
  }
  return null
}
