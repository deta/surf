import { Extension } from '@tiptap/core'
import Suggestion from '../../utilities/Suggestion'

export default Extension.create({
  name: 'slash',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        allowSpaces: true,
        preventReTrigger: true,
        dismissOnSpace: true,
        placeholder: 'Insert…'
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
