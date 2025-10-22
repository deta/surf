# Tree Component

A comprehensive, accessible, and customizable tree UI component built with Svelte 5 runes syntax.

## Features

### ✅ Implemented
- **Collapsible items** - Full expand/collapse functionality with state management
- **Action registration** - Support for both node and parent element actions
- **Renderless by default, skinnable** - CSS variables and slot-based customization
- **Generic tree support** - Works with any hierarchical data structure
- **Renamable nodes** - Integration with existing `@deta/services/Renamable.svelte`
- **Animated transitions** - Svelte transitions (slide/scale) with `prefers-reduced-motion` support
- **View state persistence** - KV store integration for preserving tree state
- **Loading states** - Async expand support with loading spinners
- **Accessibility** - Full ARIA support and keyboard navigation

### 🏗️ Ready for Future Enhancement
- **Drag handles** - Placeholder implementation for precise reorder (drag & drop disabled as requested)

## Component Architecture

### Core Components
- **`Tree.svelte`** - Main container with store management and API
- **`TreeNode.svelte`** - Individual nodes with recursive rendering
- **`TreeNodeRow.svelte`** - Renderless visual layout component
- **`TreeGroup.svelte`** - Collapsible group with animations

### Supporting Files
- **`tree.types.ts`** - TypeScript definitions
- **`tree.utils.ts`** - Tree manipulation utilities
- **`tree.store.ts`** - Reactive state management
- **`TreePersistence.ts`** - KV store integration

## TreeNode Anatomy

### Hit Targets
- **Chevron** - Toggle expand/collapse
- **Label** - Select/focus node
- **Empty space** - Same behavior as label

### Visual Elements
- **Badges** - Optional right-side metadata via slots
- **Inline rename** - Swaps label for input field (Esc cancels, Enter commits)
- **Loading spinner** - Replaces chevron during async operations
- **Drag handles** - Optional visual element (ready for future drag & drop)

## Animation Strategy

### Transitions
- **Expand/collapse** - `slide` transition on group container only (prevents layout jank)
- **Chevron rotation** - CSS transform with class toggle
- **Duration** - 200ms default, configurable
- **Reduced motion** - Respects `@media (prefers-reduced-motion: reduce)`

## Customization

### CSS Variables
```css
--tree-indent: 1.5rem
--tree-row-height: 2rem
--tree-selected-bg: rgba(59, 130, 246, 0.1)
--tree-hover-bg: rgba(0, 0, 0, 0.05)
/* + many more */
```

### Slots
- **`badge`** - Custom badge content
- **`chevron`** - Custom expand/collapse indicator
- **`children`** - Custom node content
- **`dragHandle`** - Custom drag handle
- **`empty`** - Empty state content

## Usage Examples

See `Tree.example.md` for comprehensive usage examples.

## Integration

The component is fully integrated into the `@deta/ui` package and follows all established patterns:
- Svelte 5 runes syntax
- `@deta/` import namespace
- Existing component conventions
- TypeScript support
- Accessibility standards