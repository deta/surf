import { mergeAttributes, Node } from '@tiptap/core'
import ThinkingComp from './Thinking.svelte'
import { SvelteNodeViewRenderer } from 'svelte-tiptap'

export interface ThinkingOptions {
  /**
   * The HTML attributes for a thinking node.
   * @default {}
   * @example { class: 'foo' }
   */
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    thinking: {
      /**
       * Toggle a thinking node
       * @example editor.commands.toggleThinking()
       */
      setThinking: () => ReturnType
    }
  }
}

/**
 * This extension allows you to create thinking nodes
 */
export const Thinking = Node.create<ThinkingOptions>({
  name: 'thinking',

  priority: 1000,

  addOptions() {
    return {
      HTMLAttributes: {}
    }
  },

  addAttributes() {
    return {
      expanded: {
        default: false,
        parseHTML: (element) => {
          return {
            expanded: element.getAttribute('expanded') === 'true'
          }
        },
        renderHTML: (attributes) => {
          return {
            expanded: attributes.expanded ? 'true' : 'false'
          }
        }
      }
    }
  },

  group: 'block',
  content: 'block*',
  draggable: true,

  parseHTML() {
    return [{ tag: 'think' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['think', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },

  addNodeView() {
    return SvelteNodeViewRenderer(ThinkingComp)
  }
})
