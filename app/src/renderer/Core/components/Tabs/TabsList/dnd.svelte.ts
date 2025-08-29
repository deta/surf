import { type DragculaDragEvent } from '@deta/dragcula'
import { type TabsService } from '@deta/services/tabs'
import { DragTypeNames, type DragTypes } from '@deta/types'

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

    const draggedTab = dragEvent.item.data.getData(DragTypeNames.SURF_TAB)
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
  }

  const acceptTabDrag = (dragOperation: any) => {
    if (!dragOperation.item?.data?.hasData(DragTypeNames.SURF_TAB)) {
      return false
    }

    const draggedTab = dragOperation.item.data.getData(DragTypeNames.SURF_TAB)
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
