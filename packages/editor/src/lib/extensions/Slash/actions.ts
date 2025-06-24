import { isMac } from '@horizon/editor/src/lib/utilities'
import type { SlashMenuItem } from './types'

export const BUILT_IN_SLASH_COMMANDS = [
  {
    id: 'autocomplete',
    icon: 'cursor',
    title: 'Ask Surf...',
    section: 'Smart Note',
    keywords: ['ai', 'surf', '@', 'smart', 'ask'],
    tagline: `${isMac() ? '⌘' : 'ctrl'} + ↵`
  },
  {
    id: 'suggestions',
    icon: 'sparkles',
    title: 'Get Suggestions',
    section: 'Smart Note',
    keywords: ['ai', 'surf', 'smart'],
    tagline: 'space'
  },
  // {
  //   id: 'generate-surflet',
  //   icon: 'code-block',
  //   title: 'Generate Surflet',
  //   section: 'Smart Note',
  //   keywords: ['ai', 'surf', 'smart', 'app', 'chart']
  // },
  {
    id: 'mention-context',
    icon: 'mention',
    title: 'Mention Context',
    section: 'Smart Note',
    keywords: ['ai', 'surf', 'smart', 'context', 'space', 'stuff', '@'],
    tagline: '@',
    command: (_, editor, range) => {
      // insert a '@' at the current position which will trigger the mention extension
      editor.chain().deleteRange(range).focus().insertContent('@').run()
    }
  },
  // {
  //     id: 'search-stuff',
  //     icon: 'search',
  //     title: 'Search My Stuff',
  //     section: 'My Stuff',
  //     keywords: ['surf', 'smart', 'stuff', 'resource']
  // },
  {
    id: 'plain-text',
    icon: 'paragraph',
    title: 'Plain Text',
    section: 'Basic Elements',
    keywords: ['plain', 'text', 'paragraph', 'p'],
    command: (_, editor, range) => {
      editor.chain().focus().deleteRange(range).setParagraph().run()
    }
  },
  {
    id: 'heading-1',
    icon: 'h1',
    title: 'Heading 1',
    section: 'Basic Elements',
    keywords: ['1', 'first', 'heading', 'title', 'header', '#'],
    tagline: '#',
    command: (_, editor, range) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run()
    }
  },
  {
    id: 'heading-2',
    icon: 'h2',
    title: 'Heading 2',
    section: 'Basic Elements',
    keywords: ['2', 'second', 'heading', 'title', 'header', '##'],
    tagline: '##',
    command: (_, editor, range) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
    }
  },
  {
    id: 'heading-3',
    icon: 'h3',
    title: 'Heading 3',
    section: 'Basic Elements',
    keywords: ['3', 'third', 'heading', 'title', 'header', '###'],
    tagline: '###',
    command: (_, editor, range) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run()
    }
  },
  {
    id: 'list-bulleted',
    icon: 'list',
    title: 'Bulleted List',
    section: 'Basic Elements',
    keywords: ['list', 'bullet', '-', 'unordered', '•'],
    tagline: '‒',
    command: (_, editor, range) => {
      editor.chain().deleteRange(range).focus().toggleBulletList().run()
    }
  },
  {
    id: 'list-numbered',
    icon: 'list-numbered',
    title: 'Numbered List',
    section: 'Basic Elements',
    keywords: [
      'list',
      'numbered',
      'ordered',
      '1.',
      '2.',
      '3.',
      '4.',
      '5.',
      '6.',
      '7.',
      '8.',
      '9.',
      '10.'
    ],
    tagline: '1.',
    command: (_, editor, range) => {
      editor.chain().deleteRange(range).focus().toggleOrderedList().run()
    }
  },
  {
    id: 'list-tasks',
    icon: 'list-check',
    title: 'To-Do List',
    section: 'Basic Elements',
    keywords: ['list', 'tasks', 'to do', 'checked', 'unchecked', '[]'],
    tagline: '[]',
    command: (_, editor, range) => {
      editor.chain().deleteRange(range).focus().toggleTaskList().run()
    }
  },
  {
    id: 'details-block',
    icon: 'list-details',
    title: 'Toggle List',
    section: 'Basic Elements',
    keywords: ['list', 'block', '>', 'details', 'summary'],
    tagline: '>',
    command: (_, editor, range) => {
      editor.chain().deleteRange(range).focus().setDetails().run()
    }
  },
  {
    id: 'table-block',
    icon: 'table',
    title: 'Table',
    section: 'Basic Elements',
    keywords: ['table', 'grid', '|'],
    tagline: '',
    command: (_, editor, range) => {
      editor.chain().deleteRange(range).focus().insertTable().run()
    }
  },
  {
    id: 'blockquote',
    icon: 'quote',
    title: 'Blockquote',
    section: 'Basic Elements',
    keywords: ['quote', '|'],
    tagline: '|',
    command: (_, editor, range) => {
      editor.chain().deleteRange(range).focus().toggleBlockquote().run()
    }
  },
  {
    id: 'code-block',
    icon: 'code-block',
    title: 'Code Block',
    section: 'Basic Elements',
    keywords: ['code', 'block', '```'],
    tagline: '```',
    command: (_, editor, range) => {
      editor.chain().deleteRange(range).focus().toggleCodeBlock().run()
    }
  },
  {
    id: 'divider',
    icon: 'minus',
    title: 'Divider',
    section: 'Basic Elements',
    keywords: ['divider', 'horizontal rule', 'line', '---'],
    tagline: '---',
    command: (_, editor, range) => {
      editor.chain().deleteRange(range).focus().setHorizontalRule().run()
    }
  }
] as SlashMenuItem[]
