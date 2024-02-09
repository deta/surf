import { Extension } from '@tiptap/core'

import DragHandleComp from './DragHandle'

export interface DragHandleOptions {}

export const DragHandle = Extension.create<DragHandleOptions>({
  name: 'DragHandle',

  addProseMirrorPlugins() {
    return [
      DragHandleComp({
        dragHandleWidth: 24
      })
    ]
  }
})
