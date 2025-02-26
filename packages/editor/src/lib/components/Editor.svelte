<svelte:options immutable={true} />

<script lang="ts">
  import type { Readable } from 'svelte/store'
  import { createEventDispatcher, onMount, SvelteComponent, type ComponentType } from 'svelte'

  import { createEditor, Editor, EditorContent, FloatingMenu } from 'svelte-tiptap'
  import { Extension, generateJSON, generateText, Node, nodePasteRule } from '@tiptap/core'
  import Placeholder from '@tiptap/extension-placeholder'
  import { conditionalArrayItem } from '@horizon/utils'

  import { createEditorExtensions, getEditorContentText, type ExtensionOptions } from '../editor'
  import type { EditorAutocompleteEvent, MentionItem, MentionItemType } from '../types'
  import type { FloatingMenuPluginProps } from '@tiptap/extension-floating-menu'
  import type { MentionAction } from '../extensions/Mention'
  import BubbleMenu from './BubbleMenu.svelte'
  import { TextSelection } from '@tiptap/pm/state'
  import { DragTypeNames } from '@horizon/types'

  export let content: string
  export let readOnly: boolean = false
  export let placeholder: string = `Write something or type '/' for options…`
  export let placeholderNewLine: string = ''
  export let autofocus: boolean = true
  export let focused: boolean = false
  export let parseHashtags: boolean = false
  export let submitOnEnter: boolean = false
  export let citationComponent: ComponentType<SvelteComponent> | undefined = undefined
  export let tabsManager: any | undefined = undefined
  export let autocomplete: boolean = false
  export let floatingMenu: boolean = false
  export let floatingMenuShown: boolean = false
  export let parseMentions: boolean = false
  export let readOnlyMentions: boolean = false
  export let mentionItems: MentionItem[] = []
  export let bubbleMenu: boolean = false
  export let bubbleMenuLoading: boolean = false
  export let autoSimilaritySearch: boolean = false
  export let enableRewrite: boolean = false
  export let resourceComponent: ComponentType<SvelteComponent> | undefined = undefined
  export let resourceComponentPreview: boolean = false

  let editor: Readable<Editor>
  let editorWidth: number = 350

  const dispatch = createEventDispatcher<{
    update: string
    submit: void
    hashtags: string[]
    'citation-click': any
    autocomplete: EditorAutocompleteEvent
    suggestions: void
    'mention-click': { item: MentionItem; action: MentionAction }
    'mention-insert': MentionItem
    'button-click': string
  }>()

  export const getEditor = () => {
    return $editor
  }

  export const focus = () => {
    if ($editor) {
      $editor.commands.focus()
    }
  }

  export const focusEnd = () => {
    const { state } = $editor
    const { tr } = state

    const endPos = state.doc.content.size
    const resolvedPos = tr.doc.resolve(endPos)
    const selection = new TextSelection(resolvedPos)

    tr.setSelection(selection)

    $editor.view.dispatch(tr)
  }

  export const blur = () => {
    if ($editor) {
      $editor.commands.blur()
    }
  }

  export const clear = () => {
    if ($editor) {
      $editor.commands.clearContent()
    }
  }

  export const setContent = (content: string) => {
    if ($editor) {
      $editor.commands.setContent(content)
    }
  }

  export const generateJSONFromHTML = (html: string) => {
    return generateJSON(html, extensions)
  }

  export const getMentions = (node?: typeof $editor.state.doc) => {
    if (!$editor) {
      return []
    }

    const mentions: MentionItem[] = []

    let selectedNode = node || $editor.state.doc
    selectedNode.descendants((node) => {
      if (node.type.name === 'mention') {
        mentions.push(parseMentionNode(node))
      }
    })

    return mentions
  }

  export const getParsedEditorContent = () => {
    const selectedNode = $editor.state.doc
    const mentions: MentionItem[] = []

    selectedNode.descendants((node) => {
      if (node.type.name === 'mention') {
        mentions.push(parseMentionNode(node))
      }
    })

    console.warn('mentions', mentions)

    const json = selectedNode.toJSON()
    const text = generateText(json, extensions)
    return { text, mentions }
  }

  const onSubmit = () => {
    if (focused) {
      dispatch('submit')
    }
  }

  const parseMentionNode = (node: typeof $editor.state.doc) => {
    const id = node.attrs.id as string
    const label = node.attrs.label as string
    const type = node.attrs.type as MentionItemType

    const item = mentionItems.find((item) => item.id === id)
    if (item) {
      return item
    }

    return { id, label, type } as MentionItem
  }

  const shouldShowFloatingMenu: Exclude<FloatingMenuPluginProps['shouldShow'], null> = ({
    view,
    state,
    editor
  }) => {
    const { selection } = state
    const { $anchor, empty } = selection
    const isRootDepth = $anchor.depth === 1
    const isEmptyTextBlock =
      $anchor.parent.isTextblock && !$anchor.parent.type.spec.code && !$anchor.parent.textContent

    if (!view.hasFocus() || !empty || !isRootDepth || !isEmptyTextBlock || !editor.isEditable) {
      floatingMenuShown = false
      return false
    }

    floatingMenuShown = true
    return true
  }

  const searchMentions: ExtensionOptions['searchMentions'] = ({ query }) => {
    const compare = (a: string, b: string) => a.toLowerCase().includes(b.toLowerCase())

    return mentionItems.filter((item) => {
      if (!query && item.hideInRoot) {
        return false
      }

      if (query && item.hideInSearch) {
        return false
      }

      if (compare(item.label, query)) {
        return true
      }

      if (item.aliases && item.aliases.some((alias) => compare(alias, query))) {
        return true
      }

      return false
    })
  }

  const handleMentionClick = (item: MentionItem, action: MentionAction) => {
    dispatch('mention-click', { item, action })
  }

  const handleMentionInsert = (item: MentionItem) => {
    dispatch('mention-insert', item)
  }

  const handleButtonClick = (action: string) => {
    dispatch('button-click', action)
  }

  const baseExtensions = createEditorExtensions({
    disableHashtag: !parseHashtags,
    parseMentions,
    searchMentions,
    mentionClick: handleMentionClick,
    mentionInsert: handleMentionInsert,
    readOnlyMentions: readOnlyMentions,
    buttonClick: handleButtonClick,
    resourceComponent: resourceComponent,
    resourceComponentPreview: resourceComponentPreview
  })

  const KeyboardHandler = Extension.create({
    name: 'keyboardHandler'
  })

  const extendKeyboardHandler = KeyboardHandler.extend({
    addKeyboardShortcuts() {
      return {
        Enter: () => {
          if (submitOnEnter) {
            onSubmit()
            return true
          }

          return false
        },

        'Shift-Enter': () => {
          /**
           * currently we do not have an option to show a soft line break in the posts, so we overwrite
           * the behavior from tiptap with the default behavior on pressing enter
           */
          return this.editor.commands.first(({ commands }) => [
            () => commands.newlineInCode(),
            () => commands.createParagraphNear(),
            () => commands.liftEmptyBlock(),
            () => commands.splitBlock()
          ])
        },

        ...(autocomplete
          ? {
              'Alt-Enter': () => {
                if (!autocomplete) {
                  return false
                }

                const getText = () => {
                  const { from, to } = this.editor.view.state.selection
                  if (from === to) {
                    const currentNode = this.editor.view.state.selection.$from.node()
                    const previousNode = this.editor.view.state.selection.$from.nodeBefore

                    const selectedNode = currentNode || previousNode
                    if (selectedNode && selectedNode.textContent.length > 0) {
                      const mentions: MentionItem[] = []
                      selectedNode.descendants((node) => {
                        if (node.type.name === 'mention') {
                          mentions.push(parseMentionNode(node))
                        }
                      })

                      const json = selectedNode.toJSON()
                      const text = generateText(json, extensions)
                      return { text, mentions }
                    }

                    const textUntilPos = this.editor.view.state.doc.textBetween(0, to)
                    if (textUntilPos) {
                      return {
                        text: textUntilPos
                      }
                    }

                    return { text: this.editor.getText() }
                  } else {
                    const node = this.editor.view.state.doc.cut(from, to)
                    const mentions = getMentions(node)
                    return {
                      text: this.editor.view.state.doc.textBetween(from, to),
                      mentions
                    }
                  }
                }

                const data = getText()
                dispatch('autocomplete', { query: data.text, mentions: data.mentions })

                return false
              }
            }
          : {}),

        ...(autocomplete
          ? {
              Space: () => {
                if (floatingMenuShown) {
                  dispatch('suggestions')
                  return true
                }

                return false
              }
            }
          : {})
      }
    }
  })

  const createCitationNode = (CitationItem: any) => {
    return Node.create({
      name: 'citation',
      group: 'inline',
      inline: true,
      atom: true,
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
          const component = new CitationItem({
            target: container,
            props: {
              ...node.attrs,
              skipContext: true,
              tabsManager
            }
          })
          component.$on('click', (event: CustomEvent<any>) => {
            dispatch('citation-click', event.detail)
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
  }

  const extensions = [
    ...baseExtensions,
    extendKeyboardHandler,
    Placeholder.configure({
      placeholder: placeholder ?? "Write something or type '/' for options…"
    }),
    ...conditionalArrayItem(!!citationComponent, createCitationNode(citationComponent))
  ]

  onMount(() => {
    editor = createEditor({
      extensions: extensions,
      content: content,
      editable: !readOnly,
      autofocus: !autofocus || readOnly ? false : 'end',
      editorProps: {
        handleDOMEvents: {
          drop: (view, e) => {
            // if a tab is being dropped we need to prevent the default behavior so TipTap does not handle it
            const tabId = e.dataTransfer?.getData(DragTypeNames.SURF_TAB_ID)
            if (tabId) {
              e.preventDefault()
              return false
            }
          }
        }
      },
      onUpdate: ({ editor }) => {
        editor = editor
        const html = editor.getHTML()
        // const oldContent = content
        content = html
        dispatch('update', content)

        if (parseHashtags) {
          // get all hashtag nodes
          const hashtagNodes = editor.$node('hashtag')

          const hashtags: string[] = []
          editor.state.doc.descendants((node) => {
            if (node.type.name === 'hashtag') {
              hashtags.push(node.attrs.id as string)
            }
          })

          if (hashtags.length > 0) {
            dispatch('hashtags', hashtags)
          }
        }
      },
      onFocus: () => {
        focused = true
      },
      onBlur: () => {
        focused = false
      }
    })

    if (!autofocus) {
      // place the cursor at the end of the content without effecting page focus
      focusEnd()
    }
  })
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<!-- svelte-ignore a11y-click-events-have-key-events -->
<div
  class="editor"
  style="--data-placeholder: '{placeholder}'; --data-placeholder-new-line: '{placeholderNewLine}';"
  on:click
  on:dragstart
>
  {#if editor && !readOnly && bubbleMenu}
    <BubbleMenu
      {editor}
      {mentionItems}
      loading={bubbleMenuLoading}
      autosearch={autoSimilaritySearch}
      showRewrite={enableRewrite}
      on:rewrite
      on:similarity-search
      on:close-bubble-menu
      on:open-bubble-menu
    />
  {/if}

  <div
    class="editor-wrapper select-text prose prose-lg prose-neutral dark:prose-invert prose-inline-code:bg-sky-200/80 prose-ul:list-disc prose-ol:list-decimal"
    class:cursor-text={!readOnly}
    bind:clientWidth={editorWidth}
  >
    {#if floatingMenu && $editor}
      <FloatingMenu
        editor={$editor}
        shouldShow={shouldShowFloatingMenu}
        tippyOptions={{ maxWidth: `${editorWidth - 15}px`, placement: 'bottom' }}
      >
        <slot name="floating-menu"></slot>
      </FloatingMenu>
    {/if}
    <EditorContent editor={$editor} />
  </div>
</div>

<style lang="scss">
  .editor-wrapper {
    height: 100%;
    overflow-y: auto;
    overscroll-behavior: auto;

    :global(#stuff-stack) &,
    :global(#tty-default) & {
      overflow-y: hidden;
    }
  }

  :global(.editor-wrapper > div:not([data-tippy-root])) {
    height: 100%;
  }

  :global(.dark .tiptap p) {
    //color: #e0e7ff !important;
  }
</style>
