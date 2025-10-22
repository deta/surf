<script lang="ts">
  import { HTMLDragItem, type DragculaDragEvent } from '@deta/dragcula'
  import type { BaseTreeNode, TreeDragConfig } from './tree.types'
  import { createTreeDragData, createTreeDragOperation, extractTreeDragData } from './tree.dnd'
  import type { Snippet } from 'svelte'

  type TreeDragItemProps<T extends BaseTreeNode = BaseTreeNode> = {
    node: T
    index: number
    parent?: T
    treeId?: string
    config: TreeDragConfig
    children: Snippet
    onDragStart?: (operation: any) => void
    onDragEnd?: (operation: any) => void
    class?: string
  }

  let {
    node,
    index,
    parent,
    treeId,
    config,
    children,
    onDragStart,
    onDragEnd,
    class: className = '',
    ...restProps
  }: TreeDragItemProps = $props()

  let dragItemElement = $state<HTMLElement>()

  // Check if dragging is enabled for this node
  const isDraggable = $derived(
    config.enabled &&
    node.draggable !== false &&
    (config.allowReorder || config.allowCrossNodeDrag || config.allowParentChildDrag)
  )

  function handleDragStart(event: DragculaDragEvent) {
    if (!isDraggable) {
      event.abort()
      return
    }

    // Create drag data for this tree node
    const dragData = createTreeDragData(node, index, parent, treeId)

    // Set the drag data on the drag item
    if (event.item?.data) {
      // Copy tree drag data to the drag item's data
      Object.entries(dragData.getData('tree-node') as any).forEach(([key, value]) => {
        event.item!.data.setData(key, value)
      })
    }

    // Create operation object for event handlers
    const operation = createTreeDragOperation(
      dragData.getData('tree-node') as any,
      undefined,
      undefined,
      undefined,
      'move'
    )

    // Call external drag start handler
    if (onDragStart && typeof onDragStart === 'function') {
      try {
        onDragStart(operation)
      } catch (error) {
        console.error('[TreeDragItem] Error in onDragStart handler:', error)
      }
    }

    // Mark as accepted
    event.continue()
  }

  function handleDragEnd(event: DragculaDragEvent) {
    if (!event.item?.data) return

    // Extract tree drag data
    const treeDragData = extractTreeDragData(event.item.data)
    if (!treeDragData) return

    // Create operation object for event handlers
    const operation = createTreeDragOperation(
      treeDragData,
      undefined,
      undefined,
      undefined,
      'move'
    )

    // Call external drag end handler
    if (onDragEnd && typeof onDragEnd === 'function') {
      try {
        onDragEnd(operation)
      } catch (error) {
        console.error('[TreeDragItem] Error in onDragEnd handler:', error)
      }
    }
  }
</script>

{#if isDraggable}
  <div
    bind:this={dragItemElement}
    use:HTMLDragItem.action={{
      data: createTreeDragData(node, index, parent, treeId)
    }}
    onDragStart={handleDragStart}
    onDragEnd={handleDragEnd}
    class="tree-drag-item {className}"
    draggable="true"
    {...restProps}
  >
    {@render children()}
  </div>
{:else}
  <div class="tree-drag-item tree-drag-item--disabled {className}" {...restProps}>
    {@render children()}
  </div>
{/if}

<style lang="scss">
  .tree-drag-item {
    cursor: default;
    transition: opacity 0.2s ease;

    &--disabled {
      cursor: default;
    }

    // Add visual feedback during drag
    :global([data-dragging-item]) & {
      opacity: 0.5;
    }
  }
</style>