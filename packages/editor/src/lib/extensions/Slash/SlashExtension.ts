import { Extension } from '@tiptap/core'
import Suggestion from '@deta/editor/src/lib/utilities/Suggestion'

export default Extension.create({
  name: 'slash',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        allowSpaces: true,
        preventReTrigger: true,
        dismissOnSpace: true,
        placeholder: 'filter or search stuff…'
      }
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion
      })
    ]
  }
})
