import { mergeAttributes, Node } from '@tiptap/core'
import UseAsDefaultBrowserComp from './UseAsDefaultBrowser.svelte'
import { createClassComponent } from 'svelte/legacy'

export interface UseAsDefaultBrowserOptions {
  /**
   * The HTML attributes for the default browser node.
   * @default {}
   */
  HTMLAttributes: Record<string, any>

  /**
   * Callback function when the "Set as Default" button is clicked
   */
  onClick?: () => void
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    useAsDefaultBrowser: {
      /**
       * Add a "Use as Default Browser" node
       * @example editor.commands.setUseAsDefaultBrowser()
       */
      setUseAsDefaultBrowser: () => ReturnType
    }
  }
}

/**
 * This extension creates a "Use as Default Browser" prompt with a button
 */
export const UseAsDefaultBrowser = Node.create<UseAsDefaultBrowserOptions>({
  name: 'useAsDefaultBrowser',

  priority: 1000,

  addOptions() {
    return {
      HTMLAttributes: {}
    }
  },

  group: 'block',
  inline: false,
  atom: true,
  selectable: false,
  draggable: false,

  parseHTML() {
    return [{ tag: 'div[data-type="default-browser-prompt"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(
        this.options.HTMLAttributes,
        { 'data-type': 'default-browser-prompt' },
        HTMLAttributes
      )
    ]
  },

  addNodeView() {
    return () => {
      const container = document.createElement('div')

      const component = createClassComponent({
        component: UseAsDefaultBrowserComp,
        target: container,
        props: {
          onClick: () => {
            if (this.options.onClick) {
              this.options.onClick()
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
      setUseAsDefaultBrowser:
        () =>
        ({ commands }) => {
          return commands.setNode(this.name)
        }
    }
  }
})
