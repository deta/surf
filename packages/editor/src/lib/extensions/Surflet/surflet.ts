import { mergeAttributes, Node } from '@tiptap/core'
import type { ComponentType, SvelteComponent } from 'svelte'
import { createClassComponent } from 'svelte/legacy'

export interface SurfletOptions {
  HTMLAttributes: Record<string, any>
  component?: ComponentType<SvelteComponent>
}

export const Surflet = Node.create<SurfletOptions>({
  name: 'surflet',
  group: 'block',
  code: true,
  selectable: false,
  isolating: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      component: undefined
    }
  },

  addAttributes() {
    return {
      resourceId: {
        default: null,
        parseHTML: (element) => {
          return element.getAttribute('data-resource-id')
        },
        renderHTML: (attributes) => {
          if (!attributes.resourceId) {
            return {}
          }

          return {
            'data-resource-id': attributes.resourceId
          }
        }
      },
      prompt: {
        default: null,
        parseHTML: (element) => {
          return element.getAttribute('data-prompt')
        },
        renderHTML: (attributes) => {
          if (!attributes.prompt) {
            return {}
          }
          return {
            'data-prompt': attributes.prompt
          }
        }
      },
      done: {
        default: 'false',
        parseHTML: (element) => {
          return element.getAttribute('data-done')
        },
        renderHTML: (attributes) => {
          return {
            'data-done': attributes.done === 'true' ? 'true' : 'false'
          }
        }
      },
      name: {
        default: 'Surflet',
        parseHTML: (element) => {
          return element.getAttribute('data-name')
        },
        renderHTML: (attributes) => {
          if (!attributes.name) {
            return {}
          }
          return {
            'data-name': attributes.name
          }
        }
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'surflet'
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['surflet', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)]
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const container = document.createElement('div')
      if (!this.options.component) {
        return {
          dom: container
        }
      }

      const updateAttributes = (attrs: Record<string, any>) => {
        if (typeof getPos !== 'function') {
          console.warn('getPos is not a function, cannot update attributes')
          return
        }

        try {
          const pos = getPos()

          if (pos === undefined || pos === null || pos < 0) {
            console.warn('Invalid position returned by getPos:', pos)
            return
          }

          const docSize = editor.view.state.doc.content.size
          if (pos >= docSize) {
            console.warn('Position out of bounds:', pos, 'doc size:', docSize)
            return
          }
          const nodeAtPos = editor.view.state.doc.nodeAt(pos)
          if (!nodeAtPos || nodeAtPos.type.name !== 'surflet') {
            console.warn('Node not found or wrong type at position:', pos)
            return
          }
          const newAttrs = { ...node.attrs, ...attrs }
          const tr = editor.view.state.tr.setNodeMarkup(pos, undefined, newAttrs)
          editor.view.dispatch(tr)
          console.debug('Node attributes updated successfully at position to:', pos, newAttrs)
        } catch (error) {
          console.error('Error updating node attributes:', error)
        }
      }

      const component = createClassComponent({
        component: this.options.component,
        target: container,
        props: {
          updateAttributes,
          ...node.attrs
        }
      })

      return {
        dom: container,
        destroy: () => {
          component.$destroy()
        }
      }
    }
  }
})
