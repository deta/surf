import { mergeAttributes, Node } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Selection, TextSelection } from '@tiptap/pm/state'
import { NotebookDefaults } from '@deta/types'

const isValidInitialTitle = (title?: string): title is string => {
  return Boolean(
    title &&
      title !== 'Untitled' &&
      title !== NotebookDefaults.NOTE_DEFAULT_NAME &&
      title.trim() !== ''
  )
}

export interface TitleNodeOptions {
  /**
   * The HTML attributes for a title node.
   * @default {}
   * @example { class: 'foo' }
   */
  HTMLAttributes: Record<string, any>

  /**
   * Placeholder text for empty title
   * @default 'Untitled'
   */
  placeholder: string

  /**
   * Callback for when title changes
   */
  onTitleChange?: (title: string) => void

  /**
   * Whether title is currently being generated
   * @default false
   */
  isLoading?: boolean

  /**
   * Initial title content to populate the TitleNode with
   * @default ''
   */
  initialTitle?: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    titleNode: {
      /**
       * Set title content
       * @param title The title text
       * @example editor.commands.setTitle('My Title')
       */
      setTitle: (title: string) => ReturnType

      /**
       * Focus the title node
       * @example editor.commands.focusTitle()
       */
      focusTitle: () => ReturnType

      /**
       * Set title loading state
       * @param loading Whether title is loading
       * @example editor.commands.setTitleLoading(true)
       */
      setTitleLoading: (loading: boolean) => ReturnType
    }
  }
}

/**
 * This extension allows you to create a title node that appears at the top of documents
 * Similar to Notion's title behavior
 */
