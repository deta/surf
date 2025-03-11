import { Extension } from '@tiptap/core'
import Suggestion from '@horizon/editor/src/lib/utilities/Suggestion'

export default Extension.create({
  name: 'slash',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        allowSpaces: true,
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
