import type { TabItem } from '@deta/services'

export interface TabDimensions {
  width: number
  collapsed: boolean
  squished: boolean
  showCloseButton: boolean
}

export interface LayoutCalculation {
  tabDimensions: TabDimensions[]
  addButtonWidth: number
  totalWidth: number
}

export interface TabLayoutConfig {
  minTabWidth: number
  maxTabWidth: number
  activeTabMinWidth: number
  collapsedThreshold: number
  squishedThreshold: number
  tabGap: number
  containerPadding: number
  addButtonWidth: number
  iconWidth: number
  tabHorizontalPadding: number
}

const DEFAULT_CONFIG: TabLayoutConfig = {
  minTabWidth: 92,
  maxTabWidth: 220,
  activeTabMinWidth: 200,
  collapsedThreshold: 64,
  squishedThreshold: 40, // Even more compressed than collapsed
  tabGap: 6,
  containerPadding: 80,
  addButtonWidth: 52,
  iconWidth: 16,
  tabHorizontalPadding: 24
}

/**
 * Measures container width accounting for parent padding
 */
export function measureContainerWidth(containerElement: HTMLElement): number {
  // Get the parent container (.tabs) to account for its padding
  const parentElement = containerElement.parentElement
  if (parentElement) {
    const parentStyle = getComputedStyle(parentElement)
    const parentPaddingLeft = parseFloat(parentStyle.paddingLeft) || 0
    const parentPaddingRight = parseFloat(parentStyle.paddingRight) || 0
    const parentWidth = parentElement.clientWidth

    // Available width is parent width minus its padding
    return parentWidth - parentPaddingLeft - parentPaddingRight
  } else {
    // Fallback to element's own width
    return containerElement.offsetWidth
  }
}

/**
 * Main layout calculation function
 */
export function calculateTabLayout(
  tabs: TabItem[],
  containerWidth: number,
  activeTabId: string | null = null
): LayoutCalculation {
  const cfg = DEFAULT_CONFIG
  const addButtonWidth = cfg.addButtonWidth

  // 1) Compute available space for tabs
  const gapsWidth = Math.max(0, tabs.length - 1) * cfg.tabGap
  const availableWidth = containerWidth - cfg.containerPadding - addButtonWidth - gapsWidth

  // Not enough space for anything meaningful — collapse all
  if (availableWidth <= 0) {
    return minimalCollapsedLayout(tabs.length, addButtonWidth, containerWidth)
  }

  // 2) Try uniform layout first (all tabs same width)
  const uniformWidth = Math.min(availableWidth / tabs.length, cfg.maxTabWidth)
  const canUseUniform = uniformWidth >= cfg.collapsedThreshold
  if (canUseUniform) {
    return uniformLayout(tabs.length, uniformWidth, addButtonWidth, gapsWidth)
  }

  // 3) Tight space — allocate for active tabs first, then distribute remainder
  const collapsedWidth = cfg.iconWidth + cfg.tabHorizontalPadding
  const squishedWidth = cfg.squishedThreshold
  let remainingWidth = availableWidth
  const dimensions: TabDimensions[] = []

  const activeIndices = tabs
    .map((t, i) => ({ t, i }))
    .filter((x) => x.t.id === activeTabId)
    .map((x) => x.i)
  const nonActiveIndices = tabs
    .map((t, i) => ({ t, i }))
    .filter((x) => x.t.id !== activeTabId)
    .map((x) => x.i)

  // Reserve space for active tabs (enforce minimum width for close button visibility)
  if (activeIndices.length > 0) {
    const minForNonActive = collapsedWidth * nonActiveIndices.length
    const availableForActive = Math.max(
      collapsedWidth * activeIndices.length,
      availableWidth - minForNonActive
    )

    const perActiveTarget = availableForActive / activeIndices.length
    for (const idx of activeIndices) {
      const minActiveWidth = Math.max(cfg.collapsedThreshold + 20, 112)
      const width = Math.max(
        minActiveWidth,
        Math.min(cfg.maxTabWidth, Math.min(cfg.activeTabMinWidth, perActiveTarget))
      )
      const isSquished = width <= cfg.squishedThreshold
      const isCollapsed = width <= cfg.collapsedThreshold && !isSquished
      dimensions[idx] = {
        width,
        collapsed: isCollapsed,
        squished: isSquished,
        showCloseButton: true
      }
      remainingWidth -= width
    }
  }

  // Distribute remaining space to non-active tabs
  if (remainingWidth > 0 && nonActiveIndices.length > 0) {
    const perNonActive = remainingWidth / nonActiveIndices.length
    for (const idx of nonActiveIndices) {
      if (perNonActive >= cfg.collapsedThreshold) {
        const width = Math.min(perNonActive, cfg.maxTabWidth)
        dimensions[idx] = { width, collapsed: false, squished: false, showCloseButton: false }
      } else if (perNonActive >= cfg.squishedThreshold) {
        const width = Math.max(collapsedWidth, perNonActive)
        dimensions[idx] = { width, collapsed: true, squished: false, showCloseButton: false }
      } else {
        const width = Math.max(squishedWidth, perNonActive)
        dimensions[idx] = { width, collapsed: false, squished: true, showCloseButton: false }
      }
    }
  } else {
    // No space left — squish all non-active tabs if extremely cramped
    for (const idx of nonActiveIndices) {
      if (availableWidth / tabs.length < cfg.squishedThreshold) {
        dimensions[idx] = {
          width: squishedWidth,
          collapsed: false,
          squished: true,
          showCloseButton: false
        }
      } else {
        dimensions[idx] = {
          width: collapsedWidth,
          collapsed: true,
          squished: false,
          showCloseButton: false
        }
      }
    }
  }

  const totalTabsWidth = dimensions.reduce((sum, d) => sum + d.width, 0)
  return {
    tabDimensions: dimensions,
    addButtonWidth,
    totalWidth: cfg.containerPadding + totalTabsWidth + gapsWidth + addButtonWidth
  }
}

// ===== helpers =====
function minimalCollapsedLayout(
  count: number,
  addButtonWidth: number,
  containerWidth: number
): LayoutCalculation {
  return {
    tabDimensions: Array.from({ length: count }, () => ({
      width: DEFAULT_CONFIG.minTabWidth,
      collapsed: true,
      squished: false,
      showCloseButton: false
    })),
    addButtonWidth,
    totalWidth: containerWidth
  }
}

function uniformLayout(
  count: number,
  tabWidth: number,
  addButtonWidth: number,
  gapsWidth: number
): LayoutCalculation {
  return {
    tabDimensions: Array.from({ length: count }, () => ({
      width: tabWidth,
      collapsed: false,
      squished: false,
      showCloseButton: true
    })),
    addButtonWidth,
    totalWidth: DEFAULT_CONFIG.containerPadding + tabWidth * count + gapsWidth + addButtonWidth
  }
}
