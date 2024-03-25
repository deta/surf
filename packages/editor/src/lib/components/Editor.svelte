<svelte:options immutable={true} />

<script lang="ts">
  import type { Readable } from 'svelte/store'
  import { createEventDispatcher, onMount } from 'svelte'

  import { createEditor, Editor, EditorContent } from 'svelte-tiptap'

  import { createEditorExtensions } from '../editor'
  // import BubbleMenu from './BubbleMenu.svelte'

  export let content: string
  export let readOnly: boolean = false
  export let placeholder: string = `Write something or type '/' for options…`
  export let autofocus: boolean = true

  const dispatch = createEventDispatcher<{ update: string }>()

  export const focus = () => {
    if ($editor) {
      $editor.commands.focus()
    }
  }

  let editor: Readable<Editor>
  let focused = false

  onMount(() => {
    editor = createEditor({
      extensions: createEditorExtensions({ placeholder }),
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
