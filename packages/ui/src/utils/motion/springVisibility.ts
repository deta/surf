// springVisibility.ts
import { spring, type Spring } from 'svelte/motion'
import type { SpringParams, SpringValues } from './types'

export function springVisibility(node: HTMLElement, params: SpringParams) {
  // Default configuration
  const defaults = {
    visible: true,
    y: 50,
    z: -120,
    scale: 0.9,
    stiffness: 0.15,
    damping: 0.45
  }

  // Merge defaults with provided params
  let config = { ...defaults, ...params }

  // Pre-compute transform strings for better performance
  const transformTemplate = (y: number, z: number, scale: number) =>
    `translateY(${y}px) translateZ(${z}px) scale(${scale})`

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
  node.style.backfaceVisibility = 'hidden' // Forces GPU acceleration
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
