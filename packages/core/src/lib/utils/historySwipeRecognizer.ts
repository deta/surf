import { useLogScope } from '@horizon/utils'
import { get, writable, type Readable } from 'svelte/store'

export const MIN_MAGNITUDE = 50
export const SWIPE_THRESHOLD = 200
export const MAX_ANGLE_DEVIATION = (5 * Math.PI) / 36 // 25 degrees

const log = useLogScope('History Swipe Recognizer')

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

    swipeProgress.update((progress) => {
      if (progress > SWIPE_THRESHOLD / 2) {
        swipeDirection.update((direction) => {
          if (direction === 'left' && get(canGoForward)) {
            onSwipeLeft()
          } else if (direction === 'right' && get(canGoBack)) {
            onSwipeRight()
          }
          return direction
        })
      }
      return 0
    })
    resetState()
  }

  const tick = (event: { deltaX: number; deltaY: number }) => {
    if (!isScrolling) return

    log.debug(get(swipeDirection), get(swipeProgress), accumulatedDelta)
    accumulatedDelta.x += event.deltaX
    accumulatedDelta.y += event.deltaY

    const angle = Math.atan2(Math.abs(accumulatedDelta.y), Math.abs(accumulatedDelta.x))
    if (angle > MAX_ANGLE_DEVIATION) {
      resetState()
      return
    }

    const magnitude = Math.hypot(accumulatedDelta.x, accumulatedDelta.y)
    swipeProgress.set(Math.min(magnitude, SWIPE_THRESHOLD))
    swipeDirection.set(
      accumulatedDelta.x > 0 ? (get(canGoForward) ? 'left' : null) : get(canGoBack) ? 'right' : null
    )

    if (!get(swipeDirection)) resetState()
  }

  return {
    handleTrackpadScrollStart,
    handleTrackpadScrollStop,
    tick,
    swipeDirection,
    swipeProgress
  }
}
