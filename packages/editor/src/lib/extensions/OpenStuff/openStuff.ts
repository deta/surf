import { mergeAttributes, Node } from '@tiptap/core'
import OpenStuffComp from './OpenStuff.svelte'
import { createClassComponent } from 'svelte/legacy'

export interface OpenStuffOptions {
  /**
   * The HTML attributes for the open stuff node.
   * @default {}
   */
  HTMLAttributes: Record<string, any>

  /**
   * Callback function when the "Open Stuff" button is clicked
   */
  onClick?: () => void
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    openStuff: {
      /**
       * Add an "Open Stuff" node
       * @example editor.commands.setOpenStuff()
       */
      setOpenStuff: () => ReturnType
    }
  }
}

/**
 * This extension creates an "Open Stuff" prompt with a button
 */
export const OpenStuff = Node.create<OpenStuffOptions>({
  name: 'openStuff',

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
    return [{ tag: 'div[data-type="open-stuff-prompt"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(
        this.options.HTMLAttributes,
        { 'data-type': 'open-stuff-prompt' },
        HTMLAttributes
      )
    ]
  },

  addNodeView() {
    return () => {
      const container = document.createElement('div')

      const component = createClassComponent({
        component: OpenStuffComp,
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
      setOpenStuff:
        () =>
        ({ commands }) => {
          return commands.setNode(this.name)
        }
    }
  }
})

export default OpenStuff
