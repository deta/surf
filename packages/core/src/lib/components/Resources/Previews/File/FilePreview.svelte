<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'

  import { useLogScope } from '@horizon/utils'
  import ImageView from './ImageView.svelte'
  import { Resource } from '../../../../service/resources'
  import UnknownFileView from './UnknownFileView.svelte'
  import LoadingBox from '../../../Atoms/LoadingBox.svelte'
  import type { ResourcePreviewEvents } from '../../../Resources/events'

  export let resource: Resource

  const log = useLogScope('FilePreview')
  const dispatch = createEventDispatcher<ResourcePreviewEvents<Blob>>()

  let loading = false
  let error: null | string = null
  let data: Blob | null = null

  const handleLoad = () => {
    dispatch('load')
  }

  onMount(async () => {
    try {
      log.debug('Loading file data')
      if (resource.type.startsWith('image/')) {
        loading = true
        data = await resource.getData()
        dispatch('data', data)
      } else {
        log.debug('Skipped loading data for file type', resource.type)
      }
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
    {:else if data.type === 'application/pdf'}
      <iframe src={URL.createObjectURL(data)} width="100%" height="100%" style="overflow: hidden;"
      ></iframe>
    {:else}
      <UnknownFileView {resource} blob={data} hideType on:load={handleLoad} />
    {/if}
  {:else}
    <UnknownFileView {resource} hideType on:load={handleLoad} />
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
    overflow: hidden;
  }
</style>
