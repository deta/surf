<script lang="ts">
  import { slide } from 'svelte/transition'
  import type { Snippet } from 'svelte'

  type TreeGroupProps = {
    isExpanded: boolean
    children: Snippet
    duration?: number
    class?: string
  }

  let {
    isExpanded,
    children,
    duration = 200,
    class: className = '',
    ...restProps
  }: TreeGroupProps = $props()
</script>

{#if isExpanded}
  <div
    class="tree-group {className}"
    transition:slide={{ duration }}
    {...restProps}
  >
    {@render children()}
  </div>
{/if}

<style lang="scss">
  .tree-group {
    overflow: hidden;

    @media (prefers-reduced-motion: reduce) {
      :global([data-tree-group]) {
        transition: none !important;
      }
    }
  }
</style>