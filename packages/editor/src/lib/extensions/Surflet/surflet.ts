import { mergeAttributes, Node } from '@tiptap/core'
import type { ComponentType, SvelteComponent } from 'svelte'

export interface SurfletOptions {
  HTMLAttributes: Record<string, any>
  component?: ComponentType<SvelteComponent>
}

export const Surflet = Node.create<SurfletOptions>({
  name: 'surflet',
  group: 'block',
  code: true,
  selectable: false,

  addOptions() {
    return {
      HTMLAttributes: {},
      component: undefined
    }
  },

  addAttributes() {
    return {
      codeContent: {
        default: '',
        parseHTML: (element) => element.innerText || ''
      },
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

  renderHTML({ node, HTMLAttributes }) {
    return [
      'surflet',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      ['code', {}, node.attrs.codeContent]
    ]
  },

  addNodeView() {
    return ({ node }) => {
      const container = document.createElement('div')
      if (!this.options.component) {
        return {
          dom: container
        }
      }
      const component = new this.options.component({
        target: container,
        props: {
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
