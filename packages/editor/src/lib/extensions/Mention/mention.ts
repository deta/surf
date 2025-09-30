import { Editor, mergeAttributes, Node, type Range } from '@tiptap/core'
import { type DOMOutputSpec, Node as ProseMirrorNode } from '@tiptap/pm/model'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion, { type SuggestionOptions } from '../../utilities/Suggestion'
import { mount, unmount } from 'svelte'

import MentionComp from './Mention.svelte'
import type { MentionItem } from '../../types'
import type { MentionAction } from '@deta/types'
import { createClassComponent } from 'svelte/legacy'

// See `addAttributes` below
export interface MentionNodeAttrs {
  /**
   * The identifier for the selected item that was mentioned, stored as a `data-id`
   * attribute.
   */
  id: string | null
  /**
   * The label to be rendered by the editor as the displayed text for this mentioned
   * item, if provided. Stored as a `data-label` attribute. See `renderLabel`.
   */
  label?: string | null

  /**
   * The type of the mention, stored as a `data-type` attribute.
   */
  mentionType?: string | null

  /**
   * The icon to be rendered by the editor as the displayed icon for this mentioned
   * item, if provided. Stored as a `data-icon` attribute.
   */
  icon?: string | null

  /**
   * The favicon URL for tab mentions, stored as a `data-favicon-url` attribute.
   */
  faviconURL?: string | null
}

export type MentionOptions<
  SuggestionItem = any,
  Attrs extends Record<string, any> = MentionNodeAttrs
> = {
  /**
   * The HTML attributes for a mention node.
   * @default {}
   * @example { class: 'foo' }
   */
  HTMLAttributes: Record<string, any>

  /**
   * A function to render the label of a mention.
   * @deprecated use renderText and renderHTML instead
   * @param props The render props
   * @returns The label
   * @example ({ options, node }) => `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`
   */
  renderLabel?: (props: {
    options: MentionOptions<SuggestionItem, Attrs>
    node: ProseMirrorNode
  }) => string

  /**
   * A function to render the text of a mention.
   * @param props The render props
   * @returns The text
   * @example ({ options, node }) => `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`
   */
  renderText: (props: {
    options: MentionOptions<SuggestionItem, Attrs>
    node: ProseMirrorNode
  }) => string

  /**
   * A function to render the HTML of a mention.
   * @param props The render props
   * @returns The HTML as a ProseMirror DOM Output Spec
   * @example ({ options, node }) => ['span', { 'data-type': 'mention' }, `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`]
   */
  renderHTML: (props: {
    options: MentionOptions<SuggestionItem, Attrs>
    node: ProseMirrorNode
  }) => DOMOutputSpec

  /**
   * Whether to delete the trigger character with backspace.
   * @default false
   */
  deleteTriggerWithBackspace: boolean

  /**
   * The suggestion options.
   * @default {}
   * @example { char: '@', pluginKey: MentionPluginKey, command: ({ editor, range, props }) => { ... } }
   */
  suggestion: Omit<SuggestionOptions<SuggestionItem, MentionItem>, 'editor'>

  onClick?: (item: MentionItem, action: MentionAction) => void

  onInsert?: (item: MentionItem) => void

  readOnly?: boolean
}

/**
 * The plugin key for the mention plugin.
 * @default 'mention'
 */
export const MentionPluginKey = new PluginKey('mention')

/**
 * This extension allows you to insert mentions into the editor.
 * @see https://www.tiptap.dev/api/extensions/mention
 */
