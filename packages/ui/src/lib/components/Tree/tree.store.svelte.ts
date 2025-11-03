import type { BaseTreeNode, TreeState, TreeConfig, TreeEvents, TreeDragDropOperation } from './tree.types'
import { TreePersistence } from './TreePersistence'
import * as treeUtils from './tree.utils'
import { findNodePath, getNodeByPath } from './tree.dnd'
import { useLogScope } from '@deta/utils'

export function createTreeStore<T extends BaseTreeNode>(
  initialNodes: T[],
  config: TreeConfig<T> = {},
  events: Partial<TreeEvents<T>> = {}
) {
  const log = useLogScope('TreeStore')
  let nodes = $state<T[]>(initialNodes)
  let state = $state<TreeState<T>>({
    expanded: new Set<string>(),
    selected: new Set<string>(),
    loading: new Set<string>()
  })

  let persistence: TreePersistence | null = null
  let initialLoadComplete = false
  let customData = $state<Record<string, any>>({})

  if (config.persistState && config.persistenceKey) {
    persistence = new TreePersistence(config.persistenceKey)

    // Wait for KV store to be ready, then restore state
    persistence.waitForReady().then(() => {
      return persistence!.restoreState<T>()
    }).then(result => {
      if (result) {
        log.debug('Restoring persisted state:', {
          expanded: Array.from(result.state.expanded),
          selected: Array.from(result.state.selected),
          loading: Array.from(result.state.loading),
          customData: result.customData
        })
        state = result.state
        customData = result.customData || {}
        log.debug('State after restoration:', {
          expanded: Array.from(state.expanded),
          selected: Array.from(state.selected),
          loading: Array.from(state.loading),
          customData
        })
      } else {
        log.debug('No persisted state to restore')
      }
      // Mark initial load as complete so saving can begin
      initialLoadComplete = true
      log.debug('Initial load complete, saving enabled')
    }).catch(error => {
      log.warn('Failed to restore persisted state:', error)
      // Even if restore fails, enable saving
      initialLoadComplete = true
    })
  } else {
    // If no persistence, immediately enable saving
    initialLoadComplete = true
  }

  // Save state when it changes (debounced) - but only after initial load
  // Note: customData changes are saved immediately in updateCustomData(),
  // so this effect only needs to handle expand/selected state changes
  let saveTimeout: number | null = null

  $effect(() => {
    log.debug('Save effect triggered:', {
      hasPersistence: !!persistence,
      initialLoadComplete,
      expanded: Array.from(state.expanded),
      selected: Array.from(state.selected),
      customData
    })

    if (persistence && initialLoadComplete) {
      log.debug('Scheduling save in 500ms...')
      if (saveTimeout) clearTimeout(saveTimeout)
      saveTimeout = setTimeout(() => {
        log.debug('Executing scheduled save')
        persistence!.saveState(state, customData)
      }, 500) as any
    }
  })

  function setNodes(newNodes: T[]) {
    nodes = newNodes
  }

  function updateNode(nodeId: string, updates: Partial<T>) {
    nodes = treeUtils.updateNode(nodes, nodeId, updates)
  }

  function toggleExpanded(nodeId: string) {
    const node = treeUtils.findNodeById(nodes, nodeId)
    if (!node) return

    // If node doesn't have children at all, don't expand
    if (!node.children) return

    const hasExistingChildren = Array.isArray(node.children) && node.children.length > 0
    const isCurrentlyExpanded = state.expanded.has(nodeId)

    // Check if this is an async expand operation:
    // - Not currently expanded
    // - Has empty children array (needs loading)
    // - Has asyncExpand handler
    if (!isCurrentlyExpanded && !hasExistingChildren && events.asyncExpand) {
      state = treeUtils.setLoading(nodeId, true, state)

      events.asyncExpand(node)
        .then(children => {
          // Update node with loaded children
          if (children && children.length > 0) {
            updateNode(nodeId, { children } as Partial<T>)
          }
          state = treeUtils.setLoading(nodeId, false, state)
          state = treeUtils.toggleExpanded(nodeId, state)
          events.expand?.(node)
        })
        .catch(() => {
          state = treeUtils.setLoading(nodeId, false, state)
        })
      return
    }

    // Regular synchronous expand/collapse
    if (!hasExistingChildren && !isCurrentlyExpanded) {
      // Don't expand nodes that have no children and no async loader
      return
    }

    state = treeUtils.toggleExpanded(nodeId, state)

    log.debug('After toggle, expanded nodes:', Array.from(state.expanded))

    if (state.expanded.has(nodeId)) {
      events.expand?.(node)
    } else {
      events.collapse?.(node)
    }
  }

  function setExpanded(nodeId: string, expanded: boolean) {
    const isCurrentlyExpanded = state.expanded.has(nodeId)
    if (isCurrentlyExpanded !== expanded) {
      toggleExpanded(nodeId)
    }
  }

  function selectNode(nodeId: string, event?: MouseEvent) {
    const node = treeUtils.findNodeById(nodes, nodeId)
    if (!node) return

    state = treeUtils.setSelected(nodeId, state, config)
    events.select?.(node, event)
  }

  function clearSelections() {
    state = {
      ...state,
      selected: new Set<string>()
    }
  }

  function setSelectionSilent(nodeIds: string[]) {
    state = {
      ...state,
      selected: new Set(nodeIds)
    }
  }

  function expandAll() {
    state = treeUtils.expandAll(nodes, state)
  }

  function collapseAll() {
    state = treeUtils.collapseAll(state)
  }

  function insertNode(parentId: string | null, newNode: T, index?: number) {
    nodes = treeUtils.insertNode(nodes, parentId, newNode, index)
  }

  function removeNode(nodeId: string) {
    nodes = treeUtils.removeNode(nodes, nodeId)

    // Clean up state - create new state object to trigger reactivity
    const newExpanded = new Set(state.expanded)
    const newSelected = new Set(state.selected)
    const newLoading = new Set(state.loading)

    newExpanded.delete(nodeId)
    newSelected.delete(nodeId)
    newLoading.delete(nodeId)

    state = {
      expanded: newExpanded,
      selected: newSelected,
      loading: newLoading
    }
  }

  function renameNode(nodeId: string, newLabel: string) {
    const node = treeUtils.findNodeById(nodes, nodeId)
    if (!node) return

    updateNode(nodeId, { label: newLabel } as Partial<T>)
    events.rename?.(node, newLabel)
  }

  function performAction(nodeId: string, actionLabel: string) {
    const node = treeUtils.findNodeById(nodes, nodeId)
    if (!node) return

    events.action?.(node, actionLabel)
  }

  // Utility getters using $derived
  const flatNodes = $derived(treeUtils.flattenTree(nodes, state.expanded))

  function isExpanded(nodeId: string): boolean {
    return state.expanded.has(nodeId)
  }

  function isSelected(nodeId: string): boolean {
    return state.selected.has(nodeId)
  }

  function isLoading(nodeId: string): boolean {
    return state.loading.has(nodeId)
  }

  function getNodeDepth(nodeId: string): number {
    return treeUtils.getNodeDepth(nodes, nodeId)
  }

  function hasChildren(nodeId: string): boolean {
    const node = treeUtils.findNodeById(nodes, nodeId)
    return node ? treeUtils.hasChildren(node) : false
  }

  function getSelectedNodes(): T[] {
    return Array.from(state.selected)
      .map(id => treeUtils.findNodeById(nodes, id))
      .filter(node => node !== null) as T[]
  }

  // DND support methods
  function moveNode(sourceNodeId: string, targetParentId: string | null, targetIndex: number): boolean {
    const sourceNode = treeUtils.findNodeById(nodes, sourceNodeId)
    if (!sourceNode) return false

    // Find source path to get current position
    const sourcePath = findNodePath(nodes, sourceNodeId)
    if (!sourcePath) return false

    // Get source parent and index
    const sourceParentId = sourcePath.length > 1 ?
      getNodeByPath(nodes, sourcePath.slice(0, -1))?.id || null : null
    const sourceIndex = sourcePath[sourcePath.length - 1]

    // Remove node from current position
    nodes = treeUtils.removeNode(nodes, sourceNodeId)

    // Insert at new position
    nodes = treeUtils.insertNode(nodes, targetParentId, sourceNode, targetIndex)

    return true
  }

  function handleDrop(operation: TreeDragDropOperation<T>): void {
    if (!config.drag?.enabled) return

    const { sourceNode, targetNode, targetIndex, targetParent, operation: dragOperation } = operation

    try {
      // Call pre-drop event
      if (events.drop) {
        events.drop(operation)
      }

      // Perform the actual move operation if it's a move operation
      if (dragOperation === 'move') {
        const success = moveNode(
          sourceNode.id,
          targetParent?.id || null,
          targetIndex ?? 0
        )

        if (!success) {
          log.error('Failed to move node:', sourceNode.id)
          return
        }
      }

      // Call post-drop event
      if (events.dragEnd) {
        events.dragEnd(operation)
      }

    } catch (error) {
      log.error('Error handling drop:', error)
      throw error
    }
  }

  function canAcceptDrop(operation: TreeDragDropOperation<T>): boolean {
    if (!config.drag?.enabled) return false

    const { sourceNode, targetNode, targetParent } = operation

    // Check if target allows drops
    if (targetNode?.droppable === false) return false
    if (targetParent?.droppable === false) return false

    // Check if source allows dragging
    if (sourceNode.draggable === false) return false

    // Use custom acceptance logic if provided
    if (config.drag.acceptsCallback) {
      return config.drag.acceptsCallback(
        operation.dragData,
        targetNode || targetParent!,
        sourceNode
      )
    }

    // Default acceptance rules
    if (config.drag.allowReorder) return true
    if (config.drag.allowCrossNodeDrag && targetNode) return true
    if (config.drag.allowParentChildDrag && targetParent) return true

    return false
  }

  function getNodeIndex(nodeId: string, parentId?: string): number {
    if (!parentId) {
      // Top-level node
      return nodes.findIndex(node => node.id === nodeId)
    }

    const parent = treeUtils.findNodeById(nodes, parentId)
    if (!parent?.children) return -1

    return parent.children.findIndex(child => child.id === nodeId)
  }

  // Custom data management
  function setCustomData(key: string, value: any) {
    customData = { ...customData, [key]: value }
  }

  function getCustomData(key?: string) {
    return key ? customData[key] : customData
  }

  function updateCustomData(updates: Record<string, any>) {
    customData = { ...customData, ...updates }

    // Immediately persist customData changes (don't wait for debounced effect)
    if (persistence && initialLoadComplete) {
      persistence.saveState(state, customData)
    }
  }

  async function saveCustomDataOnly(data: Record<string, any>) {
    if (persistence) {
      await persistence.saveCustomData(data)
      customData = { ...customData, ...data }
    }
  }

  return {
    get nodes() { return nodes },
    get state() { return state },
    get flatNodes() { return flatNodes },
    get customData() { return customData },
    setNodes,
    updateNode,
    toggleExpanded,
    setExpanded,
    selectNode,
    clearSelections,
    expandAll,
    collapseAll,
    insertNode,
    removeNode,
    renameNode,
    performAction,
    isExpanded,
    isSelected,
    isLoading,
    getNodeDepth,
    hasChildren,
    getSelectedNodes,
    // DND methods
    moveNode,
    handleDrop,
    canAcceptDrop,
    getNodeIndex,
    // Custom data methods
    setCustomData,
    getCustomData,
    updateCustomData,
    saveCustomDataOnly,
    // Silent selection methods
    setSelectionSilent,
    initialLoadComplete
  }
}

export type TreeStore<T extends BaseTreeNode = BaseTreeNode> = ReturnType<typeof createTreeStore<T>>
