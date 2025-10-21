import type { BaseTreeNode, TreeState, TreeConfig } from './tree.types'

export function findNodeById<T extends BaseTreeNode>(
  nodes: T[],
  id: string
): T | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node
    }
    if (node.children) {
      const found = findNodeById(node.children as T[], id)
      if (found) return found
    }
  }
  return null
}

export function findNodePath<T extends BaseTreeNode>(
  nodes: T[],
  id: string,
  path: string[] = []
): string[] | null {
  for (const node of nodes) {
    const currentPath = [...path, node.id]

    if (node.id === id) {
      return currentPath
    }

    if (node.children) {
      const found = findNodePath(node.children as T[], id, currentPath)
      if (found) return found
    }
  }
  return null
}

export function getNodeDepth<T extends BaseTreeNode>(
  nodes: T[],
  targetId: string,
  currentDepth = 0
): number {
  for (const node of nodes) {
    if (node.id === targetId) {
      return currentDepth
    }
    if (node.children) {
      const depth = getNodeDepth(node.children as T[], targetId, currentDepth + 1)
      if (depth !== -1) return depth
    }
  }
  return -1
}

export function getAllNodeIds<T extends BaseTreeNode>(nodes: T[]): string[] {
  const ids: string[] = []

  function collect(nodeList: T[]) {
    for (const node of nodeList) {
      ids.push(node.id)
      if (node.children) {
        collect(node.children as T[])
      }
    }
  }

  collect(nodes)
  return ids
}

export function expandAll<T extends BaseTreeNode>(
  nodes: T[],
  state: TreeState<T>
): TreeState<T> {
  const allIds = getAllNodeIds(nodes)
  return {
    ...state,
    expanded: new Set(allIds)
  }
}

export function collapseAll<T extends BaseTreeNode>(
  state: TreeState<T>
): TreeState<T> {
  return {
    ...state,
    expanded: new Set<string>()
  }
}

export function toggleExpanded<T extends BaseTreeNode>(
  nodeId: string,
  state: TreeState<T>
): TreeState<T> {
  const expanded = new Set(state.expanded)

  if (expanded.has(nodeId)) {
    expanded.delete(nodeId)
  } else {
    expanded.add(nodeId)
  }

  return {
    ...state,
    expanded
  }
}

export function setSelected<T extends BaseTreeNode>(
  nodeId: string,
  state: TreeState<T>,
  config: TreeConfig<T>
): TreeState<T> {
  let selected = new Set<string>()

  if (config.allowMultiSelect) {
    if (state.selected.has(nodeId)) {
      selected = new Set(state.selected)
      selected.delete(nodeId)
    } else {
      selected = new Set([...Array.from(state.selected), nodeId])
    }
  } else {
    selected.add(nodeId)
  }

  return {
    ...state,
    selected
  }
}

export function setLoading<T extends BaseTreeNode>(
  nodeId: string,
  isLoading: boolean,
  state: TreeState<T>
): TreeState<T> {
  const loading = new Set(state.loading)

  if (isLoading) {
    loading.add(nodeId)
  } else {
    loading.delete(nodeId)
  }

  return {
    ...state,
    loading
  }
}

export function flattenTree<T extends BaseTreeNode>(
  nodes: T[],
  expandedSet: Set<string>,
  depth = 0
): Array<T & { depth: number }> {
  const result: Array<T & { depth: number }> = []

  for (const node of nodes) {
    result.push({ ...node, depth })

    if (node.children && expandedSet.has(node.id)) {
      result.push(...flattenTree(node.children as T[], expandedSet, depth + 1))
    }
  }

  return result
}

export function hasChildren<T extends BaseTreeNode>(node: T): boolean {
  return Array.isArray(node.children) && node.children.length > 0
}

export function updateNode<T extends BaseTreeNode>(
  nodes: T[],
  nodeId: string,
  updates: Partial<T>
): T[] {
  return nodes.map(node => {
    if (node.id === nodeId) {
      return { ...node, ...updates }
    }
    if (node.children) {
      return {
        ...node,
        children: updateNode(node.children as T[], nodeId, updates) as T['children']
      }
    }
    return node
  })
}

export function insertNode<T extends BaseTreeNode>(
  nodes: T[],
  parentId: string | null,
  newNode: T,
  index?: number
): T[] {
  if (parentId === null) {
    const insertIndex = index ?? nodes.length
    return [
      ...nodes.slice(0, insertIndex),
      newNode,
      ...nodes.slice(insertIndex)
    ]
  }

  return nodes.map(node => {
    if (node.id === parentId) {
      const children = (node.children as T[]) || []
      const insertIndex = index ?? children.length
      return {
        ...node,
        children: [
          ...children.slice(0, insertIndex),
          newNode,
          ...children.slice(insertIndex)
        ] as T['children']
      }
    }
    if (node.children) {
      return {
        ...node,
        children: insertNode(node.children as T[], parentId, newNode, index) as T['children']
      }
    }
    return node
  })
}

export function removeNode<T extends BaseTreeNode>(
  nodes: T[],
  nodeId: string
): T[] {
  return nodes
    .filter(node => node.id !== nodeId)
    .map(node => ({
      ...node,
      children: node.children
        ? removeNode(node.children as T[], nodeId) as T['children']
        : node.children
    }))
}