<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import type { Writable } from 'svelte/store'

  import { useLogScope } from '../../../utils/log'
  import type { Horizon } from '../../../service/horizon'
  import ImageView from './ImageView.svelte'
  import type { Resource } from '../../../service/resources'
  import type { Card } from '../../../types'
  import UnknownFileView from './UnknownFileView.svelte'
  import PdfView from './PDFView.svelte'
  import { getFileKind } from '../../../utils/files'
  import VideoView from './VideoView.svelte'
  import AudioView from './AudioView.svelte'
  import type { MagicFieldParticipant } from '../../../service/magicField'

  export let card: Writable<Card>
  export let horizon: Horizon
  export let magicFieldParticipant: MagicFieldParticipant | null = null

  const log = useLogScope('FileCard')

  let loading = false
  let error: null | string = null
  let resource: Resource | null = null
  let data: Blob | null = null

  $: fileKind = data ? getFileKind(data.type) : null

  const handleDragStart = (event: DragEvent) => {
    if (!resource) return

    event.preventDefault()
    window.api.startDrag(resource.id, resource.path, resource.type)
  }

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

<div class="file-card" on:dragstart={handleDragStart} draggable="true">
  {#if error}
    <p>{error}</p>
  {:else if loading}
    <p>Loading…</p>
  {:else if resource && data}
    {#if fileKind === 'image'}
      <div class="image" style="height:100%;">
        <ImageView blob={data} />
      </div>
    {:else if data.type === 'application/pdf'}
      <PdfView {resource} blob={data} />
    {:else if fileKind === 'video'}
      <VideoView {magicFieldParticipant} {resource} blob={data} />
    {:else if fileKind === 'audio'}
      <AudioView {magicFieldParticipant} {resource} blob={data} />
    {:else}
      <UnknownFileView {resource} blob={data} />
    {/if}
  {/if}
</div>

<style lang="scss">
  .file-card {
    width: 100%;
    height: 100%;
    /*display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: stretch;*/
    margin: 0;
    padding: 0;
  }

  /* NOTE: Not sure why it is here, lemme know if it breka sth. but disabled it for now, any unneeded box-shadows only consume performance
            and I couldnt find a visual goal this servers */
  /*.image {
    border-radius: 2px;
    box-shadow: 0px 0px 1px 0px rgba(255, 255, 255, 0.09) inset;
  }*/
</style>
