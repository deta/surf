<script lang="ts">
  import { getContext, onMount, tick } from 'svelte'

  export let element: HTMLElement
  export let as = 'div'
  export let skipContext = false

  const TIPTAP_NODE_VIEW = 'TipTapNodeView'

  const context = skipContext ? { onDragStart: () => {} } : getContext(TIPTAP_NODE_VIEW)

  onMount(async () => {
    await tick()
    element.style.whiteSpace = 'normal'
  })
</script>

<svelte:element
  this={as}
  bind:this={element}
  data-node-view-wrapper=""
  on:dragstart={context.onDragStart}
  role="none"
  {...$$restProps}
>
  <slot />
</svelte:element>
