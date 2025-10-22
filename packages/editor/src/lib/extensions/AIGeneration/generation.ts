import { mergeAttributes, Node } from '@tiptap/core'

export interface AIGenerationOptions {
  /**
   * The HTML attributes for a loading node.
   * @default {}
   * @example { class: 'foo' }
   */
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    generation: {
      /**
       * Toggle a loading node
       * @example editor.commands.toggleLoading()
       */
      setAIGeneration: () => ReturnType
    }
  }
}

/**
 * This extension allows you to create prompt nodes
 */
export const AIGeneration = Node.create<AIGenerationOptions>({
  name: 'generation',

  priority: 1000,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-id'),
        renderHTML: (attributes) => {
          if (!attributes.id) {
            return {}
          }

          return {
            'data-id': attributes.id
          }
        }
      },
      status: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-status'),
        renderHTML: (attributes) => {
          if (!attributes.status) {
            return {}
          }

          return {
            'data-status': attributes.status
          }
        }
      }
    }
  },

  addOptions() {
    return {
      HTMLAttributes: {}
    }
  },

  group: 'block',

  content: 'prompt? output? loading?',

  selectable: false,

  draggable: false,

  parseHTML() {
    return [{ tag: 'generation' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['generation', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setAIGeneration:
        () =>
        ({ commands }) => {
          return commands.setNode(this.name)
        }
    }
  }
})
