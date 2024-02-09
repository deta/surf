/*
    MIT License

    Copyright (c) 2020 Skilitics

    Code from https://github.com/skilitics/two-fingers/blob/main/src/index.ts
*/

export * from './types'
import type { Coords, Gesture, GestureCallbacks, NormalizedWheelEvent } from './types'

const midpoint = ([t1, t2]: TouchList): Coords => ({
  x: (t1.clientX + t2.clientX) / 2,
  y: (t1.clientY + t2.clientY) / 2
})

const distance = ([t1, t2]: TouchList) => {
  const dx = t2.clientX - t1.clientX
  const dy = t2.clientY - t1.clientY

  return Math.sqrt(dx * dx + dy * dy)
}

const angle = ([t1, t2]: TouchList) => {
  const dx = t2.clientX - t1.clientX
  const dy = t2.clientY - t1.clientY

  return (180 / Math.PI) * Math.atan2(dy, dx)
}

export const clientToHTMLElementCoords = (element: HTMLDivElement, coords: Coords): Coords => {
  const rect = element.getBoundingClientRect()

  return {
    x: coords.x - rect.x,
    y: coords.y - rect.y
  }
}

export const clientToSVGElementCoords = (el: SVGSVGElement, coords: Coords): Coords | undefined => {
  const element: SVGSVGElement = el.ownerSVGElement ?? el
  const coordinateTransformMatrix = element.getScreenCTM()

  if (!coordinateTransformMatrix) return

  const screenToElement = coordinateTransformMatrix.inverse()
  const point = element.createSVGPoint()

  point.x = coords.x
  point.y = coords.y

  return point.matrixTransform(screenToElement)
}

function limit(delta: number, max_delta: number) {
  return Math.sign(delta) * Math.min(max_delta, Math.abs(delta))
}

function normalizeWheel(e: WheelEvent) {
  const DELTA_LINE_MULTIPLIER = 8
  const DELTA_PAGE_MULTIPLIER = 24
  const MAX_WHEEL_DELTA = 24

  let dx = e.deltaX
  let dy = e.deltaY

  if (e.shiftKey && dx === 0) {
    ;[dx, dy] = [dy, dx]
  }

  if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    dx *= DELTA_LINE_MULTIPLIER
    dy *= DELTA_LINE_MULTIPLIER
  } else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    dx *= DELTA_PAGE_MULTIPLIER
    dy *= DELTA_PAGE_MULTIPLIER
  }
  return {
    dx: limit(dx, MAX_WHEEL_DELTA),
    dy: limit(dy, MAX_WHEEL_DELTA)
  }
}

