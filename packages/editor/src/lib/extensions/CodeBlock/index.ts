import CodeBlock from '@tiptap/extension-code-block'
import { SvelteNodeViewRenderer } from 'svelte-tiptap'
import TiptapCodeBlock from '../../components/TiptapCodeBlock.svelte'

const baseCodeBlock = CodeBlock.configure({
  exitOnArrowDown: false
})

export const CodeBlockExtension = baseCodeBlock.extend({
  addNodeView() {
    return SvelteNodeViewRenderer(TiptapCodeBlock)
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      code: {
        default: null,
        parseHTML: (element) => {
          return element.textContent
        },
        rendered: false
      }
    }
  }
})
