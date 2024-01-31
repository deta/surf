<script lang="ts">
  import { onMount } from 'svelte'
  import type { Writable } from 'svelte/store'

  import type { CardFile, Resource } from '../../../types'
  import { useLogScope } from '../../../utils/log'
  import type { Horizon } from '../../../service/horizon'
    import ImageView from './ImageView.svelte'

  export let card: Writable<CardFile>
  export let horizon: Horizon

  const log = useLogScope('FileCard')

  let loading = false
  let error: null | string = null
  let resource: Resource | null = null

  $: fileType = $card.data.mimetype

  onMount(async () => {
    try {
      loading = true
      const fetchedResource = await horizon.getResource($card.data.resourceId)

      if (fetchedResource) {
        resource = fetchedResource
      } else {
        log.error('Resource not found', $card.data.resourceId)
        error = 'Resource not found'
      }
    } catch (e) {
      log.error(e)
    } finally {
      loading = false
    }
  })
</script>

<div class="file-card">
  {#if error}
    <p>{error}</p>
  {:else if loading}
    <p>Loading…</p>
  {:else if resource}
    {#if fileType.startsWith('image/')}
      <ImageView resource={resource} />
    {:else}
      <h1>Unsupported File Type</h1>
      <p>No view available to display this file.</p>
    {/if}
  {/if}
</div>

<style lang="scss">
  .file-card {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
  }
</style>