export const twoFingers = (
  container: Element,
  { onGestureStart, onGestureChange, onGestureEnd }: GestureCallbacks = {},
  normalizeWheelEvent: (event: WheelEvent) => NormalizedWheelEvent = normalizeWheel
): (() => void) => {
  // TODO: we shouldn't be reusing gesture
  let gesture: Gesture | undefined = undefined
  let timer: number

  const wheelListener = (event: Event) => {
    if (!(event instanceof WheelEvent)) {
      console.error('Expected WheelEvent, got', event)
      return
    }

    // event.preventDefault();

    const { dx, dy } = normalizeWheelEvent(event)

    if (!gesture) {
      gesture = {
        scale: 1,
        translation: { x: 0, y: 0 },
        origin: { x: event.clientX, y: event.clientY },
        shiftKey: event.shiftKey
      }
      onGestureStart?.(gesture)
    } else {
      gesture = {
        origin: { x: event.clientX, y: event.clientY },
        scale: event.ctrlKey ? gesture.scale * (1 - dy / 100) : 1,
        translation: !event.ctrlKey
          ? {
              x: gesture.translation.x - dx,
              y: gesture.translation.y - dy
            }
          : { x: 0, y: 0 },
        shiftKey: event.shiftKey
      }

      onGestureChange?.(gesture)
    }

    if (timer) {
      window.clearTimeout(timer)
    }

    timer = window.setTimeout(() => {
      if (gesture) {
        onGestureEnd?.(gesture)
        gesture = undefined
      }
    }, 20)
  }

  let initialTouches: TouchList

  const touchMove = (e: Event) => {
    if (!(e instanceof TouchEvent)) return

    if (e.touches.length === 2) {
      const initialMidpoint = midpoint(initialTouches)
      const currentMidpoint = midpoint(e.touches)

      gesture = {
        scale: e.scale !== undefined ? e.scale : distance(e.touches) / distance(initialTouches),
        rotation: e.rotation !== undefined ? e.rotation : angle(e.touches) - angle(initialTouches),
        translation: {
          x: currentMidpoint.x - initialMidpoint.x,
          y: currentMidpoint.y - initialMidpoint.y
        },
        origin: initialMidpoint,
        shiftKey: e.shiftKey
      }

      onGestureChange?.(gesture)
      e.preventDefault()
    }
  }

  const watchTouches = (e: Event) => {
    if (!(e instanceof TouchEvent)) return

    if (e.touches.length === 2) {
      initialTouches = e.touches
      gesture = {
        scale: 1,
        rotation: 0,
        translation: { x: 0, y: 0 },
        origin: midpoint(initialTouches),
        shiftKey: e.shiftKey
      }

      /*
				All the other events using `watchTouches` are passive,
				we don't need to call preventDefault().
			 */
      if (e.type === 'touchstart') {
        e.preventDefault()
      }

      onGestureStart?.(gesture)
      container.addEventListener('touchmove', touchMove, { passive: false })
      container.addEventListener('touchend', watchTouches)
      container.addEventListener('touchcancel', watchTouches)
    } else if (gesture) {
      onGestureEnd?.(gesture)
      gesture = undefined
      container.removeEventListener('touchmove', touchMove)
      container.removeEventListener('touchend', watchTouches)
      container.removeEventListener('touchcancel', watchTouches)
    }
  }

  container.addEventListener('wheel', wheelListener, { passive: false })
  container.addEventListener('touchstart', watchTouches, { passive: false })

  /*
    GestureEvent handling - Safari only
  */

  const handleGestureStart = ({
    clientX,
    clientY,
    rotation,
    scale,
    preventDefault
  }: GestureEvent) => {
    onGestureStart?.({
      translation: { x: 0, y: 0 },
      scale,
      rotation,
      origin: { x: clientX, y: clientY },
      shiftKey: false
    })

    preventDefault()
  }

  const handleGestureChange = ({
    clientX,
    clientY,
    rotation,
    scale,
    preventDefault
  }: GestureEvent) => {
    onGestureChange?.({
      translation: { x: 0, y: 0 },
      scale,
      rotation,
      origin: { x: clientX, y: clientY },
      shiftKey: false
    })

    preventDefault()
  }

  const handleGestureEnd = ({ clientX, clientY, rotation, scale }: GestureEvent) => {
    onGestureEnd?.({
      translation: { x: 0, y: 0 },
      scale,
      rotation,
      origin: { x: clientX, y: clientY },
      shiftKey: false
    })
  }

  if (typeof window.GestureEvent !== 'undefined' && typeof window.TouchEvent === 'undefined') {
    container.addEventListener('gesturestart', handleGestureStart, { passive: false })
    container.addEventListener('gesturechange', handleGestureChange, { passive: false })
    container.addEventListener('gestureend', handleGestureEnd)
  }

  return () => {
    container.removeEventListener('wheel', wheelListener)
    container.removeEventListener('touchstart', watchTouches)

    if (typeof window.GestureEvent !== 'undefined' && typeof window.TouchEvent === 'undefined') {
      container.removeEventListener('gesturestart', handleGestureStart)
      container.removeEventListener('gesturechange', handleGestureChange)
      container.removeEventListener('gestureend', handleGestureEnd)
    }
  }
}
