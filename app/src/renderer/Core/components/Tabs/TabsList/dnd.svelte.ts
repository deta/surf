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

export function createTabsDragAndDrop(tabsService: TabsService) {
  const withViewTransition = (callback: () => void) => {
    document.startViewTransition(() => {
      callback()
    })
  }

  const handleTabDrop = async (dragEvent: DragculaDragEvent<DragTypes>) => {
    if (!dragEvent.item?.data?.hasData(DragTypeNames.SURF_TAB)) {
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

    // Don't reorder if dropping in same position
    if (currentIndex === targetIndex) {
      dragEvent.continue()
      return
    }

    withViewTransition(async () => {
      tabsService.reorderTab(draggedTabId, targetIndex)
    })

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

  return {
    handleTabDrop,
    acceptTabDrag
  }
}
