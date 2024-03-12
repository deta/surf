<script lang="ts">
  import { onDestroy, onMount } from 'svelte'

  import { useLogScope } from '../../../utils/log'
  import ImageView from './ImageView.svelte'
  import { Resource } from '../../../service/resources'
  import UnknownFileView from './UnknownFileView.svelte'
  import LoadingBox from '../../Atoms/LoadingBox.svelte'

  export let resource: Resource

  const log = useLogScope('FileCard')

  let loading = false
  let error: null | string = null
  let data: Blob | null = null

  onMount(async () => {
    try {
      loading = true
      data = await resource.getData()
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
    <LoadingBox />
  {:else if resource && data}
    {#if data.type.startsWith('image/')}
      <ImageView blob={data} />
    {:else}
      <UnknownFileView {resource} blob={data} hideType />
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
