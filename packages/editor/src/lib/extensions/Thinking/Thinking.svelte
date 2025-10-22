<script lang="ts">
  import { NodeViewWrapper } from 'svelte-tiptap'
  import { Icon } from '@deta/icons'

  export let expanded = false
  export let selected = false
</script>

<NodeViewWrapper
  id="svelte-component"
  data-selected={selected}
  class="tiptap-thinking"
  data-drag-handle=""
>
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="header" on:click={() => (expanded = !expanded)} contenteditable="false">
    <Icon name="chevron.right" size="16px" className="{expanded ? 'rotate-90' : ''} transition" />
    <div>Reasoning</div>
  </div>

  <div class="content-wrapper" class:expanded contenteditable="false">
    <div class="content Prosemirror" data-node-view-content="" contenteditable={expanded}>
      <slot />
    </div>
  </div>
</NodeViewWrapper>

<style lang="scss">
  :global(.tiptap-thinking) {
    width: 100%;
    opacity: 0.75;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: default;
    font-size: 0.9em;
    font-weight: 450;
    letter-spacing: 0.01em;
  }

  .content-wrapper {
    border-radius: 10px;
    border: 1px dashed #ccc;
    max-height: 0;
    opacity: 0;
    transition: all 0.2s ease-in-out;
    pointer-events: none;
    user-select: none;

    &.expanded {
      margin-top: 0.5rem;
      max-height: 1000px;
      height: auto;
      overflow: auto;
      opacity: 1;
      pointer-events: auto;
      user-select: unset;
    }
  }

  .content {
    font-size: 0.9em;
    letter-spacing: 0.01em;
    padding: 1rem;
    height: 100%;
    width: 100%;
    white-space: unset !important;

    &:focus {
      outline: none;
    }
  }
</style>
