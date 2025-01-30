import { type JSONContent, generateHTML, generateText, generateJSON, Editor } from '@tiptap/core'
import Link from '@tiptap/extension-link'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import ListKeymap from '@tiptap/extension-list-keymap'
import Image from '@tiptap/extension-image'
import { Markdown } from 'tiptap-markdown'

import { DragHandle } from './extensions/DragHandle/DragHandleExtension'
import Slash from './extensions/Slash/SlashExtension'
import hashtagSuggestion from './extensions/Hashtag/suggestion'
import Hashtag from './extensions/Hashtag/index'
import Mention, { type MentionAction } from './extensions/Mention/index'
// import Mention from '@tiptap/extension-mention'
import mentionSuggestion from './extensions/Mention/suggestion'
import Loading from './extensions/Loading'
import AIOutput from './extensions/AIOutput'
import type { MentionItem } from './types'
import type { SuggestionOptions } from '@tiptap/suggestion'
import Button from './extensions/Button'
import Resource from './extensions/Resource'
import type { ComponentType, SvelteComponent } from 'svelte'
import { conditionalArrayItem } from '@horizon/utils'

export type ExtensionOptions = {
  placeholder?: string
  disableHashtag?: boolean
  enhanceCodeBlock?: boolean
  parseMentions?: boolean
  readOnlyMentions?: boolean
  searchMentions?: (props: {
    query: string
    editor: Editor
  }) => MentionItem[] | Promise<MentionItem[]>
  mentionClick?: (item: MentionItem, action: MentionAction) => void
  mentionInsert?: (item: MentionItem) => void
  buttonClick?: (action: string) => void
  resourceComponent?: ComponentType<SvelteComponent>
  resourceComponentPreview?: boolean
}

export const createEditorExtensions = (opts?: ExtensionOptions) => [
  StarterKit.configure({
    heading: {
      levels: [1, 2, 3]
    }
  }),
  Link.extend({
    addAttributes() {
      return {
        href: {
          default: null
        },
        'data-sveltekit-reload': {
          default: true
        },
        target: {
          default: null,
          renderHTML: () => {
            return {
              target:
                window.location.origin.includes('deta.space') ||
                window.location.origin.includes('localhost')
                  ? '_self'
                  : '_blank'
            }
          }
        }
      }
    }
  }),
  Button.configure({
    onClick: opts?.buttonClick
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
        items: opts?.searchMentions
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
  TaskItem,
  TaskList,
  ListKeymap,
  Loading,
  AIOutput,
  Image
  // Markdown,
  // DragHandle,
  // Slash.configure({
  // 	suggestion
  // })
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
