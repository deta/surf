import { mergeAttributes, Node } from '@tiptap/core'
import { SvelteNodeViewRenderer } from 'svelte-tiptap'
import AiOutput from '../../components/AIOutput.svelte'

export interface AIOutputOptions {
  /**
   * The HTML attributes for a loading node.
   * @default {}
   * @example { class: 'foo' }
   */
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    output: {
      /**
       * Toggle a loading node
       * @example editor.commands.toggleLoading()
       */
      setAIOutput: () => ReturnType
    }
  }
}

/**
 * This extension allows you to create loading nodes
 */
export const AIOutput = Node.create<AIOutputOptions>({
  name: 'output',

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
      tooltipTarget: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-tooltip-target'),
        renderHTML: (attributes) => {
          if (!attributes.tooltipTarget) {
            return {}
          }

          return {
            'data-tooltip-target': attributes.tooltipTarget
          }
        }
      },
      prompt: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-prompt'),
        renderHTML: (attributes) => {
          if (!attributes.prompt) {
            return {}
          }

          return {
            'data-prompt': attributes.prompt
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

  content: 'block*',

  selectable: true,

  draggable: true,

  defining: true,

  parseHTML() {
    return [{ tag: 'output' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['output', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setAIOutput:
        () =>
        ({ commands }) => {
          return commands.setNode(this.name)
        }
    }
  }
})
