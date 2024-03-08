<script lang="ts">
  import '@horizon/editor/src/editor.scss'

  import { getEditorContentText } from '@horizon/editor'
  import { onDestroy, onMount } from 'svelte'
  import type { ResourceNote } from '../../../service/resources'

  export let resource: ResourceNote
  export let limit: number = 200

  let summary = ''
  let loading = false

  const generateSummary = (value: string) => {
    const text = getEditorContentText(value)

    if (text.length > limit) {
      return text.slice(0, limit) + '…'
    } else {
      return text
    }
  }

  onMount(async () => {
    loading = true
    const content = await resource.getContent()
    summary = generateSummary(content)

    loading = false
  })

  onDestroy(() => {
    resource.releaseData()
  })
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="text-card-wrapper">
  <!-- <Editor
    bind:content={value}
    placeholder="Jot something down…"
    autofocus={false}
    readOnly
  /> -->
  <div class="text-card">
    {#if loading}
      <p>Loading…</p>
    {:else}
      <p>{summary}</p>
    {/if}
  </div>
</div>

<style lang="scss">
  .text-card-wrapper {
    width: 100%;
    height: 100%;
    position: relative;
    padding: 1rem;
    .text-card {
      padding: 1rem;
      background: #f6f5f2;
      p {
        font-family: monospace;
        font-size: 1rem;
        line-height: 1.5rem;
        font-weight: 500;
        flex-shrink: 0;
        color: #353534;
      }
    }
  }
</style>
