<svelte:options immutable={true} />

<script lang="ts">
  import type { Readable } from 'svelte/store'
  import { createEventDispatcher, onMount, SvelteComponent, type ComponentType } from 'svelte'

  import { createEditor, Editor, EditorContent } from 'svelte-tiptap'
  import { Extension, Node } from '@tiptap/core'
  import Placeholder from '@tiptap/extension-placeholder'
  import { conditionalArrayItem } from '@horizon/utils'

  import { createEditorExtensions } from '../editor'
  // import BubbleMenu from './BubbleMenu.svelte'

  export let content: string
  export let readOnly: boolean = false
  export let placeholder: string = `Write something or type '/' for options…`
  export let autofocus: boolean = true
  export let focused: boolean = false
  export let parseHashtags: boolean = false
  export let submitOnEnter: boolean = false
  export let citationComponent: ComponentType<SvelteComponent> | undefined = undefined
  export let tabsManager: any | undefined = undefined

  const dispatch = createEventDispatcher<{
    update: string
    submit: void
    hashtags: string[]
    'citation-click': any
  }>()

  export const focus = () => {
    if ($editor) {
      $editor.commands.focus()
    }
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

  let editor: Readable<Editor>

  const onSubmit = () => {
    if (focused) {
      dispatch('submit')
    }
  }

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
        }
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
        console.warn('node.attrs html', node.attrs)
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
      }
    })
  }

  onMount(() => {
    editor = createEditor({
      extensions: [
        ...createEditorExtensions({ disableHashtag: !parseHashtags }),
        extendKeyboardHandler,
        Placeholder.configure({
          placeholder: placeholder ?? "Write something or type '/' for options…"
        }),
        ...conditionalArrayItem(!!citationComponent, createCitationNode(citationComponent))
      ],
      content: content,
      editable: !readOnly,
      autofocus: !autofocus || readOnly ? false : 'end',
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
  })
</script>

<div class="editor" style="--data-placeholder: '{placeholder}';" on:click on:dragstart>
  <!-- {#if editor && !readOnly}
    <BubbleMenu {editor} />
  {/if} -->

  <div
    class="editor-wrapper prose prose-lg prose-neutral dark:prose-invert prose-inline-code:bg-sky-200/80 prose-ul:list-disc prose-ol:list-decimal prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg"
    class:cursor-text={!readOnly}
  >
    <EditorContent editor={$editor} />
  </div>
</div>

<style lang="scss">
  .editor-wrapper {
    height: 100%;
    overflow-y: auto;
    :global(#stuff-stack) &,
    :global(#tty-default) & {
      overflow-y: hidden;
    }
  }

  :global(.editor-wrapper > div) {
    height: 100%;
  }

  :global(.dark .tiptap p) {
    //color: #e0e7ff !important;
  }

  /* HACK: This allows us to tap into svelte reacivity by getting placeholder from css variable. */
  :global(.tiptap p.is-editor-empty:first-child::before) {
    content: var(--data-placeholder);
  }
</style>
