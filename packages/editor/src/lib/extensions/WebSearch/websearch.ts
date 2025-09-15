import { mergeAttributes, Node } from '@tiptap/core'
import type { ComponentType, SvelteComponent } from 'svelte'
import { createClassComponent } from 'svelte/legacy'
import type { LinkClickHandler } from '@deta/editor/src/lib/extensions/Link/helpers/clickHandler'

export interface WebSearchOptions {
  HTMLAttributes: Record<string, any>
  component?: ComponentType<SvelteComponent>
  onWebSearchCompleted?: (results: any, query: string) => void
  onLinkClick?: LinkClickHandler
}

export const WebSearch = Node.create<WebSearchOptions>({
  name: 'websearch',
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
      query: {
        default: null,
        parseHTML: (element) => {
          return element.getAttribute('data-query')
        },
        renderHTML: (attributes) => {
          if (!attributes.query) {
            return {}
          }
          return {
            'data-query': attributes.query
          }
        }
      },
      results: {
        default: null,
        parseHTML: (element) => {
          const results = element.getAttribute('data-results')
          return results ? JSON.parse(results) : null
        },
        renderHTML: (attributes) => {
          if (!attributes.results) {
            return {}
          }
          return {
            'data-results': JSON.stringify(attributes.results)
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
        default: 'Web Search',
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
      },
      limit: {
        default: 5,
        parseHTML: (element) => {
          const limit = element.getAttribute('data-limit')
          return limit ? parseInt(limit, 10) : 5
        },
        renderHTML: (attributes) => {
          return {
            'data-limit': attributes.limit?.toString() || '5'
          }
        }
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'websearch'
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['websearch', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)]
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
          if (!nodeAtPos || nodeAtPos.type.name !== 'websearch') {
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

      const onWebSearchCompleted = this.options.onWebSearchCompleted
      const onLinkClick = this.options.onLinkClick
      const component = createClassComponent({
        component: this.options.component,
        target: container,
        props: {
          updateAttributes,
          onWebSearchCompleted,
          onLinkClick,
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
