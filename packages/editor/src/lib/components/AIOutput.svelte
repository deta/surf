<script lang="ts">
  import type { NodeViewProps } from '@tiptap/core'
  import { NodeViewWrapper, NodeViewContent } from 'svelte-tiptap'

  let { node, updateAttributes } = $$props
</script>

<NodeViewWrapper class="svelte-component" as="output">
  <span class="label" contenteditable="true">AI Output</span>

  <!-- Content is inserted here -->
  <NodeViewContent />
</NodeViewWrapper>
