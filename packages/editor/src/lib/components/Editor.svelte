<svelte:options immutable={true} />

<script lang="ts">
  import type { Readable } from 'svelte/store'
  import { createEventDispatcher, onMount } from 'svelte'

  import { createEditor, Editor, EditorContent } from 'svelte-tiptap'
  import { Extension } from '@tiptap/core'

  import { createEditorExtensions } from '../editor'
  // import BubbleMenu from './BubbleMenu.svelte'

  export let content: string
  export let readOnly: boolean = false
  export let placeholder: string = `Write something or type '/' for options…`
  export let autofocus: boolean = true
  export let focused = false

  const dispatch = createEventDispatcher<{ update: string; submit: void }>()

  export const focus = () => {
    if ($editor) {
      $editor.commands.focus()
    }
  }

  export const clear = () => {
    if ($editor) {
      $editor.commands.clearContent()
    }
  }

  let editor: Readable<Editor>

  const onSubmit = () => {
    if (focused) {
      dispatch('submit')
    }
  }

  const KeyboardHandler = Extension.create({
    name: 'keyboardHandler'
  })

  const extension = KeyboardHandler.extend({
    addKeyboardShortcuts() {
      return {
        Enter: () => {
          onSubmit()
          return true
        },

        'Shift-Enter': () => {
          /**
           * currently we do not have an option to show a soft line break in the posts, so we overwrite
           * the behavior from tiptap with the default behavior on pressing enter
           */
          return this.editor.commands.first(({ commands }) => [
            () => commands.newlineInCode(),
            () => commands.createParagraphNear(),
            () => commands.liftEmptyBlock(),
            () => commands.splitBlock()
          ])
        }
      }
    }
  })

  onMount(() => {
    editor = createEditor({
      extensions: [...createEditorExtensions({ placeholder }), extension],
      content: content,
      editable: !readOnly,
      autofocus: !autofocus || readOnly ? false : 'end',
      onUpdate: ({ editor }) => {
        editor = editor
        const html = editor.getHTML()
        // const oldContent = content
        content = html
        dispatch('update', content)
      },
      onFocus: () => {
        focused = true
      },
      onBlur: () => {
        focused = false
      }
    })
  })
</script>

<div class="editor">
  <!-- {#if editor && !readOnly}
    <BubbleMenu {editor} />
  {/if} -->

  <div class="editor-wrapper">
    <EditorContent editor={$editor} />
  </div>
</div>

<style lang="scss">
  .editor-wrapper {
    height: 100%;
    overflow-y: auto;
    cursor: text;
  }

  :global(.editor-wrapper > div) {
    height: 100%;
  }
</style>
