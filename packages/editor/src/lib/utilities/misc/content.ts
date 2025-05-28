/// Hold different utility functions which query the editor content state

import { Editor } from '@tiptap/core'
import { Node as ProseMirrorNode } from 'prosemirror-model'

/**
 * Checks if the editor is effectively empty or has only one block node with content
 */
export function isEditorEffectivelyEmpty(editor: Editor): boolean {
  if (!editor?.state) return true

  const doc = editor.state.doc
  let blockNodesWithContent = 0

  // Function to check if a node has content
  function hasContent(node: ProseMirrorNode): boolean {
    // Check for text content
    if (node.textContent.trim().length > 0) return true

    // Check for other content types (images, horizontal rules, etc.)
    // TODO: (maxu) Add other nodes?
    if (node.type.name === 'image' || node.type.name === 'horizontalRule') return true

    // Check for nodes with meaningful attributes
    if (node.attrs && (node.attrs.src || node.attrs.href)) return true

    return false
  }

  // Find content-containing block nodes
  doc.descendants((node: ProseMirrorNode) => {
    // Only check block-level nodes (not the doc node itself)
    if (node.type.isBlock && node.type.name !== 'doc') {
      if (hasContent(node)) {
        blockNodesWithContent++

        // Early exit if we've found more than one block with content
        if (blockNodesWithContent > 1) return false
      }
    }

    return true
  })

  return blockNodesWithContent <= 1
}
