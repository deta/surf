<script lang="ts">
  import { onDestroy, onMount } from 'svelte'

  import { useLogScope } from '../../../utils/log'
  import ImageView from './ImageView.svelte'
  import { Resource } from '../../../service/resources'

  export let resource: Resource

  const log = useLogScope('FileCard')

  let loading = false
  let error: null | string = null
  let data: Blob | null = null

  onMount(async () => {
    try {
      loading = true
      data = await resource.getData()
      log.debug('Data loaded', data)
    } catch (e) {
      log.error(e)
    } finally {
      loading = false
    }
  })

  onDestroy(() => {
    resource.releaseData()
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