export const TitleNode = Node.create<TitleNodeOptions>({
  name: 'titleNode',

  priority: 100,

  addOptions() {
    return {
      HTMLAttributes: {},
      placeholder: 'Untitled',
      isLoading: false,
      initialTitle: ''
    }
  },

  addAttributes() {
    return {
      title: {
        default: '',
        parseHTML: (element) => {
          return element.textContent || ''
        },
        renderHTML: (attributes) => {
          return {}
        }
      }
    }
  },

  group: 'block',
  inline: false,
  content: 'text*',
  marks: '',
  defining: true,
  isolating: false,

  parseHTML() {
    return [{ tag: 'h1[data-title-node]' }, { tag: 'div[data-title-node]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-title-node': '',
        class: 'title-node-container'
      }),
      0
    ]
  },

  addNodeView() {
    return ({ node, view, getPos }) => {
      const dom = document.createElement('h1')
      dom.className = 'title-node no-drag-handle'
      dom.setAttribute('data-title-node', '')

      Object.assign(dom.style, {
        fontFamily: 'Inter',
        fontSize: '2.25rem',
        fontWeight: '600',
        letterSpacing: '-0.02em',
        lineHeight: '1.2',
        margin: '0',
        padding: '2rem 0 1rem 0',
        border: 'none',
        outline: 'none',
        background: 'transparent',
        color: 'inherit',
        cursor: 'text',
        minHeight: '2.7rem',
        position: 'relative',
        display: 'block',
        width: '100%'
      })

      const updatePlaceholder = () => {
        try {
          if (!node || !dom) return

          const textContent = node.textContent || ''
          const isEmpty = textContent.trim() === '' || textContent === '\u00A0'
          const isLoading = this.options.isLoading

          dom.setAttribute('data-empty', isEmpty ? 'true' : 'false')
          dom.setAttribute('data-loading', isLoading ? 'true' : 'false')

          // Set appropriate placeholder text based on loading state
          const placeholderText =
            isLoading && isEmpty ? 'Generating title...' : this.options.placeholder
          dom.setAttribute('data-placeholder', isEmpty ? placeholderText : '')

          if (isEmpty) {
            dom.classList.add('is-title-empty')
            dom.classList.add('title-empty')
          } else {
            dom.classList.remove('is-title-empty')
            dom.classList.remove('title-empty')
          }

          if (isLoading && isEmpty) {
            dom.classList.add('title-loading')
          } else {
            dom.classList.remove('title-loading')
          }
        } catch (error) {
          console.warn('TitleNode updatePlaceholder error:', error)
        }
      }

      updatePlaceholder()

      const contentDOM = dom

      return {
        dom,
        contentDOM,
        update: (updatedNode) => {
          if (updatedNode.type !== this.type) return false
          node = updatedNode
          requestAnimationFrame(() => updatePlaceholder())
          return true
        },
        destroy: () => {}
      }
    }
  },

  addCommands() {
    return {
      setTitle:
        (title: string) =>
        ({ commands, state }) => {
          const titleNode = state.doc.firstChild
          if (titleNode && titleNode.type.name === this.name) {
            const titleText = state.schema.text(title)
            return commands.command(({ tr }) => {
              tr.replaceRangeWith(1, titleNode.nodeSize - 1, titleText)
              return true
            })
          }
          return false
        },

      focusTitle:
        () =>
        ({ commands, editor }) => {
          return commands.command(({ tr, dispatch }) => {
            const pos = tr.doc.resolve(1)
            const selection = TextSelection.create(tr.doc, pos.pos)
            tr.setSelection(selection)
            if (dispatch) dispatch(tr)
            editor.view.focus()
            return true
          })
        },

      setTitleLoading:
        (loading: boolean) =>
        ({ commands }) => {
          // Update the extension options
          this.options.isLoading = loading

          // Trigger DOM update by dispatching a transaction
          return commands.command(({ tr, dispatch, view }) => {
            // Force the nodeView to update by triggering a view update
            requestAnimationFrame(() => {
              const titleNodeDOM = view.dom.querySelector('[data-title-node]')
              if (titleNodeDOM) {
                const isEmpty = !titleNodeDOM.textContent?.trim()
                const placeholderText =
                  loading && isEmpty ? 'Generating title...' : this.options.placeholder
                titleNodeDOM.setAttribute('data-placeholder', isEmpty ? placeholderText : '')
                titleNodeDOM.setAttribute('data-loading', loading ? 'true' : 'false')

                if (loading && isEmpty) {
                  titleNodeDOM.classList.add('title-loading')
                } else {
                  titleNodeDOM.classList.remove('title-loading')
                }
              }
            })

            if (dispatch) dispatch(tr)
            return true
          })
        }
    }
  },

  addKeyboardShortcuts() {
    type SelectionBehavior = 'title-only' | 'content-excluding-title'

    interface SelectionBehaviorOptions {
      behavior: SelectionBehavior
      requireContentAfterTitle?: boolean
    }

    const createSelection = (editor: any, options: SelectionBehaviorOptions) => {
      const { state } = editor
      const titleNode = state.doc.firstChild

      if (!titleNode || titleNode.type.name !== this.name) {
        return false
      }

      return editor.commands.command(({ tr, dispatch }) => {
        let selectionStart: number
        let selectionEnd: number

        if (options.behavior === 'title-only') {
          selectionStart = 1
          selectionEnd = titleNode.nodeSize - 1
        } else {
          selectionStart = titleNode.nodeSize
          selectionEnd = state.doc.content.size

          // Check if content exists after title when required
          if (options.requireContentAfterTitle && selectionStart >= selectionEnd) {
            return false
          }
        }

        const selection = TextSelection.create(tr.doc, selectionStart, selectionEnd)
        tr.setSelection(selection)
        if (dispatch) dispatch(tr)
        return true
      })
    }

    const isCursorInTitle = (editor: any) => {
      const { state } = editor
      const { $from, $to } = state.selection
      return $from.parent.type.name === this.name && $to.parent.type.name === this.name
    }

    const isBackspaceAtTitleStart = (editor: any) => {
      const { state } = editor
      const { $from, $to, empty } = state.selection

      return (
        $from.parent.type.name === this.name &&
        $to.parent.type.name === this.name &&
        $from.pos === 1 &&
        empty
      )
    }

    const isBackspaceAtFirstParagraphStart = (editor: any) => {
      const { state } = editor
      const { $from, empty } = state.selection
      const titleNode = state.doc.firstChild

      if (!titleNode || titleNode.type.name !== this.name || !empty || $from.parentOffset !== 0) {
        return false
      }

      const titleEndPos = titleNode.nodeSize
      return $from.pos === titleEndPos + 1
    }

    const deleteCurrentParagraph = (editor: any, tr: any) => {
      const { state } = editor
      const { $from } = state.selection

      const paragraphStart = $from.before($from.depth)
      const paragraphEnd = $from.after($from.depth)
      tr.delete(paragraphStart, paragraphEnd)
    }

    const moveCursorToEndOfTitle = (editor: any, tr: any) => {
      const { state } = editor
      const titleNode = state.doc.firstChild

      const titleEndPos = titleNode!.nodeSize - 1
      tr.setSelection(TextSelection.create(tr.doc, titleEndPos))
    }

    const deleteEmptyParagraphAndMoveToTitle = (editor: any) => {
      return editor.commands.command(({ tr }) => {
        deleteCurrentParagraph(editor, tr)
        moveCursorToEndOfTitle(editor, tr)
        return true
      })
    }

    const isParagraphEmpty = (editor: any) => {
      const { state } = editor
      const { $from } = state.selection
      const currentParagraph = $from.parent
      return currentParagraph.textContent.trim() === ''
    }

    return {
      Enter: ({ editor }) => {
        const { state } = editor
        const { $from } = state.selection

        if ($from.parent.type.name === this.name) {
          const titleNode = state.doc.firstChild
          if (titleNode) {
            const afterTitle = titleNode.nodeSize

            editor.commands.command(({ tr, state }) => {
              const paragraph = state.schema.nodes.paragraph.create()
              tr.insert(afterTitle, paragraph)
              const newPos = tr.doc.resolve(afterTitle + 1)
              tr.setSelection(TextSelection.near(newPos))
              return true
            })
            return true
          }
        }
        return false
      },

      Backspace: ({ editor }) => {
        // Prevent backspace at the beginning of title
        if (isBackspaceAtTitleStart(editor)) {
          return true
        }

        // Handle backspace at the beginning of first paragraph after title
        if (isBackspaceAtFirstParagraphStart(editor)) {
          if (isParagraphEmpty(editor)) {
            // Delete empty paragraph and move cursor to end of title
            return deleteEmptyParagraphAndMoveToTitle(editor)
          } else {
            // Prevent merging paragraph content into title
            return true
          }
        }

        return false
      },

      Delete: ({ editor }) => {
        const { state } = editor
        const { $from, $to } = state.selection

        if ($from.parent.type.name === this.name && $to.parent.type.name === this.name) {
          const titleNode = state.doc.firstChild
          if (titleNode && $from.pos === titleNode.nodeSize - 1) {
            return true
          }
        }
        return false
      },

      'Mod-Shift-t': ({ editor }) => {
        const { state } = editor
        const { $from, $to } = state.selection

        if ($from.parent.type.name === this.name && $to.parent.type.name === this.name) {
          return editor.commands.focusTitle()
        }
        return false
      },

      'Mod-a': ({ editor }) => {
        if (isCursorInTitle(editor)) {
          return createSelection(editor, { behavior: 'title-only' })
        } else {
          return createSelection(editor, {
            behavior: 'content-excluding-title',
            requireContentAfterTitle: true
          })
        }
      }
    }
  },

  onCreate() {
    const editor = this.editor
    if (!editor) return

    // Use requestAnimationFrame to ensure DOM is ready, then initialize
    const initializeTitleNode = async () => {
      // Wait for next frame to ensure editor is fully initialized
      await new Promise((resolve) => requestAnimationFrame(resolve))

      const doc = editor.state.doc
      const firstNode = doc.firstChild
      const hasTitleNode = firstNode && firstNode.type.name === this.name

      if (!hasTitleNode) {
        const initialTitle = this.options.initialTitle
        const titleNode = editor.state.schema.nodes.titleNode.create()

        const tr = editor.state.tr
        tr.insert(0, titleNode)

        // Ensure there's a paragraph after the title
        const paragraph = editor.state.schema.nodes.paragraph.create()
        tr.insert(titleNode.nodeSize, paragraph)

        editor.view.dispatch(tr)

        // Set initial title if valid, using a proper transaction-based approach
        if (isValidInitialTitle(initialTitle)) {
          await setTitleWhenReady(editor, initialTitle)
        }
      } else if (this.options.initialTitle) {
        // TitleNode exists, but check if it's empty and we have an initial title
        const titleText = firstNode.textContent?.trim()
        const initialTitle = this.options.initialTitle

        if ((!titleText || titleText === '') && isValidInitialTitle(initialTitle)) {
          editor.commands.setTitle(initialTitle)
        }
      }
    }

    const setTitleWhenReady = async (editor: any, title: string) => {
      // Wait for the TitleNode to be properly created in the DOM
      await new Promise((resolve) => requestAnimationFrame(resolve))

      // Verify the TitleNode exists before setting title
      const firstNode = editor.state.doc.firstChild
      if (firstNode && firstNode.type.name === this.name) {
        editor.commands.setTitle(title)
      }
    }

    initializeTitleNode()
  },

  addProseMirrorPlugins() {
    const pluginKey = new PluginKey('titleNode')

    return [
      new Plugin({
        key: pluginKey,
        props: {
          handleKeyDown: (view, event) => {
            const { state } = view
            const { selection } = state
            const { $from } = selection

            if (event.key === 'ArrowDown' && $from.parent.type.name === this.name) {
              const titleNode = state.doc.firstChild
              if (titleNode) {
                const nextPos = titleNode.nodeSize
                if (nextPos < state.doc.content.size) {
                  const nextNode = state.doc.resolve(nextPos)
                  if (nextNode.nodeAfter) {
                    const newPos = state.doc.resolve(nextPos + 1)
                    const newSelection = TextSelection.near(newPos)
                    view.dispatch(state.tr.setSelection(newSelection))
                    return true
                  }
                }
              }
            }

            if (event.key === 'ArrowUp' && $from.pos > 1) {
              const titleNode = state.doc.firstChild
              if (titleNode && titleNode.type.name === this.name) {
                const currentNodePos = $from.before($from.depth)
                const titleEndPos = titleNode.nodeSize - 1

                if (currentNodePos === titleNode.nodeSize) {
                  const newPos = state.doc.resolve(titleEndPos)
                  const newSelection = TextSelection.near(newPos)
                  view.dispatch(state.tr.setSelection(newSelection))
                  return true
                }
              }
            }

            return false
          }
        },
        appendTransaction: (transactions, oldState, newState) => {
          // Skip if this transaction was generated by our plugin
          if (transactions.some((tr) => tr.getMeta(pluginKey))) {
            return null
          }

          // Only proceed if the document changed
          if (!transactions.some((tr) => tr.docChanged)) {
            return null
          }

          const { doc, schema, tr } = newState
          let modified = false

          // Ensure document always starts with a titleNode (without schema enforcement)
          const firstNode = doc.firstChild
          if (!firstNode || firstNode.type.name !== this.name) {
            const titleNode = schema.nodes.titleNode.create()
            tr.insert(0, titleNode)
            modified = true

            // Set initial title if provided and TitleNode was just created
            const initialTitle = this.options.initialTitle
            if (isValidInitialTitle(initialTitle)) {
              // Use requestAnimationFrame to set title after transaction completes
              requestAnimationFrame(() => {
                // Check if the editor still exists and has the setTitle command
                if (this.editor && this.editor.commands && this.editor.commands.setTitle) {
                  const currentFirstNode = this.editor.state.doc.firstChild
                  // Only set if the TitleNode is still empty
                  if (
                    currentFirstNode &&
                    currentFirstNode.type.name === this.name &&
                    (!currentFirstNode.textContent || currentFirstNode.textContent.trim() === '')
                  ) {
                    this.editor.commands.setTitle(initialTitle)
                  }
                }
              })
            }
          }

          // Ensure there's always at least one block after the title
          if (doc.childCount === 1 && doc.firstChild?.type.name === this.name) {
            const paragraph = schema.nodes.paragraph.create()
            tr.insert(doc.firstChild.nodeSize, paragraph)
            modified = true
          }

          // Handle title change notifications
          const titleNode = newState.doc.firstChild
          const oldTitleNode = oldState.doc.firstChild

          if (
            titleNode &&
            titleNode.type.name === this.name &&
            oldTitleNode &&
            oldTitleNode.type.name === this.name
          ) {
            const newTitle = titleNode.textContent
            const oldTitle = oldTitleNode.textContent

            if (newTitle !== oldTitle && this.options.onTitleChange) {
              requestAnimationFrame(() => {
                this.options.onTitleChange?.(newTitle)
              })
            }
          }

          return modified ? tr.setMeta(pluginKey, true) : null
        }
      })
    ]
  }
})
