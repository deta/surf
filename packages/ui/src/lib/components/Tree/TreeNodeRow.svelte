<script lang="ts">
  import { Icon } from '@deta/icons'
  import type { Snippet } from 'svelte'
  import type { BaseTreeNode, TreeNodeAction, TreeConfig } from './tree.types'

  type TreeNodeRowProps<T extends BaseTreeNode = BaseTreeNode> = {
    node: T
    depth: number
    hasChildren: boolean
    isExpanded: boolean
    isSelected: boolean
    isLoading: boolean
    config?: TreeConfig<T>
    onToggle?: () => void
    onSelect?: (event?: MouseEvent) => void
    onDoubleClick?: () => void
    actions?: TreeNodeAction[]
    children?: Snippet
    chevron?: Snippet<[{ isExpanded: boolean; isLoading: boolean; hasChildren: boolean }]>
    decorator?: Snippet<[T]>
    badge?: Snippet<[T]>
    dragHandle?: Snippet
    class?: string
  }

  let {
    node,
    depth = 0,
    hasChildren = false,
    isExpanded = false,
    isSelected = false,
    isLoading = false,
    config,
    onToggle,
    onSelect,
    onDoubleClick,
    actions = [],
    children,
    chevron,
    decorator,
    badge,
    dragHandle,
    class: className = '',
    ...restProps
  }: TreeNodeRowProps = $props()

  let isHovered = $state(false)
  const indentStyle = `margin-left: calc(${depth} * var(--tree-indent-size, 1.5rem))`
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="tree-node-row {className}"
  class:selected={isSelected}
  class:expanded={isExpanded}
  class:has-children={hasChildren}
  class:loading={isLoading}
  style={indentStyle}
  onmouseenter={() => isHovered = true}
  onmouseleave={() => isHovered = false}
  {...restProps}
