import { useLogScope } from '@horizon/utils'
import { get, writable, type Readable } from 'svelte/store'

const log = useLogScope('History Swipe Recognizer')

export const MIN_MAGNITUDE = 50
export const SWIPE_THRESHOLD = 150
export const MAX_ANGLE_DEVIATION = Math.PI / 12

export const createHistorySwipeRecognizer = (
  canGoBack: Readable<boolean>,
  canGoForward: Readable<boolean>,
  onSwipeLeft: () => void,
  onSwipeRight: () => void
) => {
  let accumulatedDelta = { x: 0, y: 0 }
  let isScrolling = false
  const swipeDirection = writable<'left' | 'right' | null>(null)
  const swipeProgress = writable(0)

  const resetState = () => {
    swipeDirection.set(null)
    swipeProgress.set(0)
    accumulatedDelta = { x: 0, y: 0 }
  }

  const handleTrackpadScrollStart = () => {
    log.debug('handle trackpad scroll began')
    resetState()
    isScrolling = true
  }

  const handleTrackpadScrollStop = () => {
    log.debug('handle trackpad scroll ended')
    isScrolling = false

    const currentProgress = get(swipeProgress)
    const currentDirection = get(swipeDirection)

    if (currentProgress > SWIPE_THRESHOLD / 2) {
      if (currentDirection === 'left' && get(canGoForward)) {
        onSwipeLeft()
      } else if (currentDirection === 'right' && get(canGoBack)) {
        onSwipeRight()
      }
    }

    resetState()
  }

  const tick = (event: { deltaX: number; deltaY: number }) => {
    if (!isScrolling) return

    accumulatedDelta.x += event.deltaX
    accumulatedDelta.y += event.deltaY

    const magnitude = Math.hypot(accumulatedDelta.x, accumulatedDelta.y)
    if (magnitude < MIN_MAGNITUDE) {
      return
    }

    const angle = Math.atan2(Math.abs(accumulatedDelta.y), Math.abs(accumulatedDelta.x))
    if (angle > MAX_ANGLE_DEVIATION) {
      resetState()
      return
    }

    const progress = Math.max(0, Math.min(magnitude - MIN_MAGNITUDE, SWIPE_THRESHOLD))
    swipeProgress.set(progress)

    const direction = accumulatedDelta.x > 0 ? 'left' : 'right'
    const newDirection =
      direction === 'left' ? (get(canGoForward) ? 'left' : null) : get(canGoBack) ? 'right' : null

    swipeDirection.set(newDirection)

    if (!newDirection) resetState()
  }

  return {
    handleTrackpadScrollStart,
    handleTrackpadScrollStop,
    tick,
    swipeDirection,
    swipeProgress
  }
}
