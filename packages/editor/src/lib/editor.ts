import {
  type JSONContent,
  generateHTML,
  generateJSON,
  generateText,
  Editor,
  type Range,
  Extension
} from '@tiptap/core'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import ListKeymap from '@tiptap/extension-list-keymap'
import Image from '@tiptap/extension-image'
import Underline from '@tiptap/extension-underline'

import { DragHandle } from './extensions/DragHandle/DragHandleExtension'
import { SlashExtension, SlashSuggestion, type SlashCommandPayload } from './extensions/Slash/index'
import hashtagSuggestion from './extensions/Hashtag/suggestion'
import Hashtag from './extensions/Hashtag/index'
import Mention, { type MentionAction } from './extensions/Mention/index'
// import Mention from '@tiptap/extension-mention'
import mentionSuggestion, { type MentionItemsFetcher } from './extensions/Mention/suggestion'
import { CaretIndicatorExtension, type CaretPosition } from './extensions/CaretIndicator'
import Loading from './extensions/Loading'
import Thinking from './extensions/Thinking'
import TrailingNode from './extensions/TrailingNode'
import AIOutput from './extensions/AIOutput'
import type { MentionItem } from './types'
import Button from './extensions/Button'
import Resource from './extensions/Resource'
import type { ComponentType, SvelteComponent } from 'svelte'
import { conditionalArrayItem } from '@horizon/utils'
import type { SlashItemsFetcher } from './extensions/Slash/suggestion'
import { Citation } from './extensions/Citation/citation'
import { Surflet } from './extensions/Surflet/surflet'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import Link from './extensions/Link'
import type { LinkClickHandler } from './extensions/Link/helpers/clickHandler'

export type ExtensionOptions = {
  placeholder?: string
  disableHashtag?: boolean
  enhanceCodeBlock?: boolean
  parseMentions?: boolean
  readOnlyMentions?: boolean
  mentionClick?: (item: MentionItem, action: MentionAction) => void
  mentionInsert?: (item: MentionItem) => void
  buttonClick?: (action: string) => void
  resourceComponent?: ComponentType<SvelteComponent>
  resourceComponentPreview?: boolean
  citationComponent?: ComponentType<SvelteComponent>
  citationClick?: (e: CustomEvent<any>) => void
  showDragHandle?: boolean
  showSlashMenu?: boolean
  onSlashCommand?: (payload: SlashCommandPayload) => void
  slashItems?: SlashItemsFetcher
  mentionItems?: MentionItemsFetcher
  enableCaretIndicator?: boolean
  onCaretPositionUpdate?: (position: CaretPosition) => void
  surfletComponent?: ComponentType<SvelteComponent>
  onLinkClick?: LinkClickHandler
}

export const createEditorExtensions = (opts?: ExtensionOptions) => [
  StarterKit.configure({
    heading: {
      levels: [1, 2, 3]
    },
    dropcursor: {
      color: 'var(--contrast-color)',
      width: 2
    }
  }),
  Underline,
  Link.configure({
    onClick: opts?.onLinkClick,
    protocols: ['surf'],
    HTMLAttributes: {
      target: '_blank'
    }
  }),
  // Link.extend({
  //   addAttributes() {
  //     return {
  //       href: {
  //         default: null
  //       },
  //       'data-sveltekit-reload': {
  //         default: true
  //       },
  //       protocols: ['surf'],
  //       target: {
  //         default: null,
  //         renderHTML: () => {
  //           return {
  //             target:
  //               window.location.origin.includes('deta.space') ||
  //               window.location.origin.includes('localhost')
  //                 ? '_self'
  //                 : '_blank'
  //           }
  //         }
  //       }
  //     }
  //   }
  // }),
  Button.configure({
    onClick: opts?.buttonClick
  }),
  Placeholder.configure({
    placeholder: opts?.placeholder ?? "Write something or type '/' for options…"
  }),
  ...conditionalArrayItem(
    !opts?.disableHashtag,
    Hashtag.configure({
      suggestion: hashtagSuggestion
    })
  ),
  ...conditionalArrayItem(
    !!opts?.parseMentions,
    Mention.configure({
      HTMLAttributes: {
        class: 'mention'
      },
      suggestion: {
        ...mentionSuggestion,
        items: opts?.mentionItems
      },
      renderText({ options, node }) {
        return `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`
      },
      onClick: opts?.mentionClick,
      onInsert: opts?.mentionInsert,
      readOnly: opts?.readOnlyMentions
    })
  ),
  ...conditionalArrayItem(
    !!opts?.resourceComponent,
    Resource.configure({
      component: opts?.resourceComponent,
      preview: opts?.resourceComponentPreview
    })
  ),
  ...conditionalArrayItem(
    !!opts?.citationComponent,
    Citation.configure({
      component: opts?.citationComponent,
      onClick: opts?.citationClick
    })
  ),
  ...conditionalArrayItem(
    !!opts?.surfletComponent,
    Surflet.configure({
      component: opts?.surfletComponent
    })
  ),
  ...conditionalArrayItem(!!opts?.showDragHandle, DragHandle),
  ...conditionalArrayItem(
    !!opts?.showSlashMenu,
    SlashExtension.configure({
      suggestion: {
        ...SlashSuggestion,
        command: ({
          props,
          editor,
          range
        }: {
          editor: Editor
          range: Range
          props: SlashCommandPayload
        }) => {
          const { item, query } = props
          if (item.command) {
            item.command(item, editor, { from: range.from, to: range.to + query.length })
          } else if (opts?.onSlashCommand) {
            editor
              .chain()
              .deleteRange({ from: range.from, to: range.to + query.length })
              .focus()
              .run()
            opts.onSlashCommand({ range, item, query })
          } else {
            console.error('No command found for slash item', props)
          }
        },
        items: opts?.slashItems
      }
    })
  ),
  TaskItem,
  TaskList,
  ListKeymap,
  Loading,
  Thinking,
  TrailingNode,
  AIOutput,
  Image,
  ...conditionalArrayItem(
    !!opts?.enableCaretIndicator,
    CaretIndicatorExtension.configure({
      debug: false,
      onSelectionUpdate: ({ editor }) => {
        console.log('CaretIndicator: Selection update triggered from editor.ts')
        const pos = editor.storage.caretIndicator.caretPosition
        if (pos && opts?.onCaretPositionUpdate) {
          console.log('CaretIndicator: Forwarding position to callback:', pos)
          opts.onCaretPositionUpdate(pos)
        }
      },
      updateDelay: 10 // Reduced delay for more responsive updates
    })
  ),
  Extension.create<{ pluginKey?: PluginKey }>({
    name: 'paste-handler',

    addProseMirrorPlugins() {
      const plugin = new Plugin({
        key: this.options.pluginKey,

        props: {
          handleDOMEvents: {
            paste(_, e) {
              const clipboardDataItems = Array.from(e.clipboardData?.items || [])
              if (clipboardDataItems.map((e) => e.kind).includes('file')) {
                e.preventDefault()
              }
            }
          }
        }
      })

      return [plugin]
    }
  })
  // Markdown,
]

const extensions = createEditorExtensions()

export const getEditorContentHTML = (content: JSONContent) => {
  return generateHTML(content, extensions)
}

export const getEditorContentJSON = (content: string) => {
  return generateJSON(content, extensions)
}

export const getEditorContentText = (content: string) => {
  const json = generateJSON(content, extensions)
  return generateText(json, extensions)
}

export type * from '@tiptap/core'
