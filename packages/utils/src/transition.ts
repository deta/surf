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
