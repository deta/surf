<script lang="ts">
  import { onMount } from 'svelte'

  export let title: string = ''
  export let placeholder: string = 'Untitled'
  export let onTitleChange: ((title: string) => void) | undefined = undefined
  export let contentDOM: HTMLElement | undefined = undefined

  let contentWrapper: HTMLDivElement

  $: isEmpty = !title || title.trim() === ''

  onMount(() => {
    if (contentDOM && contentWrapper) {
      contentWrapper.appendChild(contentDOM)
    }
  })

  $: if (contentDOM && contentWrapper) {
    contentWrapper.appendChild(contentDOM)
  }
</script>

<div class="title-node-container">
  <div
    class="title-node"
    class:empty={isEmpty}
    data-title-node=""
    data-placeholder={isEmpty ? placeholder : ''}
  >
    <div bind:this={contentWrapper} class="content-wrapper"></div>
  </div>
</div>

<style lang="scss">
  .title-node-container {
    position: relative;
  }

  .title-node {
    position: relative;
    min-height: 2.7rem;

    &.empty::before {
      content: attr(data-placeholder);
      color: var(--text-muted, #9ca3af);
      font-weight: inherit;
      pointer-events: none;
      position: absolute;
      top: 0.5rem;
      left: 0;
      font-size: 2.25rem;
      line-height: 1.2;
      font-weight: 500;
    }
  }

  .content-wrapper {
    /* Style the TipTap content */
    :global(h1),
    :global(div) {
      font-size: 2.25rem !important;
      font-weight: 450 !important;
      line-height: 1.2 !important;
      margin: 0 !important;
      padding: 0.5rem 0 !important;
      border: none !important;
      outline: none !important;
      color: var(--text-primary, #1a1a1a) !important;
      background: transparent !important;
      font-family: inherit !important;
      transition: all 0.2s ease !important;

      cursor: text !important;

      appearance: none !important;

      &:focus {
        outline: none !important;
      }

      &::selection {
        background-color: var(--selection-bg, rgba(59, 130, 246, 0.15)) !important;
      }

      text-rendering: optimizeLegibility !important;
      -webkit-font-smoothing: antialiased !important;
      -moz-osx-font-smoothing: grayscale !important;
    }
  }
</style>
