import type { TabItem } from '@deta/services/tabs'
import type { VerticalTabDimensions, VerticalLayoutCalculation, TabLayoutConfig } from '../types'

const DEFAULT_VERTICAL_CONFIG: Required<
  Pick<
    TabLayoutConfig,
    | 'minTabHeight'
    | 'maxTabHeight'
    | 'tabVerticalPadding'
    | 'tabGap'
    | 'containerPadding'
    | 'addButtonWidth'
    | 'iconWidth'
  >
> = {
  minTabHeight: 32,
  maxTabHeight: 36,
  tabVerticalPadding: 12,
  tabGap: 4,
  containerPadding: 8,
  addButtonWidth: 40, // Height in vertical mode
  iconWidth: 16
}

/**
 * Measures container height for vertical tabs
 */
export function measureContainerHeight(containerElement: HTMLElement): number {
  return containerElement.offsetHeight
}

/**
 * Simplified vertical layout calculation - much easier than horizontal!
 * No complex collapsing/squishing logic needed since users can scroll
 */
export function calculateVerticalTabLayout(
  tabs: TabItem[],
  containerHeight: number,
  activeTabId: string | null = null
): VerticalLayoutCalculation {
  const cfg = DEFAULT_VERTICAL_CONFIG
  const addButtonHeight = cfg.addButtonWidth // Using width value as height for consistency

  // Calculate available space for tabs
  const gapsHeight = Math.max(0, tabs.length - 1) * cfg.tabGap
  const availableHeight = containerHeight - cfg.containerPadding - addButtonHeight - gapsHeight

  // Simple uniform height distribution - no complex logic needed!
  const uniformHeight = Math.max(
    cfg.minTabHeight,
    Math.min(cfg.maxTabHeight, availableHeight / tabs.length)
  )

  // All tabs get the same treatment in vertical mode - much simpler!
  const dimensions: VerticalTabDimensions[] = tabs.map(() => ({
    height: uniformHeight,
    showCloseButton: true // Always show close button - we have horizontal space
  }))

  const totalTabsHeight = dimensions.reduce((sum, d) => sum + d.height, 0)

  return {
    tabDimensions: dimensions,
    addButtonHeight,
    totalHeight: cfg.containerPadding + totalTabsHeight + gapsHeight + addButtonHeight
  }
}

/**
 * Get the default vertical tab height when no container measurement is available
 */
export function getDefaultVerticalTabHeight(): number {
  return DEFAULT_VERTICAL_CONFIG.minTabHeight
}

/**
 * Check if vertical tabs need scrolling based on container height
 */
export function needsVerticalScrolling(tabs: TabItem[], containerHeight: number): boolean {
  const cfg = DEFAULT_VERTICAL_CONFIG
  const minRequiredHeight =
    tabs.length * cfg.minTabHeight +
    Math.max(0, tabs.length - 1) * cfg.tabGap +
    cfg.containerPadding +
    cfg.addButtonWidth

  return minRequiredHeight > containerHeight
}
