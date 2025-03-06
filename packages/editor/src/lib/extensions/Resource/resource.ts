import { mergeAttributes, Node } from '@tiptap/core'
import ResourceComp from './Resource.svelte'
import type { ComponentType, SvelteComponent } from 'svelte'

export interface ResourceOptions {
  /**
   * The HTML attributes for a resource node.
   * @default {}
   * @example { class: 'foo' }
   */
  HTMLAttributes: Record<string, any>

  component: ComponentType<SvelteComponent>

  preview: boolean
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    resource: {
      /**
       * Toggle a resource node
       * @example editor.commands.toggleResource()
       */
      setResource: () => ReturnType
    }
  }
}

/**
 * This extension allows you to create resource nodes
 */
export const Resource = Node.create<ResourceOptions>({
  name: 'resource',

  priority: 1000,

  addOptions() {
    return {
      HTMLAttributes: {},
      component: ResourceComp,
      preview: false
    }
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('id'),
        renderHTML: (attributes) => {
          if (!attributes.id) {
            return {}
          }

          return {
            id: attributes.id
          }
        }
      },
      type: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-type'),
        renderHTML: (attributes) => {
          if (!attributes.type) {
            return {}
          }

          return {
            'data-type': attributes.type
          }
        }
      },
      expanded: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('data-expanded') === 'true',
        renderHTML: (attributes) => {
          return {
            'data-expanded': attributes.expanded ? 'true' : undefined
          }
        }
      }
    }
  },

  group: 'block',
  inline: false,
  atom: true,
  selectable: false,
  draggable: true,

  parseHTML() {
    return [{ tag: 'resource' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['resource', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)]
  },

  addNodeView() {
    return ({ node }) => {
      const container = document.createElement('resource')
      container.setAttribute('id', node.attrs.id)
      container.setAttribute('data-type', node.attrs.type)
      container.setAttribute('data-expanded', node.attrs.expanded === true ? 'true' : 'false')

      console.log('resource node', node)

      const component = new this.options.component({
        target: container,
        props: {
          id: node.attrs.id,
          type: node.attrs.type,
          preview: this.options.preview,
          expanded: node.attrs.expanded
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
      setResource:
        () =>
        ({ commands }) => {
          return commands.setNode(this.name)
        }
    }
  }
})
