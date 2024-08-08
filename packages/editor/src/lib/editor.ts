import { type JSONContent, generateHTML, generateText, generateJSON } from '@tiptap/core'
import Link from '@tiptap/extension-link'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'

import { DragHandle } from './extensions/DragHandle/DragHandleExtension'
import Slash from './extensions/Slash/SlashExtension'
import suggestion from './extensions/Hashtag/suggestion'
import Hashtag from './extensions/Hashtag/index'

export type ExtensionOptions = { placeholder?: string; disableHashtag?: boolean }
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
  ...(opts?.disableHashtag
    ? []
    : [
        Hashtag.configure({
          suggestion: suggestion
        })
      ]),
  Placeholder.configure({
    placeholder: opts?.placeholder ?? "Write something or type '/' for options…"
  }),
  TaskItem,
  TaskList
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
