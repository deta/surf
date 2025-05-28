import { mergeAttributes, Node } from '@tiptap/core'

export interface AIPromptOptions {
  /**
   * The HTML attributes for a loading node.
   * @default {}
   * @example { class: 'foo' }
   */
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    prompt: {
      /**
       * Toggle a loading node
       * @example editor.commands.toggleLoading()
       */
      setAIPrompt: () => ReturnType
    }
  }
}

/**
 * This extension allows you to create prompt nodes
 */
export const AIPrompt = Node.create<AIPromptOptions>({
  name: 'prompt',

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
      }
    }
  },

  addOptions() {
    return {
      HTMLAttributes: {}
    }
  },

  group: 'block',

  content: 'inline*',

  selectable: true,

  draggable: true,

  parseHTML() {
    return [{ tag: 'prompt' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['prompt', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setAIPrompt:
        () =>
        ({ commands }) => {
          return commands.setNode(this.name)
        }
    }
  }
})
