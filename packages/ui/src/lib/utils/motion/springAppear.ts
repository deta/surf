// springVisibility.ts
import { spring, type Spring } from 'svelte/motion'
import type { SpringParams, SpringValues } from './types'

export function springAppear(node: HTMLElement, params: SpringParams) {
  // Default configuration
  const defaults = {
    visible: true,
    y: 50,
    z: -120,
    scale: 0.98,
    stiffness: 0.1,
    damping: 0.4
  }

  // Merge defaults with provided params
  let config = { ...defaults, ...params }

  // Pre-compute transform strings for better performance
  const transformTemplate = (y: number, z: number, scale: number) =>
    `translateY(${y}px) scale(${scale})`

  // Cache the display check
  let isDisplayNone = false

  // Create spring store
  const springStore: Spring<SpringValues> = spring(
    {
      y: config.visible ? 0 : config.y,
      z: config.visible ? 0 : config.z,
      scale: config.visible ? 1 : config.scale
    },
    {
      stiffness: config.stiffness,
      damping: config.damping
    }
  )

  // Add will-change properties once at initialization
  node.style.willChange = 'transform, opacity'
  node.style.backfaceVisibility = 'hidden'
  node.style.transition = 'opacity 60ms linear'

  // Subscribe to spring store changes and update element style
  const unsubscribe = springStore.subscribe(($spring) => {
    node.style.transform = transformTemplate($spring.y, $spring.z, $spring.scale)
    node.style.opacity = config.visible ? '1' : '0'

    // Only update display if it needs to change
    const shouldBeNone = !config.visible && $spring.scale === config.scale
    if (shouldBeNone !== isDisplayNone) {
      node.style.display = shouldBeNone ? 'none' : ''
      isDisplayNone = shouldBeNone
    }
  })

  return {
    update(newParams: SpringParams) {
      // Update configuration
      config = { ...defaults, ...newParams }

      // Only update display if becoming visible
      if (config.visible && isDisplayNone) {
        node.style.display = ''
        isDisplayNone = false
      }

      // Update spring target values
      springStore.set(
        {
          y: config.visible ? 0 : config.y,
          z: config.visible ? 0 : config.z,
          scale: config.visible ? 1 : config.scale
        },
        {
          hard: false,
          soft: false
        }
      )
    },

    destroy() {
      unsubscribe()
    }
  }
}
