<script lang="ts">
  import Renamable from '../Utils/Renamable/Renamable.svelte'
  import TreeNodeRow from './TreeNodeRow.svelte'
  import TreeGroup from './TreeGroup.svelte'
  import TreeDragItem from './TreeDragItem.svelte'
  import TreeDragZone from './TreeDragZone.svelte'
  import type { Snippet } from 'svelte'
  import type {
    BaseTreeNode,
    TreeNodeAction,
    TreeConfig,
    TreeEvents,
    TreeDragDropOperation
  } from './tree.types'
  import type { TreeStore } from './tree.store.svelte'
  import { useLogScope } from '@deta/utils'

  type TreeNodeProps<T extends BaseTreeNode = BaseTreeNode> = {
    node: T
    depth?: number
    store: TreeStore<T>
    config: TreeConfig<T>
    events?: Partial<TreeEvents<T>>
    actions?: TreeNodeAction[]
    contentRenderer?: Snippet<[T]>
    chevron?: Snippet<[{ isExpanded: boolean; isLoading: boolean; hasChildren: boolean }]>
    decorator?: Snippet<[T]>
    badge?: Snippet<[T]>
    dragHandle?: Snippet
    treeId?: string
    parent?: T
    index?: number
    class?: string
  }

  let {
    node,
    depth = 0,
    store,
    config,
    events = {},
    actions = [],
    contentRenderer,
    chevron,
    decorator,
    badge,
    dragHandle,
    treeId,
    parent,
    index = 0,
    class: className = '',
    ...restProps
  }: TreeNodeProps = $props()

  const hasChildren = $derived(store.hasChildren(node.id))
  const isExpanded = $derived(store.isExpanded(node.id))
  const isSelected = $derived(store.isSelected(node.id))
  const isLoading = $derived(store.isLoading(node.id))
  const log = useLogScope(`TreeNode ${node.id}`)

  let isRenaming = $state(false)

  function handleToggle() {
    if (hasChildren) {
      store.toggleExpanded(node.id)
    }
  }

  function handleSelect(event?: MouseEvent) {
    if (!isRenaming) {
      store.selectNode(node.id, event)
    }
  }

  function handleDoubleClick() {
    if (config.allowRename && !isLoading) {
      // Clear all selections first when starting to rename
      store.clearSelections()
      // Then start renaming
      isRenaming = true
    }
  }

  function handleRename(newLabel: string) {
    store.renameNode(node.id, newLabel)
  }

  function handleRenamableConfirm(value: string) {
    isRenaming = false
    handleRename(value)
  }

  function handleRenamableCancel() {
    isRenaming = false
  }

  const childNodes = $derived(((node.children as (typeof node)[]) || []).filter(Boolean))

  // DND handlers
  function handleDragStart(operation: TreeDragDropOperation) {
    if (events.dragStart) {
      events.dragStart(operation)
    }
  }

  function handleDragEnd(operation: TreeDragDropOperation) {
    if (events.dragEnd) {
      events.dragEnd(operation)
    }
  }

  function handleChildDrop(operation: TreeDragDropOperation) {
    log.debug(`Child drop:`, {
      source: operation.sourceNode.label,
      target: operation.targetNode?.label,
      index: operation.targetIndex,
      parent: node.label
    })

    // For drops on child nodes, we need to handle reordering within this node
    store.handleDrop({
      ...operation,
      targetParent: node
    })
  }

  function handleChildDragEnter(operation: TreeDragDropOperation) {
    log.debug(`Child drag enter:`, {
      source: operation.sourceNode.label,
      target: operation.targetNode?.label,
      index: operation.targetIndex,
      parent: node.label
    })

    if (events.dragEnter) {
      events.dragEnter(operation)
    }
  }

  function handleChildDragLeave(operation: TreeDragDropOperation) {
    log.debug(`Child drag leave:`, {
      source: operation.sourceNode.label,
      target: operation.targetNode?.label,
      index: operation.targetIndex,
      parent: node.label
    })

    if (events.dragLeave) {
      events.dragLeave(operation)
    }
  }

  function handleChildDragOver(operation: TreeDragDropOperation) {
    log.debug(`Child drag over:`, {
      source: operation.sourceNode.label,
      target: operation.targetNode?.label,
      index: operation.targetIndex,
      parent: node.label
    })

    if (events.dragOver) {
      events.dragOver(operation)
    }
  }
</script>

<TreeDragZone {node} {treeId} config={config.drag} onDrop={handleChildDrop} isRootLevel={false}>
  <TreeNodeRow
    {node}
    {depth}
    {hasChildren}
    {isExpanded}
    {isSelected}
    {isLoading}
    {config}
    {actions}
    {chevron}
    {decorator}
    {badge}
    {dragHandle}
    onToggle={handleToggle}
    onSelect={handleSelect}
    onDoubleClick={handleDoubleClick}
    class={className}
    {...restProps}
  >
    {#snippet children()}
      {#if config.allowRename && isRenaming}
        <Renamable
          value={node.label}
          onConfirm={handleRenamableConfirm}
          onCancel={handleRenamableCancel}
          placeholder="Enter name..."
          disabled={true}
          class="tree-node-renamable"
        />
      {:else if contentRenderer}
        {@render contentRenderer(node)}
      {:else}
        <span class="tree-node-label">{node.label}</span>
      {/if}
    {/snippet}
  </TreeNodeRow>
</TreeDragZone>

{#if hasChildren && childNodes.length > 0}
  <TreeGroup {isExpanded}>
    {#if config.drag?.enabled && config.drag.allowReorder}
      <TreeDragZone
        {node}
        {treeId}
        config={config.drag}
        onDrop={handleChildDrop}
        isRootLevel={false}
      >
        {#snippet children()}
          {#each childNodes as childNode, childIndex (childNode.id + childIndex)}
            <TreeDragItem
              node={childNode}
              index={childIndex}
              parent={node}
              {treeId}
              config={config.drag}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              {#snippet children()}
                <svelte:self
                  node={childNode}
                  depth={depth + 1}
                  parent={node}
                  index={childIndex}
                  {store}
                  config={{ ...config, drag: { ...config.drag, enabled: false } }}
                  {events}
                  {actions}
                  {contentRenderer}
                  {chevron}
                  {decorator}
                  {badge}
                  {dragHandle}
                  {treeId}
                  class={className}
                />
              {/snippet}
            </TreeDragItem>
          {/each}
        {/snippet}
      </TreeDragZone>
    {:else}
      {#each childNodes as childNode, childIndex (childNode.id + childIndex)}
        <svelte:self
          node={childNode}
          depth={depth + 1}
          parent={node}
          index={childIndex}
          {store}
          {config}
          {events}
          {actions}
          {contentRenderer}
          {chevron}
          {decorator}
          {badge}
          {dragHandle}
          {treeId}
          class={className}
        />
      {/each}
    {/if}
  </TreeGroup>
{/if}

<style lang="scss">
  :global(.tree-node-renamable) {
    width: 100%;
    min-width: 0;
  }

  :global(.tree-node-label) {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--tree-node-font-size, 0.875rem);
    line-height: var(--tree-node-line-height, 1.25rem);
    color: light-dark(rgba(0, 0, 0, 0.85), rgba(255, 255, 255, 0.85));
  }
</style>
