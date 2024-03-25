<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'

  import { useLogScope } from '../../../utils/log'
  import ImageView from './ImageView.svelte'
  import { Resource } from '../../../service/resources'
  import UnknownFileView from './UnknownFileView.svelte'
  import LoadingBox from '../../Atoms/LoadingBox.svelte'
  import type { ResourcePreviewEvents } from '../../Resources/events'

  export let resource: Resource

  const log = useLogScope('FileCard')
  const dispatch = createEventDispatcher<ResourcePreviewEvents<Blob>>()

  let loading = false
  let error: null | string = null
  let data: Blob | null = null

  const handleLoad = () => {
    dispatch('load')
  }

  onMount(async () => {
    try {
      loading = true
      data = await resource.getData()
      dispatch('data', data)
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
      <ImageView blob={data} on:load={handleLoad} />
    {:else}
      <UnknownFileView {resource} blob={data} hideType on:load={handleLoad} />
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
