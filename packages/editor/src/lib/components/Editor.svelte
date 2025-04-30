<svelte:options immutable={true} />

<script lang="ts">
  import type { Readable } from 'svelte/store'
  import {
    createEventDispatcher,
    onMount,
    onDestroy,
    SvelteComponent,
    type ComponentType
  } from 'svelte'

  import { createEditor, Editor, EditorContent, FloatingMenu } from 'svelte-tiptap'
  import {
    Extension,
    generateJSON,
    generateText,
    Node,
    nodePasteRule,
    type Range
  } from '@tiptap/core'
  import Placeholder from '@tiptap/extension-placeholder'
  import { conditionalArrayItem, useAnimationFrameThrottle } from '@horizon/utils'

  import { createEditorExtensions, getEditorContentText, type ExtensionOptions } from '../editor'
  import type {
    EditorAutocompleteEvent,
    LinkItemsFetcher,
    MentionItem,
    MentionItemType
  } from '../types'
  import type { FloatingMenuPluginProps } from '@tiptap/extension-floating-menu'
  import type { MentionAction, MentionNodeAttrs } from '../extensions/Mention'
  import BubbleMenu from './BubbleMenu.svelte'
  import { TextSelection } from '@tiptap/pm/state'
  import { DragTypeNames } from '@horizon/types'
  import type { SlashCommandPayload } from '../extensions/Slash/index'
  import type { SlashItemsFetcher } from '../extensions/Slash/suggestion'
  import type { MentionItemsFetcher } from '../extensions/Mention/suggestion'
  import type { LinkClickHandler } from '../extensions/Link/helpers/clickHandler'

  export let content: string
  export let readOnly: boolean = false
  export let placeholder: string = `Write something or type '/' for options…`
  export let placeholderNewLine: string = ''
  export let autofocus: boolean = true
  export let focused: boolean = false
  export let parseHashtags: boolean = false
  export let submitOnEnter: boolean = false
  export let citationComponent: ComponentType<SvelteComponent> | undefined = undefined
  export let surfletComponent: ComponentType<SvelteComponent> | undefined = undefined
  export let tabsManager: any | undefined = undefined
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

  let editor: Readable<Editor>
  let editorWidth: number = 350
  let resizeObserver: ResizeObserver | null = null

  // Create a throttled version of the caret position update function
  // This will ensure we don't update too frequently during resize events
  const throttledUpdateCaretPosition = useAnimationFrameThrottle(() => {
    if ($editor && $editor.storage && $editor.storage.caretIndicator) {
      updateCaretPosition()
    }
  }, 100) // Add a 100ms backup timeout for cases where RAF might be delayed

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
    'slash-command': SlashCommandPayload
    'caret-position-update': any
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
          const text = generateText(json, extensions)
          return { text, mentions }
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

  const onSubmit = () => {
    if (focused) {
      dispatch('submit')
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

  const handleCaretPositionUpdate = (position: any) => {
    // Forward the position to any listeners via the provided callback
    if (onCaretPositionUpdate) {
      onCaretPositionUpdate(position)
    }

    // Dispatch the event for any components listening directly
    dispatch('caret-position-update', position)
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
    showSlashMenu: showSlashMenu,
    onSlashCommand: handleSlashCommand,
    slashItems: slashItemsFetcher,
    mentionItems: mentionItemsFetcher,
    citationComponent: citationComponent,
    citationClick: handleCitationClick,
    enableCaretIndicator: enableCaretIndicator,
    onCaretPositionUpdate: handleCaretPositionUpdate,
    surfletComponent: surfletComponent,
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

                triggerAutocomplete()

                return false
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
    if (enableCaretIndicator) {
      resizeObserver = new ResizeObserver(() => {
        // Use the throttled update function to limit the frequency of updates
        throttledUpdateCaretPosition()
      })
    }

    editor = createEditor({
      extensions: extensions,
      content: content,
      editable: !readOnly,
      autofocus: !autofocus || readOnly ? false : 'end',
      onSelectionUpdate: ({ editor }) => {
        if (enableCaretIndicator && editor.storage.caretIndicator) {
          const extension = editor.storage.caretIndicator
          if (extension.caretPosition) {
            handleCaretPositionUpdate(extension.caretPosition)
          }
        }
      },
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
  class="editor"
  style="--data-placeholder: '{placeholder}'; --data-placeholder-new-line: '{placeholderNewLine}';"
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

    <slot name="caret-popover"></slot>
  </div>
</div>

<style lang="scss">
  .editor-wrapper {
    height: 100%;
    overflow-y: auto;
    overscroll-behavior: auto;

    :global(.dark) & {
      &::-webkit-scrollbar {
        width: 6px;
      }

      &::-webkit-scrollbar-track {
        background: #1e1e24;
        border-radius: 50%;
      }

      &::-webkit-scrollbar-thumb {
        background: #4a4a57;
        border-radius: 4px;
      }

      &::-webkit-scrollbar-thumb:hover {
        background: #65657a;
      }
    }

    :global(#stuff-stack) &,
    :global(#tty-default) & {
      overflow-y: hidden;
    }

    :global(.prosemirror-dropcursor-block),
    :global(.prosemirror-dropcursor-inline) {
      --thiccness: 2px;

      position: relative;
      border-radius: 2rem;
    }
  }

  :global(.editor-wrapper > div:not([data-tippy-root])) {
    height: 100%;
  }

  :global(.dark .tiptap p) {
    //color: #e0e7ff !important;
  }
</style>
