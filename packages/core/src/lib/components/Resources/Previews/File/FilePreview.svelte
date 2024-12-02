<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'

  import { useLogScope } from '@horizon/utils'
  import ImageView from './ImageView.svelte'
  import { Resource } from '../../../../service/resources'
  import UnknownFileView from './UnknownFileView.svelte'
  import PDFView from './PDFView.svelte'
  import VideoView from './VideoView.svelte'
  import AudioView from './AudioView.svelte'
  import LoadingBox from '../../../Atoms/LoadingBox.svelte'
  import type { ResourcePreviewEvents } from '../../../Resources/events'

  export let resource: Resource
  export let preview = true

  const log = useLogScope('FilePreview')
  const dispatch = createEventDispatcher<ResourcePreviewEvents<Blob>>()

  let loading = false
  let error: null | string = null
  let data: Blob | null = null

  const ALWAYS_LOAD_TYPES = ['image/']

  const handleLoad = () => {
    dispatch('load')
  }

  onMount(async () => {
    try {
      log.debug('Loading file data')
      if (!preview && !ALWAYS_LOAD_TYPES.some((type) => resource.type.startsWith(type))) {
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

<div class="file-card" class:preview>
  {#if error}
    <p>{error}</p>
  {:else if loading}
    <LoadingBox />
  {:else if resource}
    {#if resource.type === 'application/pdf' && !preview}
      <PDFView {resource} on:load={handleLoad} />
    {:else if resource.type.startsWith('image/')}
      <ImageView resourceId={resource.id} fit="contain" on:load={handleLoad} />
      <!-- {#if preview}
        <ImageView blob={data} on:load={handleLoad} />
      {:else}
        <img
          src="surf://resource/{resource.id}"
          alt={resource.name}
          style="width: 100%; height: 100%; object-fit: contain;"
        />
      {/if} -->
    {:else if data && resource.type.startsWith('video/')}
      <VideoView {resource} blob={data} on:load={handleLoad} />
    {:else if data && resource.type.startsWith('audio/')}
      <AudioView {resource} blob={data} on:load={handleLoad} />
    {:else}
      <UnknownFileView {resource} blob={data ?? undefined} {preview} on:load={handleLoad} />
    {/if}
  {:else}
    <UnknownFileView {resource} {preview} on:load={handleLoad} />
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

    &.preview {
      //border-radius: 16px;
    }
  }
</style>
