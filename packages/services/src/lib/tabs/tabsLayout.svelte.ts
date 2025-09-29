import { writable } from 'svelte/store'
import { ConfigService } from '../config'

export enum TabOrientation {
  Horizontal = 'horizontal',
  Vertical = 'vertical'
}

/**
 * Global state for tab orientation
 * Can be controlled via settings, user preference, or programmatically
 */
export const tabOrientation = writable<TabOrientation>(TabOrientation.Vertical)

/**
 * Toggle between horizontal and vertical tab orientations
 */
export async function toggleTabOrientation() {
  const newOrientation =
    getTabOrientation() === TabOrientation.Horizontal
      ? TabOrientation.Vertical
      : TabOrientation.Horizontal

  tabOrientation.set(newOrientation)

  // Save to user config
  const config = ConfigService.use()
  await config.updateSettings({
    tabs_orientation: newOrientation
  })
}

/**
 * Set specific tab orientation
 */
export async function setTabOrientation(orientation: TabOrientation) {
  tabOrientation.set(orientation)

  // Save to user config
  const config = ConfigService.use()
  await config.updateSettings({
    tabs_orientation: orientation
  })
}

/**
 * Initialize tab orientation from user config
 */
export function initializeTabOrientation() {
  const config = ConfigService.use()
  const settings = config.getSettings()

  if (settings.tabs_orientation) {
    tabOrientation.set(
      settings.tabs_orientation === 'horizontal'
        ? TabOrientation.Horizontal
        : TabOrientation.Vertical
    )
  }
}

/**
 * Get current tab orientation value (non-reactive)
 */
export function getTabOrientation(): TabOrientation {
  let current: TabOrientation
  tabOrientation.subscribe((value) => (current = value))()
  return current!
}
