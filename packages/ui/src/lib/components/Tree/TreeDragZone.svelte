<script lang="ts">
  import { HTMLAxisDragZone, type DragculaDragEvent, type DragOperation } from '@deta/dragcula'
  import type { BaseTreeNode, TreeDragConfig, TreeDragDropOperation, TreeDragContext } from './tree.types'
  import { defaultTreeAccepts, extractTreeDragData, createTreeDragOperation } from './tree.dnd'
  import type { Snippet } from 'svelte'

  type TreeDragZoneProps<T extends BaseTreeNode = BaseTreeNode> = {
    node?: T
    parent?: T
    treeId?: string
    config: TreeDragConfig
    children: Snippet
    onDragEnter?: (operation: TreeDragDropOperation<T>) => void
    onDragLeave?: (operation: TreeDragDropOperation<T>) => void
    onDragOver?: (operation: TreeDragDropOperation<T>) => void
    onDrop?: (operation: TreeDragDropOperation<T>) => void
    class?: string
    // New prop to indicate this is a root-level drag zone
    isRootLevel?: boolean
  }

  let {
    node,
    parent,
    treeId,
    config,
    children,
    onDragEnter,
    onDragLeave,
    onDragOver,
    onDrop,
    class: className = '',
    isRootLevel = false,
    ...restProps
  }: TreeDragZoneProps = $props()


  // Calculate depth for context
  function getNodeDepth(node?: BaseTreeNode, parent?: BaseTreeNode): number {
    if (!node) return 0
    if (!parent) return 0 // Root level
    // This is simplified - in a real implementation you'd traverse up the tree
    return 1
  }

  // Create drag context
  const dragContext = $derived<TreeDragContext>({
    isRootLevel,
    targetDepth: getNodeDepth(node, parent),
    sourceDepth: 0 // Will be updated when we have source info
  })

  // Check if dropping is enabled
  const isDroppable = $derived(
    config.enabled &&
    (node?.droppable !== false) &&
    (config.allowReorder || config.allowCrossNodeDrag || config.allowParentChildDrag)
  )

  // Acceptance logic
  function accepts(dragOperation: DragOperation): boolean {
    if (!isDroppable || !dragOperation.item?.data) {
      return false
    }

    const treeDragData = extractTreeDragData(dragOperation.item.data)
    if (!treeDragData) {
      return false
    }

    // Create context with source depth
    const context: TreeDragContext = {
      ...dragContext,
      sourceDepth: getNodeDepth(treeDragData.node, treeDragData.sourceParent)
    }

    // Use enhanced tree-specific acceptance logic with context
    return defaultTreeAccepts(dragOperation.item.data, node, config, context)
  }

  function handleDragEnter(event: DragculaDragEvent) {
    if (!event.item?.data) return

    const treeDragData = extractTreeDragData(event.item.data)
    if (!treeDragData) return

    // Create operation object
    const operation = createTreeDragOperation(
      treeDragData,
      node,
      event.index ?? undefined,
      parent,
      'move'
    )

    // Call external handler
    if (onDragEnter) {
      onDragEnter(operation)
    }

    event.continue()
  }

  function handleDragLeave(event: DragculaDragEvent) {
    if (!event.item?.data) return

    const treeDragData = extractTreeDragData(event.item.data)
    if (!treeDragData) return

    // Create operation object
    const operation = createTreeDragOperation(
      treeDragData,
      node,
      event.index ?? undefined,
      parent,
      'move'
    )

    // Call external handler
    if (onDragLeave) {
      onDragLeave(operation)
    }
  }

  function handleDragOver(event: DragculaDragEvent) {
    if (!event.item?.data) return

    const treeDragData = extractTreeDragData(event.item.data)
    if (!treeDragData) return

    // Create operation object
    const operation = createTreeDragOperation(
      treeDragData,
      node,
      event.index ?? undefined,
      parent,
      'move'
    )

    // Call external handler
    if (onDragOver) {
      onDragOver(operation)
    }
  }

  function handleDrop(event: DragculaDragEvent) {
    if (!event.item?.data) {
      event.abort()
      return
    }

    const treeDragData = extractTreeDragData(event.item.data)
    if (!treeDragData) {
      event.abort()
      return
    }

    // Create operation object
    const operation = createTreeDragOperation(
      treeDragData,
      node,
      event.index ?? undefined,
      parent,
      'move'
    )

    // Call external handler
    if (onDrop) {
      try {
        onDrop(operation)
        event.continue()
      } catch (error) {
        console.error('[TreeDragZone] Drop operation failed:', error)
        event.abort()
      }
    } else {
      event.continue()
    }
  }
</script>

{#if isDroppable}
  <div
    use:HTMLAxisDragZone.action={{
      accepts
    }}
    axis={config.axis || 'vertical'}
    class="tree-drag-zone {className}"
    on:DragEnter={handleDragEnter}
    on:DragLeave={handleDragLeave}
    on:DragOver={handleDragOver}
    on:Drop={handleDrop}
    {...restProps}
  >
    {@render children()}
  </div>
{:else}
  <div class="tree-drag-zone tree-drag-zone--disabled {className}" {...restProps}>
    {@render children()}
  </div>
{/if}

<style lang="scss">
  .tree-drag-zone {
    position: relative;

    // Visual feedback for drag over state
    &:global([data-drag-target]) {
      background-color: var(--tree-drag-over-bg, rgba(59, 130, 246, 0.1));
      border-radius: var(--tree-node-border-radius, 0.375rem);
    }
  }

  // Drop indicator styling
  :global(.dragcula-drop-indicator) {
    background-color: var(--tree-drop-indicator-color, #3b82f6);
    border-radius: var(--tree-drop-indicator-radius, 2px);

    &.dragcula-axis-vertical {
      height: var(--tree-drop-indicator-height, 2px);
      width: 100%;
      left: 0 !important;
    }

    &.dragcula-axis-horizontal {
      width: var(--tree-drop-indicator-width, 2px);
      height: 100%;
      top: 0 !important;
    }

    &.dragcula-axis-both {
      width: var(--tree-drop-indicator-width, 2px);
      height: var(--tree-drop-indicator-height, 2px);
      border-radius: 50%;
      background-color: var(--tree-drop-indicator-color, #3b82f6);
    }
  }
</style>