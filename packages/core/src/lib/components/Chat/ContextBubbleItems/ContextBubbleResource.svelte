<script lang="ts">
  import { onMount } from 'svelte'

  import { Icon } from '@horizon/icons'
  import { getFileKind, getFileType, truncate, getHostname } from '@horizon/utils'
  import { ResourceTypes } from '@horizon/types'

  import type { PillResource } from '../ContextBubbles.svelte'
  import FileIcon from '../../Resources/Previews/File/FileIcon.svelte'
  import { type Resource, useResourceManager } from '@horizon/core/src/lib/service/resources'
  import ContextBubbleItemWrapper, { type PillProperties } from './ContextBubbleItemWrapper.svelte'
  import ResourceHoverPreview from '../ResourceHoverPreview.svelte'

  export let pill: PillResource
  export let pillProperties: PillProperties

  const resourceManager = useResourceManager()

  let resource: Resource | null = null
  let loading = false
  let iconUrl: string | undefined = pill.icon

  $: resourceState = resource ? resource.state : null
  $: isProcessing = resourceState !== null ? $resourceState === 'post-processing' : false
  $: processingFailed = resourceState !== null ? $resourceState === 'error' : false

  $: if (resource && resource.type === 'application/pdf') {
    iconUrl = resource.metadata?.sourceURI
      ? `https://www.google.com/s2/favicons?domain=${getHostname(resource.metadata.sourceURI)}&sz=48`
      : pill.icon
  }

  onMount(async () => {
    if (pill.data.id) {
      loading = true
      resource = await resourceManager.getResource(pill.data.id)
      loading = false
    }
  })
</script>

<ContextBubbleItemWrapper
  {pill}
  {pillProperties}
  loading={isProcessing}
  failed={processingFailed}
  on:remove-item
  on:select
  on:retry
>
  <div class="w-full h-full relative">
    <div class="w-full h-full {isProcessing || processingFailed ? 'p-1' : ''}">
      {#if pill.data.type === ResourceTypes.DOCUMENT_SPACE_NOTE}
        <Icon name="docs" size="16px" />
      {:else if iconUrl}
        <img
          src={iconUrl}
          alt={pill.title}
          class="w-full h-full object-contain"
          style="transition: transform 0.3s;"
          loading="lazy"
        />
      {:else if pill.data.type}
        <FileIcon kind={getFileKind(pill.data.type)} />
      {:else}
        <Icon name="world" size="20px" color="black" />
      {/if}
    </div>

    {#if isProcessing}
      <div
        class="absolute z-10 -top-1 -left-1 w-[calc(100%+8px)] h-[calc(100%+8px)] flex items-center justify-center bg-white/10 text-sky-400"
      >
        <Icon name="spinner" size="100%" />
      </div>
    {:else if processingFailed}
      <!-- <div
        class="absolute z-10 -top-1 -left-1 w-[calc(100%+8px)] h-[calc(100%+8px)] flex items-center justify-center bg-red-500/50 text-white"
      >
        <Icon name="close" size="100%" />
      </div> -->
    {/if}
  </div>

  <ResourceHoverPreview
    {resource}
    {loading}
    title={pill.title}
    type={pill.data.type}
    slot="popover"
  />
</ContextBubbleItemWrapper>
