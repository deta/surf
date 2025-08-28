import { mergeAttributes, Node } from '@tiptap/core'
import { createClassComponent } from 'svelte/legacy'
import LoadingComp from './Loading.svelte'

export interface LoadingOptions {
  /**
   * The HTML attributes for a loading node.
   * @default {}
   * @example { class: 'foo' }
   */
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    loading: {
      /**
       * Toggle a loading node
       * @example editor.commands.toggleLoading()
       */
      setLoading: () => ReturnType
    }
  }
}

/**
 * This extension allows you to create loading nodes
 */
export const Loading = Node.create<LoadingOptions>({
  name: 'loading',

  priority: 1000,

  addOptions() {
    return {
      HTMLAttributes: {}
    }
  },

  addAttributes() {
    return {
      text: {
        default: '',
        parseHTML: (element) => {
          return element.getAttribute('data-text')
        },
        renderHTML: (attributes) => {
          if (!attributes.text) {
            return {}
          }

          return {
            'data-text': attributes.text
          }
        }
      }
    }
  },

  group: 'block',
  inline: false,
  atom: true,
  selectable: false,
  draggable: false,

  parseHTML() {
    return [{ tag: 'loading' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['loading', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)]
  },

  addNodeView() {
    return ({ node }) => {
      const container = document.createElement('loading')

      console.log('loading node', node)

      const component = createClassComponent({
        component: LoadingComp,
        target: container,
        props: {
          text: node.attrs.text
        }
      })

      return {
        dom: container,
        destroy: () => {
          component.$destroy()
        }
      }
    }
  },

  addCommands() {
    return {
      setLoading:
        () =>
        ({ commands }) => {
          return commands.setNode(this.name)
        }
    }
  }
})
