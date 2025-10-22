import type { TabItem } from '@deta/services'

export interface TabDimensions {
  width: number
  collapsed: boolean
  squished: boolean
  showCloseButton: boolean
  pinned: boolean
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
  containerPadding: 0,
  addButtonWidth: 52,
  iconWidth: 16,
  tabHorizontalPadding: 24
}

const PINNED_TAB_WIDTH = 40

/**
 * Measures container width accounting for parent padding
 */
export function measureContainerWidth(containerElement: HTMLElement): number {
  return containerElement.offsetWidth
  // Get the parent container (.tabs) to account for its padding
  //const parentElement = containerElement.parentElement
  //if (parentElement) {
  //  const parentStyle = getComputedStyle(parentElement)
  //  const parentPaddingLeft = parseFloat(parentStyle.paddingLeft) || 0
  //  const parentPaddingRight = parseFloat(parentStyle.paddingRight) || 0
  //  const parentWidth = parentElement.clientWidth

  //  // Available width is parent width minus its padding
  //  return parentWidth - parentPaddingLeft - parentPaddingRight
  //} else {
  //  // Fallback to element's own width
  //  return containerElement.offsetWidth
  //}
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

  // Separate pinned and unpinned tabs
  const pinnedTabs = tabs.filter((tab) => tab.pinned)
  const unpinnedTabs = tabs.filter((tab) => !tab.pinned)

  // Calculate space used by pinned tabs
  const pinnedTabsWidth = pinnedTabs.length * PINNED_TAB_WIDTH
  const pinnedTabsGaps = pinnedTabs.length > 0 ? (pinnedTabs.length - 1) * cfg.tabGap : 0

  // Calculate available space for unpinned tabs
  const unpinnedTabsGaps = unpinnedTabs.length > 0 ? (unpinnedTabs.length - 1) * cfg.tabGap : 0
  const totalGaps =
    pinnedTabsGaps +
    unpinnedTabsGaps +
    (pinnedTabs.length > 0 && unpinnedTabs.length > 0 ? cfg.tabGap : 0)
  const availableForUnpinned =
    containerWidth - cfg.containerPadding - addButtonWidth - pinnedTabsWidth - totalGaps

  // Create dimensions array with correct length
  const dimensions: TabDimensions[] = new Array(tabs.length)

  // Set dimensions for pinned tabs (fixed width)
  let pinnedIndex = 0
  for (let i = 0; i < tabs.length; i++) {
    if (tabs[i].pinned) {
      dimensions[i] = {
        width: PINNED_TAB_WIDTH,
        collapsed: false,
        squished: false,
        showCloseButton: false,
        pinned: true
      }
      pinnedIndex++
    }
  }

  // Handle unpinned tabs
  if (unpinnedTabs.length === 0) {
    // Only pinned tabs
    const totalTabsWidth = dimensions.reduce((sum, d) => sum + d.width, 0)
    return {
      tabDimensions: dimensions,
      addButtonWidth,
      totalWidth: cfg.containerPadding + totalTabsWidth + totalGaps + addButtonWidth
    }
  }

  // Not enough space for unpinned tabs — collapse all
  if (availableForUnpinned <= 0) {
    for (let i = 0; i < tabs.length; i++) {
      if (!tabs[i].pinned) {
        dimensions[i] = {
          width: cfg.minTabWidth,
          collapsed: true,
          squished: false,
          showCloseButton: false,
          pinned: false
        }
      }
    }
    const totalTabsWidth = dimensions.reduce((sum, d) => sum + d.width, 0)
    return {
      tabDimensions: dimensions,
      addButtonWidth,
      totalWidth: containerWidth
    }
  }

  // Try uniform layout for unpinned tabs
  const uniformWidth = Math.min(availableForUnpinned / unpinnedTabs.length, cfg.maxTabWidth)
  const canUseUniform = uniformWidth >= cfg.collapsedThreshold
  if (canUseUniform) {
    for (let i = 0; i < tabs.length; i++) {
      if (!tabs[i].pinned) {
        dimensions[i] = {
          width: uniformWidth,
          collapsed: false,
          squished: false,
          showCloseButton: true,
          pinned: false
        }
      }
    }
    const totalTabsWidth = dimensions.reduce((sum, d) => sum + d.width, 0)
    return {
      tabDimensions: dimensions,
      addButtonWidth,
      totalWidth: cfg.containerPadding + totalTabsWidth + totalGaps + addButtonWidth
    }
  }

  // Tight space — allocate for active unpinned tabs first
  const collapsedWidth = cfg.iconWidth + cfg.tabHorizontalPadding
  const squishedWidth = cfg.squishedThreshold
  let remainingWidth = availableForUnpinned

  const activeUnpinnedIndices = tabs
    .map((t, i) => ({ t, i }))
    .filter((x) => x.t.id === activeTabId && !x.t.pinned)
    .map((x) => x.i)
  const nonActiveUnpinnedIndices = tabs
    .map((t, i) => ({ t, i }))
    .filter((x) => x.t.id !== activeTabId && !x.t.pinned)
    .map((x) => x.i)

  // Reserve space for active unpinned tabs
  if (activeUnpinnedIndices.length > 0) {
    const minForNonActive = collapsedWidth * nonActiveUnpinnedIndices.length
    const availableForActive = Math.max(
      collapsedWidth * activeUnpinnedIndices.length,
      remainingWidth - minForNonActive
    )

    const perActiveTarget = availableForActive / activeUnpinnedIndices.length
    for (const idx of activeUnpinnedIndices) {
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
        showCloseButton: true,
        pinned: false
      }
      remainingWidth -= width
    }
  }

  // Distribute remaining space to non-active unpinned tabs
  if (remainingWidth > 0 && nonActiveUnpinnedIndices.length > 0) {
    const perNonActive = remainingWidth / nonActiveUnpinnedIndices.length
    for (const idx of nonActiveUnpinnedIndices) {
      if (perNonActive >= cfg.collapsedThreshold) {
        const width = Math.min(perNonActive, cfg.maxTabWidth)
        dimensions[idx] = {
          width,
          collapsed: false,
          squished: false,
          showCloseButton: false,
          pinned: false
        }
      } else if (perNonActive >= cfg.squishedThreshold) {
        const width = Math.max(collapsedWidth, perNonActive)
        dimensions[idx] = {
          width,
          collapsed: true,
          squished: false,
          showCloseButton: false,
          pinned: false
        }
      } else {
        const width = Math.max(squishedWidth, perNonActive)
        dimensions[idx] = {
          width,
          collapsed: false,
          squished: true,
          showCloseButton: false,
          pinned: false
        }
      }
    }
  } else {
    // No space left — squish all non-active unpinned tabs
    for (const idx of nonActiveUnpinnedIndices) {
      if (availableForUnpinned / unpinnedTabs.length < cfg.squishedThreshold) {
        dimensions[idx] = {
          width: squishedWidth,
          collapsed: false,
          squished: true,
          showCloseButton: false,
          pinned: false
        }
      } else {
        dimensions[idx] = {
          width: collapsedWidth,
          collapsed: true,
          squished: false,
          showCloseButton: false,
          pinned: false
        }
      }
    }
  }

  const totalTabsWidth = dimensions.reduce((sum, d) => sum + d.width, 0)
  return {
    tabDimensions: dimensions,
    addButtonWidth,
    totalWidth: cfg.containerPadding + totalTabsWidth + totalGaps + addButtonWidth
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
      showCloseButton: false,
      pinned: false
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
      showCloseButton: true,
      pinned: false
    })),
    addButtonWidth,
    totalWidth: DEFAULT_CONFIG.containerPadding + tabWidth * count + gapsWidth + addButtonWidth
  }
}
