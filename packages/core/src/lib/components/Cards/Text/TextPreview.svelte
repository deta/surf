<script lang="ts">
  import { type Writable } from 'svelte/store'

  import '@horizon/editor/src/editor.scss'

  import type { CardText } from '../../../types/index'
  import { getEditorContentText, type JSONContent } from '@horizon/editor'

  export let card: Writable<CardText>
  export let limit: number = 200

  $: value = $card.data.content

  const generateSummary = (value: JSONContent) => {
    const text = getEditorContentText(value)

    if (text.length > limit) {
      return text.slice(0, limit) + '…'
    } else {
      return text
    }
  }

  $: summary = generateSummary(value)
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="text-card">
  <!-- <Editor
    bind:content={value}
    placeholder="Jot something down…"
    autofocus={false}
    readOnly
  /> -->
  <p>{summary}</p>
</div>

<style lang="scss">
  .text-card {
    width: 100%;
    height: 100%;
    position: relative;
    padding: 1rem;
  }
</style>
