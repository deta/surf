// Re-export from services
export { TabOrientation } from '@deta/services/tabs'
import type { TabOrientation } from '@deta/services/tabs'

export interface TabLayoutConfig {
  orientation: TabOrientation
  // Shared config
  tabGap: number
  containerPadding: number
  addButtonWidth: number
  iconWidth: number

  // Horizontal-specific (existing)
  minTabWidth?: number
  maxTabWidth?: number
  activeTabMinWidth?: number
  collapsedThreshold?: number
  squishedThreshold?: number
  tabHorizontalPadding?: number

  // Vertical-specific (new)
  minTabHeight?: number
  maxTabHeight?: number
  tabVerticalPadding?: number
}

// Simplified vertical tab dimensions (no collapsed/squished complexity)
export interface VerticalTabDimensions {
  height: number
  showCloseButton: boolean
}

export interface VerticalLayoutCalculation {
  tabDimensions: VerticalTabDimensions[]
  addButtonHeight: number
  totalHeight: number
}

// Re-export existing horizontal types for compatibility
export type { TabDimensions, LayoutCalculation } from './TabsList/tabsLayout.svelte'
