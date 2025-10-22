import type { Editor, Range } from '@tiptap/core'

export type SlashMenuItem = {
  id: string
  title: string
  icon: string
  section?: string
  tagline?: string
  keywords: string[]
  command: (item: SlashMenuItem, editor: Editor, range: Range) => void
}

export type SlashCommandPayload = { item: SlashMenuItem; range: Range; query: string }
