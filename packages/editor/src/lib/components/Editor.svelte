<script lang="ts">
  import { get, writable, type Readable, type Writable } from 'svelte/store'
  import {
    createEventDispatcher,
    onMount,
    onDestroy,
    type SvelteComponent,
    type ComponentType
  } from 'svelte'

  import { createEditor, Editor, EditorContent, FloatingMenu } from 'svelte-tiptap'
  import { Extension, generateHTML, generateJSON, generateText } from '@tiptap/core'
  import { conditionalArrayItem, useAnimationFrameThrottle } from '@deta/utils'

  import { createEditorExtensions } from '../editor'
  import { isInTitleNode } from '../utils'
  import type { EditorAutocompleteEvent, LinkItemsFetcher, MentionItem } from '../types'
  import type { FloatingMenuPluginProps } from '@tiptap/extension-floating-menu'
  import type { MentionAction, MentionNodeAttrs } from '../extensions/Mention'
  import BubbleMenu from './BubbleMenu.svelte'
  import { TextSelection } from '@tiptap/pm/state'
  import { DragTypeNames } from '@deta/types'
  import type { SlashCommandPayload } from '../extensions/Slash/index'
  import type { SlashItemsFetcher } from '../extensions/Slash/suggestion'
  import type { MentionItemsFetcher } from '../extensions/Mention/suggestion'
  import type { LinkClickHandler } from '../extensions/Link/helpers/clickHandler'

  import 'katex/dist/katex.min.css'

  export let content: string
  export let readOnly: boolean = false
  export let placeholder: string | null = `Write or type '/' for options…`
  export let placeholderNewLine: string = ''
  export let autofocus: boolean = true
  export let focused: boolean = false
  export let parseHashtags: boolean = false
  export let submitOnEnter: boolean = false
  export let citationComponent: ComponentType<SvelteComponent> | undefined = undefined
  export let surfletComponent: ComponentType<SvelteComponent> | undefined = undefined
  export let webSearchComponent: ComponentType<SvelteComponent> | undefined = undefined
  export let autocomplete: boolean = false
  export let floatingMenu: boolean = false
  export let floatingMenuShown: boolean = false
  export let parseMentions: boolean = false
  export let readOnlyMentions: boolean = false
  export let bubbleMenu: boolean = false
  export let bubbleMenuLoading: boolean = false
  export let autoSimilaritySearch: boolean = false
  export let enableRewrite: boolean = false
  export let resourceComponent: ComponentType<SvelteComponent> | undefined = undefined
  export let resourceComponentPreview: boolean = false
  export let showDragHandle: boolean = false
  export let showSlashMenu: boolean = false
  export let slashItemsFetcher: SlashItemsFetcher | undefined = undefined
  export let mentionItemsFetcher: MentionItemsFetcher | undefined = undefined
  export let linkItemsFetcher: LinkItemsFetcher | undefined = undefined
  export let onLinkClick: LinkClickHandler | undefined = undefined

  export let enableCaretIndicator: boolean = false
  export let onCaretPositionUpdate: ((position: any) => void) | undefined = undefined
  export let showSimilaritySearch: boolean = false
  export let editorElement: HTMLElement

  export let enableTitleNode: boolean = false
  export let titlePlaceholder: string = 'Untitled'
  export let initialTitle: string = ''
  export let titleLoading: boolean = false
  export let onTitleChange: ((title: string) => void) | undefined = undefined

  export const isEmptyy = () => !get(editor)?.state.doc.textContent.trim().length

  export const isEmpty: Writable<boolean> = writable(false)

  let editorWrapperEl: HTMLElement
  let editor: Readable<Editor>

  let editorWidth: number = 350
  let resizeObserver: ResizeObserver | null = null
  let isFirstLine = true

  // Create a throttled version of the caret position update function
  // This will ensure we don't update too frequently during resize events
  const throttledUpdateCaretPosition = useAnimationFrameThrottle(() => {
    if ($editor && $editor.storage && $editor.storage.caretIndicator) {
      updateCaretPosition()
    }
  }, 100) // Add a 100ms backup timeout for cases where RAF might be delayed

  const dispatch = createEventDispatcher<{
    update: string
    submit: boolean
    hashtags: string[]
    'citation-click': any
    autocomplete: EditorAutocompleteEvent
    suggestions: void
    'mention-click': { item: MentionItem; action: MentionAction }
    'mention-insert': MentionItem
    'button-click': string
    'slash-command': SlashCommandPayload
    'caret-position-update': any
    'last-line-visbility-changed': boolean
    'is-first-line-changed': boolean
    'web-search-completed': any
  }>()

  export const getEditor = () => {
    return $editor
  }

  // Manually trigger a caret position update (useful for resize events)
  export const updateCaretPosition = () => {
    if (!$editor || !enableCaretIndicator) return

    try {
      // Check if the caretIndicator extension exists and is initialized
      if ($editor.storage.caretIndicator) {
        const extension = $editor.storage.caretIndicator

        // Check if getCaretPosition method is available
        if (typeof extension.getCaretPosition === 'function') {
          const position = extension.getCaretPosition()

          if (position) {
            // Create a new position object to ensure reactivity
            const newPosition = { ...position }

            // Only update if storage is initialized
            if (extension.storage) {
              extension.storage.caretPosition = newPosition
            }

            // Emit event and call handler
            $editor.emit('caretPositionUpdate', newPosition)
            handleCaretPositionUpdate(newPosition)
          }
        }
      }
    } catch (error) {
      console.error('Error updating caret position:', error)
    }
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

  export const scrollToTop = () => {
    if ($editor) {
      $editor.chain().focus('start').scrollIntoView().run()
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
    const html = generateHTML(json, extensions)
    return { text, html, mentions }
  }

  export const triggerAutocomplete = () => {
    const editor = getEditor()

    const getText = () => {
      const { from, to } = editor.view.state.selection
      if (from === to) {
        const currentNode = editor.view.state.selection.$from.node()
        const previousNode = editor.view.state.selection.$from.nodeBefore

        const selectedNode = currentNode || previousNode
        if (selectedNode && selectedNode.textContent.length > 0) {
          const mentions: MentionItem[] = []
          selectedNode.descendants((node) => {
            if (node.type.name === 'mention') {
              mentions.push(parseMentionNode(node))
            }
          })

          const json = selectedNode.toJSON()
          const html = generateHTML(json, extensions)
          return { text: html, mentions }
        }
      } else {
        const node = editor.view.state.doc.cut(from, to)
        const mentions = getMentions(node)
        return {
          text: editor.view.state.doc.textBetween(from, to),
          mentions
        }
      }
    }

    const data = getText()
    if (data) {
      dispatch('autocomplete', { query: data.text, mentions: data.mentions })
    }
  }

  export const insertMention = (mentionItem?: MentionItem, query?: string) => {
    try {
      const editor = getEditor()
      if (!editor) {
        console.error('Editor instance is not available')
        return
      }

      // Insert two line breaks followed by the mention
      editor
        .chain()
        .focus('end')
        .insertContent(
          [
            ...conditionalArrayItem(!!mentionItem, [
              {
                type: 'mention',
                attrs: {
                  id: mentionItem?.id,
                  label: mentionItem?.label,
                  mentionType: mentionItem?.type,
                  icon: mentionItem?.icon
                }
              }
            ]),
            {
              type: 'text',
              text: ' '
            }
          ],
          { parseOptions: { preserveWhitespace: 'full' } }
        )
        .run()

      // If there's a query, insert it after the mention
      if (query) {
        editor.chain().insertContent(query).run()
      }

      editor.commands.focus('end')
    } catch (error) {
      console.error('Error inserting mention', error)
    }
  }

  const onSubmit = (isModKeyPressed: boolean) => {
    if (focused) {
      dispatch('submit', isModKeyPressed)
    }
  }

  const parseMentionNode = (node: typeof $editor.state.doc) => {
    const attrs = node.attrs as MentionNodeAttrs
    const { id, label, icon, mentionType } = attrs

    return { id, label, icon, type: mentionType } as MentionItem
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

  const handleMentionClick = (item: MentionItem, action: MentionAction) => {
    dispatch('mention-click', { item, action })
  }

  const handleMentionInsert = (item: MentionItem) => {
    dispatch('mention-insert', item)
  }

  const handleButtonClick = (action: string) => {
    dispatch('button-click', action)
  }

  const handleSlashCommand = (payload: SlashCommandPayload) => {
    dispatch('slash-command', payload)
  }

  const handleCitationClick = (e: CustomEvent<any>) => {
    dispatch('citation-click', e.detail)
  }

  // TODO: type this properly
  const onWebSearchCompleted = (results: any, query: any) => {
    dispatch('web-search-completed', { results, query })
  }

  const handleCaretPositionUpdate = (position: any) => {
    // Forward the position to any listeners via the provided callback
    if (onCaretPositionUpdate) {
      onCaretPositionUpdate(position)
    }

    // Dispatch the event for any components listening directly
    dispatch('caret-position-update', position)
  }

  const handleLastLineVisibilityChanged = (visible: boolean) => {
    dispatch('last-line-visbility-changed', visible)
  }

  const handleFirstLineChanged = (val: boolean) => {
    isFirstLine = val
    dispatch('is-first-line-changed', val)
  }

  const baseExtensions = createEditorExtensions({
    placeholder,
    parseMentions,
    disableHashtag: !parseHashtags,
    mentionClick: handleMentionClick,
    mentionInsert: handleMentionInsert,
    readOnlyMentions: readOnlyMentions,
    buttonClick: handleButtonClick,
    resourceComponent: resourceComponent,
    resourceComponentPreview: resourceComponentPreview,
    showDragHandle: showDragHandle,
    enableTitleNode: enableTitleNode,
    titlePlaceholder: titlePlaceholder,
    initialTitle: initialTitle,
    titleLoading: titleLoading,
    onTitleChange: onTitleChange,
    showSlashMenu: showSlashMenu,
    onSlashCommand: handleSlashCommand,
    slashItems: slashItemsFetcher,
    mentionItems: mentionItemsFetcher,
    citationComponent: citationComponent,
    citationClick: handleCitationClick,
    enableCaretIndicator: enableCaretIndicator,
    onCaretPositionUpdate: handleCaretPositionUpdate,
    onFloatyInputStateChange: () => {},
    onFirstLineStateChanged: handleFirstLineChanged,
    onLastLineVisibilityChanged: handleLastLineVisibilityChanged,
    surfletComponent: surfletComponent,
    webSearchComponent: webSearchComponent,
    onWebSearchCompleted: onWebSearchCompleted,
    onLinkClick: onLinkClick
  })

  const KeyboardHandler = Extension.create({
    name: 'keyboardHandler'
  })

  const extendKeyboardHandler = KeyboardHandler.extend({
    addKeyboardShortcuts() {
      return {
        Enter: () => {
          if (submitOnEnter) {
            onSubmit(false)
            return true
          }

          return false
        },
        'Meta-Enter': () => {
          if (submitOnEnter) {
            onSubmit(true)
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
                triggerAutocomplete()

                return false
              },

              Enter: () => {
                if (!autocomplete || !isFirstLine) return false

                if (isInTitleNode(this.editor)) {
                  return false
                }

                triggerAutocomplete()
                return true
              },

              'Meta-Enter': () => {
                if (!autocomplete) {
                  return false
                }

                triggerAutocomplete()

                return true
              },

              'Ctrl-Enter': () => {
                if (!autocomplete) {
                  return false
                }

                triggerAutocomplete()

                return true
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

  const extensions = [...baseExtensions, extendKeyboardHandler]

  onMount(() => {
    // Set up resize observer to update caret position when editor resizes
    //if (enableCaretIndicator) {
    //  resizeObserver = new ResizeObserver(() => {
    //    // Use the throttled update function to limit the frequency of updates
    //    throttledUpdateCaretPosition()
    //  })
    //}

    editor = createEditor({
      extensions: extensions,
      content: content,
      editable: !readOnly,
      autofocus: !autofocus || readOnly ? false : 'start',
      //onSelectionUpdate: ({ editor }) => {
      //  if (enableCaretIndicator && editor.storage.caretIndicator) {
      //    const extension = editor.storage.caretIndicator
      //    if (extension.caretPosition) {
      //      handleCaretPositionUpdate(extension.caretPosition)
      //    }
      //  }
      //},
      editorProps: {
        handleDOMEvents: {
          drop: (view, e) => {
            // Check if image drop from webpage
            const htmlContent = e.dataTransfer.getData('text/html')
            if (htmlContent.includes('<img ')) {
              // HACK: To make the raw datatransfer object accessible inside the
              // TextResource.svelte Dragcula handler. There is an issue with dragcula not
              // bootstrapping this with the correct dt object so its always empty
              // Also the webviews do some funky stuff
              // FIX: @maxu
              // @ts-ignore bro I literally check if it exists, chill!
              if (window.Dragcula && window.Dragcula.activeDrag) {
                // @ts-ignore bro I literally check if it exists, chill!
                window.Dragcula.activeDrag.dataTransfer = e.dataTransfer
              }
              e.preventDefault()
              return false
            }

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

        isEmpty.set(editor.state.doc.textContent.trim().length === 0)
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

    // Set up resize observer after editor is initialized
    if (resizeObserver && editorElement) {
      resizeObserver.observe(editorElement)
      if (editorElement.parentElement) {
        resizeObserver.observe(editorElement.parentElement)
      }
    }
  })
  onMount(() => {
    let prevEnabled = !readOnly
    const disable = (e) => {
      if (e.from === null) return
      prevEnabled = $editor.isEditable
      $editor.setEditable(false)
    }
    const enable = (e) => {
      if (e.from === null) return
      $editor.setEditable(prevEnabled)
    }

    // @ts-ignore shutup >:(
    window.Dragcula.on('dragstart', disable)
    // @ts-ignore shutup >:(
    window.Dragcula.on('dragend', enable)

    return () => {
      // @ts-ignore shutup >:(
      window.Dragcula.off('dragstart', disable)
      // @ts-ignore shutup >:(
      window.Dragcula.off('dragend', enable)
    }
  })

  onDestroy(() => {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
  })
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<!-- svelte-ignore a11y-click-events-have-key-events -->
<div
  bind:this={editorWrapperEl}
  class="editor"
  style="--data-placeholder: '{placeholder}'; --data-placeholder-new-line: '{placeholderNewLine}'; "
  on:click
  on:dragstart
>
  {#if editor && !readOnly && bubbleMenu}
    <BubbleMenu
      {editor}
      {mentionItemsFetcher}
      {linkItemsFetcher}
      loading={bubbleMenuLoading}
      autosearch={autoSimilaritySearch}
      showRewrite={enableRewrite}
      {showSimilaritySearch}
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
    bind:this={editorElement}
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

    <!--<slot name="caret-popover"></slot>-->
  </div>
</div>

<style lang="scss">
  .editor-wrapper {
    height: 100%;
    overflow-y: auto;
    overscroll-behavior: auto;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: light-dark(transparent, #1e1e24);
      border-radius: 50%;
    }

    &::-webkit-scrollbar-thumb {
      background: light-dark(rgba(0, 0, 0, 0.2), #4a4a57);
      border-radius: 4px;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: light-dark(rgba(0, 0, 0, 0.3), #65657a);
    }

    :global(#stuff-stack) &,
    :global(#tty-default) & {
      overflow-y: hidden;
    }

    :global(.prosemirror-dropcursor-block) {
      height: 3px !important;
      width: 100% !important;
    }

    :global(.prosemirror-dropcursor-inline) {
      width: 3px !important;
      height: 1.2em !important;
      display: inline-block !important;
      vertical-align: text-top !important;
      background-color: #ff0000 !important;
    }
  }

  :global(.editor-wrapper > div:not([data-tippy-root])) {
    height: 100%;
  }

  :global(.dark .tiptap p) {
    //color: #e0e7ff !important;
  }

  /* Suggestion pill styling */
  :global(.suggestion-pill) {
    background: light-dark(#e5e9ff, rgba(30, 58, 138, 0.4));
    border-radius: 12px;
    padding: 0 12px 1px 6px;
    margin: 0 1px;
    font-size: 1em;
    color: light-dark(#a4abc0, #93c5fd);
    font-weight: 400;
    letter-spacing: 0.01em;
    line-height: 1;
    vertical-align: baseline;
  }
</style>
