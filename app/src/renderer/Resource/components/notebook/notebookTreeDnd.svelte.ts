import type { TreeDragDropOperation, TreeNodeStore } from '@deta/ui'
import type { Notebook, NotebookManager } from '@deta/services/notebooks'
import { ResourceTypes, SpaceEntryOrigin } from '@deta/types'

// Enhanced tree node type for notebooks and notes
export type NotebookTreeNode = {
  id: string
  label: string
  meta: {
    type: 'notebook' | 'note'
    notebook?: any
    resource?: any
    entryId?: string
    updateKey?: number
  }
  count?: number
  children?: NotebookTreeNode[]
  expanded?: boolean
  draggable?: boolean
  droppable?: boolean
  dragData?: Record<string, any>
}

// Track ongoing operations to prevent race conditions
let isDragOperationInProgress = false

export function createNotebookTreeDragAndDrop(
  notebookManager: NotebookManager,
  treeStore: TreeNodeStore<NotebookTreeNode>
) {
  /**
   * Main drop handler - delegates to specific handlers based on node type
   */
  const handleDrop = async (operation: TreeDragDropOperation<NotebookTreeNode>) => {
    const { sourceNode, targetIndex } = operation

    // Prevent concurrent drag operations
    if (isDragOperationInProgress) {
      return
    }

    // Validate target index
    if (typeof targetIndex !== 'number') {
      return
    }

    // Don't process if dropping in same position
    const sourceType = sourceNode.meta.type
    if (sourceType === 'notebook') {
      const currentOrder = getNotebookOrder()
      const currentIndex = currentOrder.indexOf(sourceNode.id)
      if (currentIndex === targetIndex) {
        return
      }
    }

    // Mark operation as in progress
    isDragOperationInProgress = true

    try {
      // Delegate to specific handler
      if (sourceNode.meta.type === 'note') {
        await handleNoteDrop(operation)
      } else if (sourceNode.meta.type === 'notebook') {
        await handleNotebookDrop(operation)
      }
    } finally {
      // Always reset the flag
      isDragOperationInProgress = false
    }
  }

  /**
   * Handle dropping a note - either reorder within notebook or move between notebooks
   */
  async function handleNoteDrop(operation: TreeDragDropOperation<NotebookTreeNode>) {
    const { sourceNode, targetNode, targetParent, targetIndex } = operation
    const sourceNoteId = sourceNode.meta.entryId

    if (!sourceNoteId) {
      throw new Error('Source note ID not found')
    }

    // Find source notebook
    const sourceNotebook = findNotebookContainingNote(sourceNoteId)
    if (!sourceNotebook) {
      throw new Error('Source notebook not found')
    }

    // Determine target notebook
    let targetNotebook: any

    if (targetNode?.meta.type === 'notebook') {
      targetNotebook = targetNode.meta.notebook
    } else if (targetParent?.meta.type === 'notebook') {
      targetNotebook = targetParent.meta.notebook
    } else {
      throw new Error('Invalid drop target for note')
    }

    const isSameNotebook = sourceNotebook.id === targetNotebook.id

    // Perform the operation with view transition
    const performOperation = async () => {
      if (isSameNotebook) {
        await reorderNoteWithinNotebook(sourceNoteId, targetNotebook, targetIndex)
      } else {
        // Use targetIndex if provided, otherwise append to end
        await moveNoteBetweenNotebooks(sourceNoteId, sourceNotebook, targetNotebook, targetIndex)
      }
    }

    await document.startViewTransition(performOperation).finished
  }

  /**
   * Handle dropping a notebook - reorder at root level
   */
  async function handleNotebookDrop(operation: TreeDragDropOperation<NotebookTreeNode>) {
    const { sourceNode, targetIndex } = operation
    const sourceNotebookId = sourceNode.id

    if (!sourceNotebookId) {
      throw new Error('Source notebook ID not found')
    }

    // Perform the operation with view transition
    const performOperation = async () => {
      await reorderNotebooks(sourceNotebookId, targetIndex)
    }

    await document.startViewTransition(performOperation).finished
  }

  /**
   * Find which notebook contains a specific note
   */
  function findNotebookContainingNote(noteId: string): any | null {
    const notebooks = Array.from(notebookManager.notebooks.values())
    return notebooks.find((nb) => nb.contents.some((entry: any) => entry.entry_id === noteId))
  }

  /**
   * Get current notebook order from tree store or fallback to natural order
   * Important: Only returns IDs for notebooks that currently exist
   */
  function getNotebookOrder(): string[] {
    const notebooks = Array.from(notebookManager.notebooks.values())
    const notebookIds = new Set(notebooks.map((nb) => nb.id))

    const customData = treeStore.getCustomData()
    if (customData.notebookOrder && customData.notebookOrder.length > 0) {
      // Filter persisted order to only include existing notebooks
      const existingIds = customData.notebookOrder.filter((id) => notebookIds.has(id))

      // Add any new notebooks that aren't in the persisted order
      const usedIds = new Set(existingIds)
      for (const notebook of notebooks) {
        if (!usedIds.has(notebook.id)) {
          existingIds.push(notebook.id)
        }
      }

      return existingIds
    }

    return notebooks.map((nb) => nb.id)
  }

  /**
   * Get current note order for a notebook from tree store or fallback to natural order
   * Important: Only returns IDs for notes that currently exist in the notebook
   */
  function getNoteOrder(notebookId: string): string[] {
    const notebook = notebookManager.notebooks.get(notebookId)
    if (!notebook) return []

    const noteEntries = notebook.contents.filter(
      (entry: any) => entry.resource_type === ResourceTypes.DOCUMENT_SPACE_NOTE
    )
    const noteIds = new Set(noteEntries.map((entry: any) => entry.entry_id))

    const customData = treeStore.getCustomData()
    const noteOrders = customData.noteOrders || {}
    if (noteOrders[notebookId] && noteOrders[notebookId].length > 0) {
      // Filter persisted order to only include existing notes
      const existingIds = noteOrders[notebookId].filter((id) => noteIds.has(id))

      // Add any new notes that aren't in the persisted order
      const usedIds = new Set(existingIds)
      for (const entry of noteEntries) {
        if (!usedIds.has(entry.entry_id)) {
          existingIds.push(entry.entry_id)
        }
      }

      return existingIds
    }

    return noteEntries.map((entry: any) => entry.entry_id)
  }

  /**
   * Reorder a note within its current notebook
   */
  async function reorderNoteWithinNotebook(
    noteId: string,
    notebook: any,
    targetIndex: number
  ): Promise<void> {
    const currentOrder = getNoteOrder(notebook.id)
    const currentIndex = currentOrder.indexOf(noteId)

    if (currentIndex === -1) {
      throw new Error('Note not found in notebook')
    }

    if (currentIndex === targetIndex) {
      return // Already in position
    }

    // Simple array reordering - remove from current position and insert at target
    const newOrder = [...currentOrder]
    newOrder.splice(currentIndex, 1)
    newOrder.splice(targetIndex, 0, noteId)

    // Update persisted state
    const customData = treeStore.getCustomData()
    const noteOrders = { ...(customData.noteOrders || {}) }
    noteOrders[notebook.id] = newOrder
    treeStore.updateCustomData({ noteOrders })
  }

  /**
   * Move a note from one notebook to another
   */
  async function moveNoteBetweenNotebooks(
    noteId: string,
    fromNotebook: Notebook,
    toNotebook: Notebook,
    targetIndex?: number
  ): Promise<void> {
    await fromNotebook.removeResources([noteId], true)
    await toNotebook.addResources([noteId], SpaceEntryOrigin.ManuallyAdded, true)

    // Refresh both notebooks
    await Promise.all([fromNotebook.fetchContents(), toNotebook.fetchContents()])

    // Update persisted orders for both notebooks
    const fromNoteEntries = fromNotebook.contents.filter(
      (entry: any) => entry.resource_type === ResourceTypes.DOCUMENT_SPACE_NOTE
    )
    const toNoteEntries = toNotebook.contents.filter(
      (entry: any) => entry.resource_type === ResourceTypes.DOCUMENT_SPACE_NOTE
    )

    // Build new order for target notebook
    let toNoteIds = toNoteEntries.map((entry: any) => entry.entry_id)

    // If targetIndex is specified, ensure note is at that position
    if (typeof targetIndex === 'number') {
      const noteIndex = toNoteIds.indexOf(noteId)

      if (noteIndex !== -1) {
        // Remove note from its current position
        toNoteIds.splice(noteIndex, 1)
        // Insert at target position
        toNoteIds.splice(targetIndex, 0, noteId)
      }
    }

    // Update persisted state
    const customData = treeStore.getCustomData()
    const noteOrders = { ...(customData.noteOrders || {}) }
    noteOrders[fromNotebook.id] = fromNoteEntries.map((entry: any) => entry.entry_id)
    noteOrders[toNotebook.id] = toNoteIds
    treeStore.updateCustomData({ noteOrders })
  }

  /**
   * Reorder notebooks at root level
   */
  async function reorderNotebooks(sourceNotebookId: string, targetIndex: number): Promise<void> {
    const currentOrder = getNotebookOrder()
    const currentIndex = currentOrder.indexOf(sourceNotebookId)

    if (currentIndex === -1) {
      throw new Error('Source notebook not found in current order')
    }

    if (currentIndex === targetIndex) {
      return // Already in position
    }

    // Simple array reordering - remove from current position and insert at target
    const newOrder = [...currentOrder]
    newOrder.splice(currentIndex, 1)
    newOrder.splice(targetIndex, 0, sourceNotebookId)

    // Update persisted state
    treeStore.updateCustomData({ notebookOrder: newOrder })
  }

  return {
    handleDrop
  }
}
