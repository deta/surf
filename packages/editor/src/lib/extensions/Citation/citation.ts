import { Node, nodePasteRule } from '@tiptap/core'
import type { ComponentType, SvelteComponent } from 'svelte'
import { createClassComponent } from 'svelte/legacy'

export interface CitationOptions {
  /**
   * The HTML attributes for a loading node.
   * @default {}
   * @example { class: 'foo' }
   */
  HTMLAttributes: Record<string, any>

  component?: ComponentType<SvelteComponent>

  onClick?: (event: CustomEvent<any>) => void
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    citation: {
      /**
       * Set a citation node
       * @example editor.commands.setCitation()
       */
      setCitation: () => ReturnType
    }
  }
}

export const Citation = Node.create<CitationOptions>({
  name: 'citation',

  group: 'inline',
  inline: true,
  atom: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      component: undefined,
      onClick: undefined
    }
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.textContent
      },
      info: {
        default: null,
        parseHTML: (element) => {
          let rawData = element.getAttribute('data-info')
          if (rawData) {
            return JSON.parse(decodeURIComponent(rawData))
          }
        }
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'citation'
      }
    ]
  },

  renderHTML({ node }) {
    return [
      'citation',
      {
        'data-id': node.attrs.id,
        'data-info': encodeURIComponent(JSON.stringify(node.attrs.info)),
        ...node.attrs
      },
      node.attrs.id
    ]
  },

  addNodeView() {
    return ({ node }) => {
      const container = document.createElement('span')
      container.setAttribute('data-citation-id', node.attrs.id)
      if (!this.options.component || (!node?.attrs?.info?.renderID && !node?.attrs?.source)) {
        return {
          dom: container
        }
      }

      const component = createClassComponent({
        component: this.options.component,
        target: container,
        props: {
          ...node.attrs
        }
      })

      component.$on('click', (event: CustomEvent<any>) => {
        if (this.options.onClick) {
          this.options.onClick(event)
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

  addPasteRules() {
    return [
      nodePasteRule({
        // reges for <resource id=""></resource> tags
        find: /<citation>([^<]+)<\/citation>/g,
        type: this.type
      })
    ]
  }
})
