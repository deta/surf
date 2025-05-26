import { cubicOut } from 'svelte/easing'
import type { TransitionConfig } from 'svelte/transition'

type FlyAndScaleParams = {
  y?: number
  x?: number
  start?: number
  duration?: number
  delay?: number
}

export const flyAndScale = (node: Element, params: FlyAndScaleParams = {}): TransitionConfig => {
  const fullParams = Object.assign({ y: -8, x: 0, start: 0.95, duration: 150, delay: 0 }, params)
  const style = getComputedStyle(node)
  const transform = style.transform === 'none' ? '' : style.transform
  const scaleConversion = (valueA: number, scaleA: [number, number], scaleB: [number, number]) => {
    const [minA, maxA] = scaleA
    const [minB, maxB] = scaleB
    const percentage = (valueA - minA) / (maxA - minA)
    const valueB = percentage * (maxB - minB) + minB
    return valueB
  }
  const styleToString = (style: Record<string, number | string | undefined>): string => {
    return Object.keys(style).reduce((str, key) => {
      if (style[key] === undefined) return str
      return str + `${key}:${style[key]};`
    }, '')
  }
  return {
    duration: fullParams.duration,
    delay: fullParams.delay,
    css: (t) => {
      const y = scaleConversion(t, [0, 1], [fullParams.y, 0])
      const x = scaleConversion(t, [0, 1], [fullParams.x, 0])
      const scale = scaleConversion(t, [0, 1], [fullParams.start, 1])
      return styleToString({
        transform: `${transform} translate3d(${x}px, ${y}px, 0) scale(${scale})`,
        opacity: t
      })
    },
    easing: cubicOut
  }
}

// New directional variant that matches the original API
type FlyAndScaleDirectionalParams = FlyAndScaleParams & {
  side?: 'top' | 'right' | 'bottom' | 'left'
}

export const flyAndScaleDirectional = (
  node: Element,
  params: FlyAndScaleDirectionalParams = {}
): TransitionConfig => {
  // Default parameters
  const fullParams = Object.assign(
    { y: 0, x: 0, start: 0.95, duration: 150, delay: 0, side: 'bottom' },
    params
  )

  // Determine direction based on side
  let actualX = fullParams.x
  let actualY = fullParams.y

  // Override x/y based on side to create the opposite direction effect
  switch (fullParams.side) {
    case 'top':
      actualY = 5 // Menu appears at top, animate from bottom
      break
    case 'bottom':
      actualY = -5 // Menu appears at bottom, animate from top
      break
    case 'left':
      actualX = 5 // Menu appears at left, animate from right
      break
    case 'right':
      actualX = -5 // Menu appears at right, animate from left
      break
  }

  // Use the original helpers for consistency
  const style = getComputedStyle(node)
  const transform = style.transform === 'none' ? '' : style.transform

  const scaleConversion = (valueA: number, scaleA: [number, number], scaleB: [number, number]) => {
    const [minA, maxA] = scaleA
    const [minB, maxB] = scaleB
    const percentage = (valueA - minA) / (maxA - minA)
    const valueB = percentage * (maxB - minB) + minB
    return valueB
  }

  const styleToString = (style: Record<string, number | string | undefined>): string => {
    return Object.keys(style).reduce((str, key) => {
      if (style[key] === undefined) return str
      return str + `${key}:${style[key]};`
    }, '')
  }

  return {
    duration: fullParams.duration,
    delay: fullParams.delay,
    css: (t) => {
      const y = scaleConversion(t, [0, 1], [actualY, 0])
      const x = scaleConversion(t, [0, 1], [actualX, 0])
      const scale = scaleConversion(t, [0, 1], [fullParams.start, 1])
      return styleToString({
        transform: `${transform} translate3d(${x}px, ${y}px, 0) scale(${scale})`,
        opacity: t
      })
    },
    easing: cubicOut
  }
}
