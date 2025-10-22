import { DragData } from '@deta/dragcula'
import type { BaseTreeNode, TreeDragDropOperation, TreeDragConfig, TreeDragContext, TreeHierarchyRules } from './tree.types'

// Constants for tree DND
export const TREE_DRAG_TYPES = {
  NODE: 'tree-node',
  REORDER: 'tree-reorder',
  CUSTOM: 'tree-custom'
} as const

export type TreeDragType = typeof TREE_DRAG_TYPES[keyof typeof TREE_DRAG_TYPES]

// Tree-specific drag data structure
export interface TreeDragData<T extends BaseTreeNode = BaseTreeNode> {
  node: T
  nodeId: string
  sourceIndex: number
  sourceParent?: T
  treeId?: string
  dragType: TreeDragType
  customData?: Record<string, any>
}

// Helper to create tree drag data
export function createTreeDragData<T extends BaseTreeNode>(
  node: T,
  sourceIndex: number,
  sourceParent?: T,
  treeId?: string,
  customData?: Record<string, any>
): DragData<TreeDragData<T>> {
  const dragData = new DragData<TreeDragData<T>>()

  dragData.setData(TREE_DRAG_TYPES.NODE, {
    node,
    nodeId: node.id,
    sourceIndex,
    sourceParent,
    treeId,
    dragType: TREE_DRAG_TYPES.NODE,
    customData: { ...node.dragData, ...customData }
  })

  return dragData
}

// Helper to extract tree drag data
export function extractTreeDragData<T extends BaseTreeNode>(
  dragData: DragData
): TreeDragData<T> | null {
  if (!dragData.hasData(TREE_DRAG_TYPES.NODE)) {
    return null
  }

  return dragData.getData(TREE_DRAG_TYPES.NODE) as TreeDragData<T>
}

// Enhanced acceptance logic for tree DND with hierarchy support
export function defaultTreeAccepts<T extends BaseTreeNode>(
  dragData: DragData,
  targetNode: T | undefined,
  config: TreeDragConfig,
  context?: TreeDragContext
): boolean {
  const treeDragData = extractTreeDragData<T>(dragData)

  if (!treeDragData) {
    return false
  }

  // Check if target node allows drops
  if (targetNode && targetNode.droppable === false) {
    return false
  }

  // Prevent dropping parent on child (would create circular reference)
  if (targetNode && isDescendant(treeDragData.node, targetNode)) {
    return false
  }

  // Use hierarchy rules if provided
  if (config.hierarchyRules) {
    return checkHierarchyRules(treeDragData.node, targetNode, config.hierarchyRules, context)
  }

  // Use custom acceptance logic if provided
  if (config.acceptsCallback && context) {
    return config.acceptsCallback(treeDragData.customData, targetNode, treeDragData.node, context)
  }

  // Default: allow drops if reordering is enabled
  return config.allowReorder ?? false
}

// Helper to check hierarchy rules
function checkHierarchyRules<T extends BaseTreeNode>(
  sourceNode: T,
  targetNode: T | undefined,
  hierarchyRules: TreeHierarchyRules,
  context?: TreeDragContext
): boolean {
  // Extract node types from meta or use a type property
  const getNodeType = (node: T): string => {
    return node.meta?.type || node.dragData?.type || 'default'
  }

  const sourceType = getNodeType(sourceNode)
  const sourceRule = hierarchyRules[sourceType]

  if (!sourceRule) {
    // No rules defined for this source type - allow by default
    return true
  }

  // Root level drops (no target node)
  if (!targetNode) {
    if (context?.isRootLevel) {
      // Check if source can be a sibling of root-level items
      // For now, allow if allowAsSiblingOf includes the source type (self-siblings)
      return sourceRule.allowAsSiblingOf?.includes(sourceType) ?? true
    }
    return false
  }

  const targetType = getNodeType(targetNode)
  const targetRule = hierarchyRules[targetType]

  // Dropping onto a node (becoming child)
  if (!context?.isRootLevel) {
    // Check if source can be a child of target
    const canBeChild = sourceRule.allowAsChildOf?.includes(targetType) ?? false
    // Check if target can accept this source as child
    const canAcceptChild = targetRule?.canAcceptChildren?.includes(sourceType) ?? false

    return canBeChild && canAcceptChild
  }

  // Reordering at the same level (becoming sibling)
  const canBeSibling = sourceRule.allowAsSiblingOf?.includes(targetType) ?? false

  return canBeSibling
}

// Helper to check if a node is a descendant of another node
export function isDescendant<T extends BaseTreeNode>(
  potentialDescendant: T,
  potentialAncestor: T
): boolean {
  function checkChildren(node: T): boolean {
    if (!node.children) return false

    for (const child of node.children) {
      if (child.id === potentialAncestor.id) {
        return true
      }
      if (checkChildren(child as T)) {
        return true
      }
    }
    return false
  }

  return checkChildren(potentialDescendant)
}

// Helper to find node path (indices from root to node)
export function findNodePath<T extends BaseTreeNode>(
  nodes: T[],
  targetId: string,
  currentPath: number[] = []
): number[] | null {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    const path = [...currentPath, i]

    if (node.id === targetId) {
      return path
    }

    if (node.children && node.children.length > 0) {
      const childPath = findNodePath(node.children as T[], targetId, path)
      if (childPath) {
        return childPath
      }
    }
  }

  return null
}

// Helper to get node by path
export function getNodeByPath<T extends BaseTreeNode>(
  nodes: T[],
  path: number[]
): T | null {
  let current: T[] = nodes
  let node: T | null = null

  for (const index of path) {
    if (index >= current.length) {
      return null
    }

    node = current[index]
    current = (node.children as T[]) || []
  }

  return node
}

// Helper to create a tree drag operation
export function createTreeDragOperation<T extends BaseTreeNode>(
  dragData: TreeDragData<T>,
  targetNode?: T,
  targetIndex?: number,
  targetParent?: T,
  operation: 'move' | 'copy' | 'link' = 'move'
): TreeDragDropOperation<T> {
  return {
    sourceNode: dragData.node,
    targetNode,
    sourceIndex: dragData.sourceIndex,
    targetIndex,
    sourceParent: dragData.sourceParent,
    targetParent,
    dragData: dragData.customData || {},
    operation
  }
}