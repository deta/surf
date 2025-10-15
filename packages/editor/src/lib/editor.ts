import {
  type JSONContent,
  generateHTML,
  generateJSON,
  generateText,
  Editor,
  type Range,
  Extension,
  wrappingInputRule
} from '@tiptap/core'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import ListKeymap from '@tiptap/extension-list-keymap'
import Image from '@tiptap/extension-image'
import Underline from '@tiptap/extension-underline'
import { Mathematics } from '@tiptap/extension-mathematics'
import Blockquote from '@tiptap/extension-blockquote'
import Details from '@tiptap/extension-details'
import DetailsContent from '@tiptap/extension-details-content'
import DetailsSummary from '@tiptap/extension-details-summary'
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { all, createLowlight } from 'lowlight'

import { DragHandle } from './extensions/DragHandle/DragHandleExtension'
import { SlashExtension, SlashSuggestion, type SlashCommandPayload } from './extensions/Slash/index'
import hashtagSuggestion from './extensions/Hashtag/suggestion'
import Hashtag from './extensions/Hashtag/index'
import Mention, { type MentionAction } from './extensions/Mention/index'
import mentionSuggestion, { type MentionItemsFetcher } from './extensions/Mention/suggestion'
import { type CaretPosition } from './extensions/CaretIndicator'
import Loading from './extensions/Loading'
import Thinking from './extensions/Thinking'
import TrailingNode from './extensions/TrailingNode'
import AIOutput from './extensions/AIOutput'
import type { MentionItem } from './types'
import Button from './extensions/Button'
import Resource from './extensions/Resource'
import type { ComponentType, SvelteComponent } from 'svelte'
import { conditionalArrayItem } from '@deta/utils'
import type { SlashItemsFetcher } from './extensions/Slash/suggestion'
import { Citation } from './extensions/Citation/citation'
import { Surflet } from './extensions/Surflet/surflet'
import { WebSearch } from './extensions/WebSearch/websearch'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import Link from './extensions/Link'
import type { LinkClickHandler } from './extensions/Link/helpers/clickHandler'
import { detailsInputRule } from './utilities/inputRules/details'
import AIPrompt from './extensions/AIPrompt'
import AIGeneration from './extensions/AIGeneration'
import { TitleNode } from './extensions/TitleNode'
import Youtube from './extensions/Youtube'

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
  onFloatyInputStateChange?: (state: 'inline' | 'floaty' | 'bottom') => void
  onFirstLineStateChanged?: (isFirstLine: boolean) => void
  onLastLineVisibilityChanged?: (visible: boolean) => void
  surfletComponent?: ComponentType<SvelteComponent>
  webSearchComponent?: ComponentType<SvelteComponent>
  onWebSearchCompleted?: (results: any, query: string) => void
  onLinkClick?: LinkClickHandler
  // Title node options
  enableTitleNode?: boolean
  titlePlaceholder?: string
  initialTitle?: string
  titleLoading?: boolean
  onTitleChange?: (title: string) => void
}

const lowlight = createLowlight(all)

// match the > char followed by a space
const detailsRegex = /^\s*>\s$/

// match the | char followed by a space
const blockquoteRegex = /^\s*\|\s$/

export const createEditorExtensions = (opts?: ExtensionOptions) => [
  StarterKit.configure({
    heading: {
      levels: [1, 2, 3]
    },
    dropcursor: {
      color: 'var(--accent)',
      width: 2
    },
    codeBlock: false,
    blockquote: false
  }),
  ...conditionalArrayItem(
    !!opts?.enableTitleNode,
    TitleNode.configure({
      placeholder: opts?.titlePlaceholder || 'Untitled',
      initialTitle: opts?.initialTitle || '',
      onTitleChange: opts?.onTitleChange,
      isLoading: opts?.titleLoading || false
    })
  ),
  Mathematics.configure({
    regex: /\$\$([^$]+)\$\$|\$(?!\s)([^$\n]+)(?<!\s)\$/gi
  }),
  Underline,
  Link.configure({
    onClick: opts?.onLinkClick,
    protocols: ['surf'],
    HTMLAttributes: {
      target: '_blank'
    }
  }),
  CodeBlockLowlight.configure({
    lowlight
  }),
  Blockquote.extend({
    addInputRules() {
      return [
        wrappingInputRule({
          find: blockquoteRegex,
          type: this.type
        })
      ]
    }
  }),
  Details.configure({
    persist: true,
    HTMLAttributes: {
      class: 'details'
    }
  }).extend({
    addInputRules() {
      return [
        detailsInputRule({
          find: detailsRegex,
          type: this.type
        })
      ]
    }
  }),
  DetailsSummary,
  DetailsContent,
  Table.configure({
    resizable: true
  }),
  TableRow,
  TableHeader,
  TableCell,
  // TableAddRowColumn,
  Button.configure({
    onClick: opts?.buttonClick
  }),
  // UseAsDefaultBrowser,
  // OpenStuff,
  Placeholder.configure({
    placeholder: ({ node }) => {
      if (node.type.name === 'detailsSummary') {
        return 'Toggle'
      }

      if (node.type.name === 'titleNode') {
        return opts?.titlePlaceholder || 'Untitled'
      }

      return opts?.placeholder ?? "Write or type '/' for options…"
    }
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
  ...conditionalArrayItem(
    !!opts?.webSearchComponent,
    WebSearch.configure({
      component: opts?.webSearchComponent,
      onWebSearchCompleted: opts?.onWebSearchCompleted,
      onLinkClick: opts?.onLinkClick
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
            item.command(item, editor, {
              from: range.from,
              to: range.to + query.length
            })
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
  TaskList.configure({
    HTMLAttributes: {
      class: 'extension-task-list'
    }
  }),
  ListKeymap,
  Loading,
  Thinking,
  TrailingNode,
  AIOutput,
  AIPrompt,
  AIGeneration,
  Image,
  Youtube.configure({
    controls: true,
    nocookie: true,
    allowFullscreen: true,
    autoplay: false,
    modestBranding: true
  }),
  Extension.create<{ pluginKey?: PluginKey }>({
    name: 'paste-handler',

    addProseMirrorPlugins() {
      const plugin = new Plugin({
        key: this.options.pluginKey,

        props: {
          handleDOMEvents: {
            paste(view, e) {
              const clipboardDataItems = Array.from(e.clipboardData?.items || [])
              const hasFiles = clipboardDataItems.some((item) => item.kind === 'file')

              // Check for HTML with images
              const htmlData = e.clipboardData?.getData('text/html')
              const hasHtmlImages = htmlData && htmlData.includes('<img')

              if (hasFiles || hasHtmlImages) {
                // Extract files immediately before clipboard data is cleared
                const files: File[] = []
                for (const item of clipboardDataItems) {
                  if (item.kind === 'file') {
                    const file = item.getAsFile()
                    if (file) {
                      files.push(file)
                    }
                  }
                }

                // Dispatch custom event with the files and HTML data
                if (files.length > 0 || hasHtmlImages) {
                  const customEvent = new CustomEvent('editor-file-paste', {
                    detail: { files, htmlData },
                    bubbles: true,
                    cancelable: true
                  })
                  view.dom.dispatchEvent(customEvent)

                  // Prevent default paste behavior
                  e.preventDefault()
                  return true
                }
              }
              return false
            }
          }
        }
      })

      return [plugin]
    }
  })
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
