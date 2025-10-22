import { type DragculaDragEvent } from '@deta/dragcula'
import { type TabsService, type TabItem } from '@deta/services/tabs'
import { DragTypeNames, type DragTypes } from '@deta/types'

// Debounced cleanup to avoid multiple DOM queries
let cleanupRaf: number | null = null
export function cleanupDropIndicators() {
  // Cancel any pending cleanup
  if (cleanupRaf !== null) {
    cancelAnimationFrame(cleanupRaf)
  }

  // Schedule cleanup on next frame
  cleanupRaf = requestAnimationFrame(() => {
    const indicators = document.querySelectorAll('.dragcula-drop-indicator')
    indicators.forEach((el) => el.remove())
    cleanupRaf = null
  })
}

// Track ongoing operations to prevent race conditions
let isDragOperationInProgress = false

export function createTabsDragAndDrop(tabsService: TabsService) {
  const handleTabDrop = async (dragEvent: DragculaDragEvent<DragTypes>) => {
    if (!dragEvent.item?.data?.hasData(DragTypeNames.SURF_TAB)) {
      return
    }

    // Prevent concurrent drag operations
    if (isDragOperationInProgress) {
      dragEvent.continue()
      return
    }

    const draggedTab = dragEvent.item.data.getData(DragTypeNames.SURF_TAB) as TabItem
    const draggedTabId = draggedTab.id

    const currentIndex = tabsService.tabs.findIndex((tab) => tab.id === draggedTabId)
    if (currentIndex === -1) {
      dragEvent.continue()
      return
    }

    const targetIndex = dragEvent.index ?? tabsService.tabs.length
    const dropPosition = dragEvent.dropPosition

    // Validate dropPosition
    if (!dropPosition || !['before', 'after', 'on'].includes(dropPosition)) {
      dragEvent.continue()
      return
    }

    // Use current tab state instead of potentially stale dragged data
    const tab = tabsService.tabs[currentIndex]
    const isPinnedTab = tab.pinned

    // Calculate pinned section boundaries (excluding the dragged tab to get accurate count)
    const pinnedTabsExcludingDragged = tabsService.tabs.filter(
      (t) => t.pinned && t.id !== draggedTabId
    )
    const pinnedCountExcludingDragged = pinnedTabsExcludingDragged.length

    // Position-based pin/unpin logic
    let shouldPin = false
    let shouldUnpin = false

    // Handle boundary case: at the exact transition between pinned and unpinned sections
    if (targetIndex === pinnedCountExcludingDragged && dropPosition) {
      // At the boundary, use dropPosition to determine intent
      if (isPinnedTab) {
        // Pinned tab at boundary:
        // - "before" = moves to unpinned section (unpin)
        // - "after" = stays in pinned section (reorder only)
        if (dropPosition === 'before') {
          shouldUnpin = true
        }
      } else {
        // Unpinned tab at boundary:
        // - "before" = stays in unpinned section (reorder only)
        // - "after" = moves to pinned section (pin)
        if (dropPosition === 'after') {
          shouldPin = true
        }
      }
    } else {
      // Non-boundary positions: simple index-based logic
      if (isPinnedTab) {
        // Pinned tab moved past the pinned section → unpin
        if (targetIndex > pinnedCountExcludingDragged) {
          shouldUnpin = true
        }
      } else {
        // Unpinned tab moved into the pinned section → pin
        if (targetIndex < pinnedCountExcludingDragged) {
          shouldPin = true
        } else if (pinnedCountExcludingDragged === 0 && targetIndex === 0) {
          // Special case: no pinned tabs exist, dropping at index 0 should pin
          shouldPin = true
        }
      }
    }

    // Don't reorder if dropping in same position with no state change
    if (currentIndex === targetIndex && !shouldPin && !shouldUnpin) {
      dragEvent.continue()
      return
    }

    // Mark operation as in progress
    isDragOperationInProgress = true

    try {
      // Perform operations with proper async handling
      const performReorder = async () => {
        if (shouldPin) {
          await tabsService.pinTab(draggedTabId)
          // After pinning, place at end of pinned section
          const newPinnedCount = tabsService.tabs.filter((t) => t.pinned).length
          const adjustedTargetIndex = Math.min(targetIndex, newPinnedCount - 1)
          await tabsService.reorderTab(draggedTabId, adjustedTargetIndex)
        } else if (shouldUnpin) {
          await tabsService.unpinTab(draggedTabId)
          // After unpinning, place at start of unpinned section or at target
          const pinnedCount = tabsService.tabs.filter((t) => t.pinned).length
          const adjustedTargetIndex = Math.max(targetIndex, pinnedCount)
          await tabsService.reorderTab(draggedTabId, adjustedTargetIndex)
        } else {
          // Regular reordering within same pin state
          await tabsService.reorderTab(draggedTabId, targetIndex)
        }
      }

      await document.startViewTransition(performReorder).finished
    } finally {
      // Always reset the flag
      isDragOperationInProgress = false
    }

    dragEvent.continue()

    // Clean up any lingering drop indicators
    cleanupDropIndicators()
  }

  const acceptTabDrag = (dragOperation: any) => {
    if (!dragOperation.item?.data?.hasData(DragTypeNames.SURF_TAB)) {
      return false
    }

    const draggedTab = dragOperation.item.data.getData(DragTypeNames.SURF_TAB) as TabItem
    const draggedTabId = draggedTab.id

    const currentIndex = tabsService.tabs.findIndex((tab) => tab.id === draggedTabId)
    if (currentIndex === -1) return false

    // Get target index from the drag operation
    const targetIndex = dragOperation.index ?? tabsService.tabs.length

    return !(targetIndex === currentIndex)
  }

  const acceptUnpinnedTabDrag = (dragOperation: any) => {
    if (!dragOperation.item?.data?.hasData(DragTypeNames.SURF_TAB)) {
      return false
    }

    const draggedTab = dragOperation.item.data.getData(DragTypeNames.SURF_TAB) as TabItem
    const tab = tabsService.tabs.find((t) => t.id === draggedTab.id)

    // Only accept unpinned tabs
    return tab ? !tab.pinned : false
  }

  const handlePinZoneDrop = async (dragEvent: DragculaDragEvent<DragTypes>) => {
    if (!dragEvent.item?.data?.hasData(DragTypeNames.SURF_TAB)) {
      return
    }

    const draggedTab = dragEvent.item.data.getData(DragTypeNames.SURF_TAB) as TabItem
    const tab = tabsService.tabs.find((t) => t.id === draggedTab.id)

    if (!tab || tab.pinned) {
      dragEvent.continue()
      return
    }

    // Pin the tab and move it to the first position
    await tabsService.pinTab(tab.id)
    await tabsService.reorderTab(tab.id, 0)

    dragEvent.continue()
  }

  return {
    handleTabDrop,
    acceptTabDrag,
    acceptUnpinnedTabDrag,
    handlePinZoneDrop
  }
}
