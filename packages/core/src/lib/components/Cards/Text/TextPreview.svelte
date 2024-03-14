<script lang="ts">
  import '@horizon/editor/src/editor.scss'

  import { getEditorContentText } from '@horizon/editor'
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'
  import type { ResourceNote } from '../../../service/resources'
  import LoadingBox from '../../Atoms/LoadingBox.svelte'
  import { get } from 'svelte/store'

  export let resource: ResourceNote
  export let limit: number = 200

  const dispatch = createEventDispatcher<{ data: string }>()

  const content = resource.parsedData
  let summary = ''
  let loading = false

  $: summary = generateSummary($content ?? '')

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

    const parsedData = await resource.getContent()
    const text = get(parsedData)
    dispatch('data', text ?? '')

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
      <LoadingBox />
    {:else}
      <p>{summary || 'empty note'}</p>
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
        font-family: inherit;
        font-size: 1rem;
        line-height: 1.5rem;
        font-weight: 500;
        flex-shrink: 0;
        color: #353534;
      }
    }
  }
</style>
