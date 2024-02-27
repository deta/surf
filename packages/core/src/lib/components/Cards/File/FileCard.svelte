<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import type { Writable } from 'svelte/store'

  import { useLogScope } from '../../../utils/log'
  import type { Horizon } from '../../../service/horizon'
  import ImageView from './ImageView.svelte'
  import type { Resource } from '../../../service/resources'
  import type { Card } from '../../../types'

  export let card: Writable<Card>
  export let horizon: Horizon

  const log = useLogScope('FileCard')

  let loading = false
  let error: null | string = null
  let resource: Resource | null = null
  let data: Blob | null = null

  onMount(async () => {
    try {
      loading = true

      if (!$card.resourceId) {
        log.error('No resource id found', $card)
        error = 'No resource id found'
        return
      }

      resource = await horizon.getResource($card.resourceId)
      if (!resource) {
        log.error('Resource not found', $card.resourceId)
        error = 'Resource not found'
        return
      }

      data = await resource.getData()
    } catch (e) {
      log.error(e)
    } finally {
      loading = false
    }
  })

  onDestroy(() => {
    if (resource) {
      resource.releaseData()
    }
  })
</script>

<div class="file-card">
  {#if error}
    <p>{error}</p>
  {:else if loading}
    <p>Loading…</p>
  {:else if resource && data}
    {#if data.type.startsWith('image/')}
      <ImageView blob={data} />
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