export const Mention = Node.create<MentionOptions>({
  name: 'mention',

  priority: 101,

  addOptions() {
    return {
      HTMLAttributes: {},
      renderText({ options, node }) {
        return `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`
      },
      deleteTriggerWithBackspace: false,
      renderHTML({ options, node }) {
        return [
          'span',
          mergeAttributes(this.HTMLAttributes, options.HTMLAttributes),
          `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`
        ]
      },
      suggestion: {
        char: '@',
        pluginKey: MentionPluginKey,
        preventReTrigger: true,
        dismissOnSpace: true,
        placeholder: 'Search for a tab, notebook or source…',
        command: ({ editor, range, props }) => {
          // increase range.to by one when the next node is of type "text"
          // and starts with a space character
          const nodeAfter = editor.view.state.selection.$to.nodeAfter
          const overrideSpace = nodeAfter?.text?.startsWith(' ')

          if (overrideSpace) {
            range.to += 1
          }

          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              {
                type: this.name,
                attrs: {
                  id: props.id,
                  label: props.label,
                  mentionType: props.type,
                  icon: props.icon,
                  faviconURL: props.faviconURL
                }
              },
              {
                type: 'text',
                text: ' '
              }
            ])
            .run()

          // get reference to `window` object from editor element, to support cross-frame JS usage
          editor.view.dom.ownerDocument.defaultView?.getSelection()?.collapseToEnd()

          const extension = editor.extensionManager.extensions.find(
            (extension) => extension.name === this.name
          )
          if (extension && extension.options.onInsert) {
            extension.options.onInsert({
              id: props.id,
              label: props.label,
              type: props.type,
              icon: props.icon
            } as MentionItem)
          }
        },
        allow: ({ state, range, editor }) => {
          const $from = state.doc.resolve(range.from)
          const type = state.schema.nodes[this.name]
          const allow = !!$from.parent.type.contentMatch.matchType(type)

          const extension = editor.extensionManager.extensions.find(
            (extension) => extension.name === this.name
          )

          if (extension && extension.options.readOnly) {
            return false
          }

          return allow
        }
      }
    }
  },

  group: 'inline',

  inline: true,

  selectable: false,

  atom: true,

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

      label: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-label'),
        renderHTML: (attributes) => {
          if (!attributes.label) {
            return {}
          }

          return {
            'data-label': attributes.label
          }
        }
      },

      mentionType: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-mention-type'),
        renderHTML: (attributes) => {
          if (!attributes.mentionType) {
            return {}
          }

          return {
            'data-mention-type': attributes.mentionType
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

      faviconURL: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-favicon-url'),
        renderHTML: (attributes) => {
          if (!attributes.faviconURL) {
            return {}
          }

          return {
            'data-favicon-url': attributes.faviconURL
          }
        }
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: `span[data-type="${this.name}"]`
      }
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    if (this.options.renderLabel !== undefined) {
      console.warn('renderLabel is deprecated use renderText and renderHTML instead')
      return [
        'span',
        mergeAttributes({ 'data-type': this.name }, this.options.HTMLAttributes, HTMLAttributes),
        this.options.renderLabel({
          options: this.options,
          node
        })
      ]
    }
    const mergedOptions = { ...this.options }

    mergedOptions.HTMLAttributes = mergeAttributes(
      { 'data-type': this.name },
      this.options.HTMLAttributes,
      HTMLAttributes
    )
    const html = this.options.renderHTML({
      options: mergedOptions,
      node
    })

    if (typeof html === 'string') {
      return [
        'span',
        mergeAttributes({ 'data-type': this.name }, this.options.HTMLAttributes, HTMLAttributes),
        html
      ]
    }
    return html
  },

  renderText({ node }) {
    if (this.options.renderLabel !== undefined) {
      console.warn('renderLabel is deprecated use renderText and renderHTML instead')
      return this.options.renderLabel({
        options: this.options,
        node
      })
    }
    return this.options.renderText({
      options: this.options,
      node
    })
  },

  addNodeView() {
    return ({ node }) => {
      const container = document.createElement('span')

      const component = mount(MentionComp, {
        target: container,
        props: {
          id: node.attrs.id,
          label: node.attrs.label ?? node.attrs.id,
          char: this.options.suggestion.char,
          type: node.attrs.mentionType || node.attrs.type,
          icon: node.attrs.icon,
          faviconURL: node.attrs.faviconURL,
          onClick: this.options.onClick,
          ...this.options.HTMLAttributes
        }
      })

      return {
        dom: container,
        destroy: () => {
          unmount(component)
        }
      }
    }
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () =>
        this.editor.commands.command(({ tr, state }) => {
          let isMention = false
          const { selection } = state
          const { empty, anchor } = selection

          if (!empty) {
            return false
          }

          state.doc.nodesBetween(anchor - 1, anchor, (node, pos) => {
            if (node.type.name === this.name) {
              isMention = true
              tr.insertText(
                this.options.deleteTriggerWithBackspace ? '' : this.options.suggestion.char || '',
                pos,
                pos + node.nodeSize
              )

              return false
            }
          })

          return isMention
        })
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion
      })
    ]
  }
})
