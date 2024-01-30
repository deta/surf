<svelte:options immutable={true} />

<script lang="ts">
  import type { Readable } from 'svelte/store';
  import { createEventDispatcher, onMount } from 'svelte'
  
  import { createEditor, Editor, EditorContent } from 'svelte-tiptap';
  import type { JSONContent } from '@tiptap/core';

  import { createEditorExtensions } from '../editor'
  import BubbleMenu from './BubbleMenu.svelte'

  export let content: JSONContent
  export let readOnly: boolean = false
  export let placeholder: string = `Write something or type '/' for options…`
  export let autofocus: boolean = true

  const dispatch = createEventDispatcher<{ update: JSONContent }>()

  let editor: Readable<Editor>;
  let focused = false

  onMount(() => {
    editor = createEditor({
      extensions: createEditorExtensions({ placeholder }),
      content: content,
      editable: !readOnly,
      autofocus: !autofocus || readOnly ? false : 'end',
      onUpdate: ({ editor }) => {
        editor = editor
        const json = editor.getJSON()
        // const oldContent = content
        content = json
        dispatch('update', content)
      },
      onFocus: () => {
        focused = true
      },
      onBlur: () => {
        focused = false
      },
    })
  })
</script>

<div class="editor">
  {#if editor && !readOnly}
    <BubbleMenu editor={editor} />
  {/if}

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
</style>
