export interface BaseTreeNode {
  id: string
  label: string
  children?: BaseTreeNode[]
  expanded?: boolean
  loading?: boolean
  selected?: boolean
  count?: number
  meta?: Record<string, any>
  // DND specific properties
  draggable?: boolean
  droppable?: boolean
  dragData?: Record<string, any>
}

export interface TreeNodeAction {
  label: string
  icon?: string
  action: (node: BaseTreeNode) => void | Promise<void>
  disabled?: boolean | ((node: BaseTreeNode) => boolean)
}

export interface TreeHierarchyRule {
  allowAsChildOf?: string[] // What node types this can be a child of
  allowAsSiblingOf?: string[] // What node types this can be a sibling of
  canAcceptChildren?: string[] // What node types this can accept as children
}

export interface TreeHierarchyRules {
  [nodeType: string]: TreeHierarchyRule
}

export interface TreeDragContext {
  isRootLevel: boolean // Whether this is a root-level drop zone
  targetDepth: number // Depth of the target node
  sourceDepth: number // Depth of the source node
}

export interface TreeDragConfig {
  enabled?: boolean
  allowReorder?: boolean
  allowCrossNodeDrag?: boolean
  allowParentChildDrag?: boolean
  dragTypes?: string[]
  axis?: 'horizontal' | 'vertical' | 'both'
  showDropIndicator?: boolean
  // Enhanced acceptance callback with context
  acceptsCallback?: (dragData: any, targetNode: BaseTreeNode | undefined, sourceNode: BaseTreeNode | undefined, context: TreeDragContext) => boolean
  // Declarative hierarchy rules - simpler alternative to acceptsCallback
  hierarchyRules?: TreeHierarchyRules
}

export interface TreeConfig<T extends BaseTreeNode = BaseTreeNode> {
  idKey?: keyof T
  labelKey?: keyof T
  childrenKey?: keyof T
  allowReorder?: boolean
  allowRename?: boolean
  allowMultiSelect?: boolean
  persistState?: boolean
  persistenceKey?: string
  showCount?: boolean
  // DND configuration
  drag?: TreeDragConfig
  // Order configuration
  order?: TreeOrderConfig
}

export interface TreeState<T extends BaseTreeNode = BaseTreeNode> {
  expanded: Set<string>
  selected: Set<string>
  loading: Set<string>
  dragOver?: string
}

export interface TreeViewState {
  id: string
  expanded: string[]
  selected: string[]
  createdAt: string
  updatedAt: string
}

export interface ExtendedTreeViewState extends TreeViewState {
  customData?: Record<string, any>
}

export interface TreeOrderConfig {
  enableNodeOrder?: boolean
  enableChildOrder?: boolean
  orderKey?: string
}

export interface TreeNodeProps<T extends BaseTreeNode = BaseTreeNode> {
  node: T
  depth: number
  hasChildren: boolean
  isExpanded: boolean
  isSelected: boolean
  isLoading: boolean
  config: TreeConfig<T>
  actions?: TreeNodeAction[]
}

export interface TreeDragDropOperation<T extends BaseTreeNode = BaseTreeNode> {
  sourceNode: T
  targetNode?: T
  sourceIndex: number
  targetIndex?: number
  sourceParent?: T
  targetParent?: T
  dragData: Record<string, any>
  operation: 'move' | 'copy' | 'link'
}

export interface TreeEvents<T extends BaseTreeNode = BaseTreeNode> {
  select: (node: T, event?: MouseEvent) => void
  expand: (node: T) => void
  collapse: (node: T) => void
  rename: (node: T, newLabel: string) => void
  action: (node: T, actionLabel: string) => void
  asyncExpand?: (node: T) => Promise<T[]>
  // DND events
  dragStart?: (operation: TreeDragDropOperation<T>) => void | Promise<void>
  dragEnter?: (operation: TreeDragDropOperation<T>) => void | Promise<void>
  dragLeave?: (operation: TreeDragDropOperation<T>) => void | Promise<void>
  dragOver?: (operation: TreeDragDropOperation<T>) => void | Promise<void>
  drop?: (operation: TreeDragDropOperation<T>) => void | Promise<void>
  dragEnd?: (operation: TreeDragDropOperation<T>) => void | Promise<void>
}