>
  <!-- Drag Handle (optional) -->
  {#if dragHandle}
    <div class="tree-node-drag-handle">
      {@render dragHandle()}
    </div>
  {/if}

  <!-- Chevron/Toggle with optional Decorator swap -->
  <div 
    class="tree-node-chevron" 
    class:disabled={!hasChildren}
    class:has-decorator={decorator !== undefined}
    onclick={hasChildren ? onToggle : undefined} 
    role="button" 
    tabindex={hasChildren ? 0 : -1}
  >
    {#if decorator && (!isHovered || !hasChildren)}
      <!-- Show decorator when not hovering OR when node has no children -->
      <div class="tree-node-decorator">
        {@render decorator(node)}
      </div>
    {:else if chevron}
      <!-- Custom chevron snippet -->
      {@render chevron({ isExpanded, isLoading, hasChildren })}
    {:else if isLoading}
      <!-- Loading spinner -->
      <div class="tree-node-spinner" aria-label="Loading...">
        <Icon name="loader" size="14" />
      </div>
    {:else if hasChildren}
      <!-- Default chevron for nodes with children -->
      <div class="tree-node-chevron-icon" class:expanded={isExpanded}>
        <Icon name="chevron.right" size="14" />
      </div>
    {:else}
      <!-- Disabled chevron for leaf nodes -->
      <div class="tree-node-chevron-icon disabled">
        <Icon name="chevron.right" size="14" />
      </div>
    {/if}
  </div>

  <!-- Node Content/Label -->
  <div
    class="tree-node-content"
    onclick={(e) => onSelect?.(e)}
    ondblclick={onDoubleClick}
    role="button"
    tabindex="0"
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onSelect?.()
      }
    }}
  >
    {#if children}
      {@render children()}
    {:else}
      <span class="tree-node-label">{node.label}</span>
    {/if}
  </div>

  <!-- Actions (optional) - positioned before count -->
  {#if actions.length > 0}
    {@const visibleActions = actions.filter(action => 
      typeof action.disabled === 'function' ? !action.disabled(node) : !action.disabled
    )}
    {#if visibleActions.length > 0}
      <div class="tree-node-actions">
        {#each visibleActions as action, i (action.label + i)}
          <button
            type="button"
            class="tree-node-action"
            onclick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              action.action(node)
            }}
            title={action.label}
          >
            {#if action.icon}
              <Icon name={action.icon} size="14" />
            {:else}
              {action.label}
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  {/if}

  <!-- Count (optional) -->
  {#if config?.showCount && node.count !== undefined}
    <div class="tree-node-count" class:empty={!hasChildren}>
      <span class="tree-node-count-value">{node.count}</span>
    </div>
  {/if}

  <!-- Badge (optional) -->
  {#if badge}
    <div class="tree-node-badge">
      {@render badge(node)}
    </div>
  {/if}
</div>

<style lang="scss">
  .tree-node-row {
    --tree-row-height: var(--tree-node-height, 2rem);
    --tree-row-padding: var(--tree-node-padding, 0.25rem);
    --tree-hover-bg: var(--tree-node-hover-bg, rgba(0, 0, 0, 0.05));
    --tree-selected-bg: var(--tree-node-selected-bg, rgba(59, 130, 246, 0.1));
    --tree-selected-border: var(--tree-node-selected-border, rgba(59, 130, 246, 0.3));

    display: flex;
    align-items: center;
    min-height: var(--tree-row-height);
    padding: var(--tree-row-padding);
    gap: var(--tree-node-gap, 0.375rem);
    border-radius: var(--tree-node-border-radius, 0.75rem);
    position: relative;
    user-select: none;
    color: light-dark(rgba(0, 0, 0, 0.85), rgba(255, 255, 255, 0.85));

    &:hover:not(.selected) {
      background-color: var(--tree-hover-bg);
    }

    &.selected {
      background-color: var(--tree-selected-bg);
    }

    &.loading {
      opacity: 0.7;
    }
  }

  .tree-node-drag-handle {
    display: flex;
    align-items: center;
    cursor: default;
    opacity: 0.5;

    &:hover {
      opacity: 1;
    }

  }

  .tree-node-chevron {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 0.125rem;
    padding-left: 0.5rem;
    cursor: default;
    flex-shrink: 0;
    color: light-dark(rgba(0, 0, 0, 0.6), rgba(255, 255, 255, 0.6));
    
    &:hover:not(.disabled) {
      color: light-dark(rgba(0, 0, 0, 0.85), rgba(255, 255, 255, 0.85));
    }
    
    &.disabled:not(.has-decorator) {
      cursor: default;
      opacity: 0.0;
      pointer-events: none;
    }
    
    &.has-decorator {
      cursor: default;
    }
  }

  .tree-node-decorator {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  .tree-node-chevron-icon {
    transition: transform 150ms ease-out;
    display: flex;
    align-items: center;
    justify-content: center;

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }

    &.expanded {
      transform: rotate(90deg);
    }
  }

  .tree-node-chevron-placeholder {
    width: 14px;
    height: 14px;
  }

  .tree-node-spinner {
    display: flex;
    align-items: center;
    justify-content: center;
    animation: spin 1s linear infinite;
    color: light-dark(rgba(0, 0, 0, 0.6), rgba(255, 255, 255, 0.6));

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  }

  .tree-node-content {
    flex: 1;
    min-width: 0;
    padding: 0.125rem 0.25rem;
    border-radius: 0.125rem;
    cursor: default;

    &:focus {
      outline: none;
      background-color: light-dark(rgba(0, 0, 0, 0.05), rgba(255, 255, 255, 0.05));
    }
  }

  .tree-node-label {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--tree-node-font-size, 0.875rem);
    line-height: var(--tree-node-line-height, 1.25rem);
    color: light-dark(rgba(0, 0, 0, 0.85), rgba(255, 255, 255, 0.85));
  }

  .tree-node-count {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    margin-left: 0.5rem;
    &.empty {
      display: none;
    }
  }

  .tree-node-count-value {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.25rem;
    height: 1.125rem;
    padding: 0 0.125rem;
    font-size: 0.6rem;
    font-weight: 500;
    line-height: 1;
    color: light-dark(rgba(0, 0, 0, 0.6), rgba(255, 255, 255, 0.7));
    background: light-dark(
      linear-gradient(to bottom, rgba(210, 226, 255, 0.3), rgba(210, 226, 255, 0.45)),
      linear-gradient(to bottom, rgba(210, 226, 255, 0.08), rgba(210, 226, 255, 0.14))
    );
    border-radius: 0.5rem;
    white-space: nowrap;
  }

  .tree-node-badge {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    margin-left: auto;
  }

  .tree-node-actions {
    display: flex;
    align-items: center;
    gap: 0.125rem;
    opacity: 0;
    transition: opacity 78ms ease-out;
          border-radius: 6px;


    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }

    .tree-node-row:hover & {
      opacity: 1;
    }
  }

  .tree-node-action {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border: none;
    background: transparent;
    cursor: default;
    color: light-dark(rgba(0, 0, 0, 0.7), rgba(255, 255, 255, 0.7));

    &:hover {
      border-radius: 6px;
      background-color: light-dark(rgba(0, 0, 0, 0.1), rgba(255, 255, 255, 0.1));
    }

    &:focus {
      outline: none;
      background-color: light-dark(rgba(0, 0, 0, 0.15), rgba(255, 255, 255, 0.15));
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
