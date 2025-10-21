<script lang="ts">
  import TreeNode from './TreeNode.svelte'
  import TreeDragZone from './TreeDragZone.svelte'
  import TreeDragItem from './TreeDragItem.svelte'
  import { createTreeStore, type TreeStore } from './tree.store.svelte'
  import type { Snippet } from 'svelte'
  import type { BaseTreeNode, TreeConfig, TreeEvents, TreeNodeAction, TreeDragDropOperation } from './tree.types'

  type TreeProps<T extends BaseTreeNode = BaseTreeNode> = {
    nodes: T[]
    config?: TreeConfig<T>
    events?: Partial<TreeEvents<T>>
    actions?: TreeNodeAction[]
    store?: TreeStore<T>
    children?: Snippet<[T]>
    chevron?: Snippet<[{ isExpanded: boolean; isLoading: boolean; hasChildren: boolean }]>
    decorator?: Snippet<[T]>
    badge?: Snippet<[T]>
    dragHandle?: Snippet
    empty?: Snippet
    class?: string
    'data-tree-id'?: string
  }

  let {
    nodes,
    config = {},
    events = {},
    actions = [],
    store,
    children,
    chevron,
    decorator,
    badge,
    dragHandle,
    empty,
    class: className = '',
    'data-tree-id': treeId,
    ...restProps
  }: TreeProps = $props()

  // Create or use provided store
  const treeStore = store || createTreeStore(nodes, config, events)

  // Update store when nodes change
  $effect(() => {
    if (!store) {
      treeStore.setNodes(nodes)
    }
  })

  // Default badge snippet for showing counts
  function defaultBadge(node: BaseTreeNode) {
    const childCount = node.children?.length || 0
    return childCount > 0 ? `${childCount}` : ''
  }

  // DND event handlers
  function handleTreeDrop(operation: TreeDragDropOperation) {
    treeStore.handleDrop(operation)
  }
</script>

{#if config.drag?.enabled}
  <TreeDragZone
    treeId={treeId}
    config={config.drag}
    onDrop={handleTreeDrop}
    children={treeContentSnippet}
    class="tree {className}"
    isRootLevel={true}
    {...restProps}
  />
{:else}
  <div
    class="tree {className}"
    data-tree-id={treeId}
    role="tree"
    {...restProps}
  >
    {@render treeContentSnippet()}
  </div>
{/if}


{#snippet treeContentSnippet()}
    {#if treeStore.initialLoadComplete && treeStore.nodes.length === 0}
      <div class="tree-empty" role="status">
        {#if empty}
          {@render empty()}
        {:else}
          <span class="tree-empty-text">No items to display</span>
        {/if}
      </div>
    {:else}
      {#each treeStore.nodes as rootNode, rootIndex (rootNode.id + rootIndex)}
        {@const nodeContentRenderer = children}
        {#if config.drag?.enabled && rootNode.draggable !== false}
          <TreeDragItem
            node={rootNode}
            index={rootIndex}
            {treeId}
            config={config.drag}
            onDragStart={(op) => events.dragStart?.(op)}
            onDragEnd={(op) => events.dragEnd?.(op)}
          >
            {#snippet children()}
              <TreeNode
                node={rootNode}
                store={treeStore}
                {config}
                {events}
                {actions}
                contentRenderer={nodeContentRenderer}
                {chevron}
                {decorator}
                badge={badge || (config.showCount ? defaultBadge : undefined)}
                {dragHandle}
                {treeId}
                role="treeitem"
                tabindex={treeStore.isSelected(rootNode.id) ? 0 : -1}
                aria-expanded={treeStore.hasChildren(rootNode.id) ? treeStore.isExpanded(rootNode.id) : undefined}
                aria-selected={treeStore.isSelected(rootNode.id)}
              />
            {/snippet}
          </TreeDragItem>
        {:else}
          <TreeNode
            node={rootNode}
            store={treeStore}
            {config}
            {events}
            {actions}
            contentRenderer={nodeContentRenderer}
            {chevron}
            {decorator}
            badge={badge || (config.showCount ? defaultBadge : undefined)}
            {dragHandle}
            {treeId}
            role="treeitem"
            tabindex={treeStore.isSelected(rootNode.id) ? 0 : -1}
            aria-expanded={treeStore.hasChildren(rootNode.id) ? treeStore.isExpanded(rootNode.id) : undefined}
            aria-selected={treeStore.isSelected(rootNode.id)}
          />
        {/if}
      {/each}
    {/if}
{/snippet}

<style lang="scss">
  .tree {
    --tree-indent-size: var(--tree-indent, 1.5rem);
    --tree-node-height: var(--tree-row-height, 2rem);
    --tree-node-padding: var(--tree-row-padding, 0.25rem);
    --tree-node-gap: var(--tree-row-gap, 0.375rem);
    --tree-node-border-radius: var(--tree-row-border-radius, 0.75rem);
    --tree-node-font-size: var(--tree-font-size, 0.875rem);
    --tree-node-line-height: var(--tree-line-height, 1.25rem);
    --tree-node-hover-bg: var(--tree-hover-bg, light-dark(rgba(0, 0, 0, 0.05), rgba(255, 255, 255, 0.05)));
    --tree-node-selected-bg: var(--tree-selected-bg, light-dark(rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.2)));
    --tree-node-selected-border: var(--tree-selected-border, light-dark(rgba(59, 130, 246, 0.3), rgba(59, 130, 246, 0.4)));

    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    font-family: inherit;
    color: light-dark(rgba(0, 0, 0, 0.85), rgba(255, 255, 255, 0.85));
    outline: none;

    &:focus-within {
      outline: 2px solid light-dark(rgba(59, 130, 246, 0.5), rgba(129, 146, 255, 0.6));
      outline-offset: 2px;
      border-radius: var(--tree-node-border-radius);
    }
  }

  .tree-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    color: light-dark(rgba(0, 0, 0, 0.5), rgba(255, 255, 255, 0.5));
    font-style: italic;
  }

  .tree-empty-text {
    font-size: 0.875rem;
  }

  // Accessibility improvements
  @media (prefers-reduced-motion: reduce) {
    .tree {
      :global(*) {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
  }

  // High contrast mode support
  @media (prefers-contrast: high) {
    .tree {
      --tree-node-hover-bg: light-dark(rgba(0, 0, 0, 0.1), rgba(255, 255, 255, 0.1));
      --tree-node-selected-bg: light-dark(rgba(0, 0, 0, 0.2), rgba(255, 255, 255, 0.2));
      --tree-node-selected-border: light-dark(rgba(0, 0, 0, 0.5), rgba(255, 255, 255, 0.5));
    }
  }
</style>
