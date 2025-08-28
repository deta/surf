import { mergeAttributes, Node } from '@tiptap/core'
import ButtonComp from './Button.svelte'
import { createClassComponent } from 'svelte/legacy'

export interface ButtonOptions {
  /**
   * The HTML attributes for a button node.
   * @default {}
   * @example { class: 'foo' }
   */
  HTMLAttributes: Record<string, any>

  onClick?: (action: string) => void
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    button: {
      /**
       * Toggle a button node
       * @example editor.commands.toggleButton()
       */
      setButton: () => ReturnType
    }
  }
}

/**
 * This extension allows you to create button nodes
 */
export const Button = Node.create<ButtonOptions>({
  name: 'button',

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
          return {
            text: element.textContent
          }
        },
        renderHTML: (attributes) => {
          return {
            text: attributes.text
          }
        }
      },
      icon: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-icon'),
        renderHTML: (attributes) => {
          if (!attributes.icon) {
            return {}
          }

          return {
            'data-icon': attributes.icon
          }
        }
      },
      action: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-action'),
        renderHTML: (attributes) => {
          if (!attributes.action) {
            return {}
          }

          return {
            'data-action': attributes.action
          }
        }
      }
    }
  },

  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,
  draggable: false,

  parseHTML() {
    return [{ tag: 'button' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['button', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)]
  },

  addNodeView() {
    return ({ node }) => {
      const container = document.createElement('div')
      container.style.display = 'inline-block'

      const component = createClassComponent({
        component: ButtonComp,
        target: container,
        props: {
          text: node.attrs.text.text,
          icon: node.attrs.icon,
          onClick: () => {
            if (this.options.onClick) {
              this.options.onClick(node.attrs.action)
            }
          }
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
      setButton:
        () =>
        ({ commands }) => {
          return commands.setNode(this.name)
        }
    }
  }
})
