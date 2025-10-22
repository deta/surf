import type { Editor } from '@tiptap/core'

export const isInTitleNode = (editor: Editor): boolean => {
  const { selection } = editor.state
  const currentNode = selection.$from.node()
  return currentNode?.type.name === 'titleNode'
}
