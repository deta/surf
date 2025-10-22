import type { SlashMenuItem } from './types'

export const BUILT_IN_SLASH_COMMANDS = [
  {
    id: 'plain-text',
    icon: 'paragraph',
    title: 'Plain Text',
    section: 'Insert',
    keywords: ['plain', 'text', 'paragraph', 'p'],
    command: (_, editor, range) => {
      editor.chain().focus().deleteRange(range).setParagraph().run()
    }
  },
  {
    id: 'heading-1',
    icon: 'h1',
    title: 'Heading 1',
    section: 'Insert',
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
    section: 'Insert',
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
    section: 'Insert',
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
    section: 'Insert',
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
    section: 'Insert',
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
    section: 'Insert',
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
    section: 'Insert',
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
    section: 'Insert',
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
    section: 'Insert',
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
    section: 'Insert',
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
    section: 'Insert',
    keywords: ['divider', 'horizontal rule', 'line', '---'],
    tagline: '---',
    command: (_, editor, range) => {
      editor.chain().deleteRange(range).focus().setHorizontalRule().run()
    }
  }
] as SlashMenuItem[]
