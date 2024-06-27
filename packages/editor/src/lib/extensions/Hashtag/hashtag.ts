import { mergeAttributes, Node } from '@tiptap/core'
import { type DOMOutputSpec, Node as ProseMirrorNode } from '@tiptap/pm/model'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion'

// See `addAttributes` below
export interface HashtagNodeAttrs {
  /**
   * The identifier for the selected item that was hashtaged, stored as a `data-id`
   * attribute.
   */
  id: string | null
  /**
   * The label to be rendered by the editor as the displayed text for this hashtaged
   * item, if provided. Stored as a `data-label` attribute. See `renderLabel`.
   */
  label?: string | null
}

export type HashtagOptions<
  SuggestionItem = any,
  Attrs extends Record<string, any> = HashtagNodeAttrs
> = {
  /**
   * The HTML attributes for a hashtag node.
   * @default {}
   * @example { class: 'foo' }
   */
  HTMLAttributes: Record<string, any>

  /**
   * A function to render the label of a hashtag.
   * @deprecated use renderText and renderHTML instead
   * @param props The render props
   * @returns The label
   * @example ({ options, node }) => `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`
   */
  renderLabel?: (props: {
    options: HashtagOptions<SuggestionItem, Attrs>
    node: ProseMirrorNode
  }) => string

  /**
   * A function to render the text of a hashtag.
   * @param props The render props
   * @returns The text
   * @example ({ options, node }) => `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`
   */
  renderText: (props: {
    options: HashtagOptions<SuggestionItem, Attrs>
    node: ProseMirrorNode
  }) => string

  /**
   * A function to render the HTML of a hashtag.
   * @param props The render props
   * @returns The HTML as a ProseMirror DOM Output Spec
   * @example ({ options, node }) => ['span', { 'data-type': 'hashtag' }, `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`]
   */
  renderHTML: (props: {
    options: HashtagOptions<SuggestionItem, Attrs>
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
   * @example { char: '@', pluginKey: HashtagPluginKey, command: ({ editor, range, props }) => { ... } }
   */
  suggestion: Omit<SuggestionOptions<SuggestionItem>, 'editor'>
}

/**
 * The plugin key for the hashtag plugin.
 * @default 'hashtag'
 */
export const HashtagPluginKey = new PluginKey('hashtag')

/**
 * This extension allows you to insert hashtags into the editor.
 * @see https://www.tiptap.dev/api/extensions/hashtag
 */
export const Hashtag = Node.create<HashtagOptions>({
  name: 'hashtag',

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'hashtag'
      },
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
        char: '#',
        pluginKey: HashtagPluginKey,
        allowSpaces: false,
        startOfLine: false,
        allowedPrefixes: null,
        command: ({ editor, range, props }) => {
          console.log('editor', editor)
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
                attrs: props
              },
              {
                type: 'text',
                text: ' '
              }
            ])
            .run()

          window.getSelection()?.collapseToEnd()
        },
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from)
          const type = state.schema.nodes[this.name]
          const allow = !!$from.parent.type.contentMatch.matchType(type)

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

  addKeyboardShortcuts() {
    return {
      Backspace: () =>
        this.editor.commands.command(({ tr, state }) => {
          let isHashtag = false
          const { selection } = state
          const { empty, anchor } = selection

          if (!empty) {
            return false
          }

          state.doc.nodesBetween(anchor - 1, anchor, (node, pos) => {
            if (node.type.name === this.name) {
              isHashtag = true
              tr.insertText(
                this.options.deleteTriggerWithBackspace ? '' : this.options.suggestion.char || '',
                pos,
                pos + node.nodeSize
              )

              return false
            }
          })

          return isHashtag
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
