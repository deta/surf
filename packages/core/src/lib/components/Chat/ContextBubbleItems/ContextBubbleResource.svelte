<script lang="ts">
  import { Icon } from '@horizon/icons'
  import { getFileKind } from '@horizon/utils'

  import FileIcon from '../../Resources/Previews/File/FileIcon.svelte'
  import ContextBubbleItemWrapper, { type PillProperties } from './ContextBubbleItemWrapper.svelte'
  import ResourceHoverPreview from '../ResourceHoverPreview.svelte'
  import type { ContextItemResource } from '@horizon/core/src/lib/service/ai/contextManager'
  import { useResourceManager } from '@horizon/core/src/lib/service/resources'

  export let item: ContextItemResource
  export let pillProperties: PillProperties
  export let additionalLabel: string | undefined = undefined

  const resourceManager = useResourceManager()
  const resources = resourceManager.resources

  $: label = item.label
  $: icon = item.icon

  // for some reason the resource that gets passed in is not the same as the one in the store
  // so the resource state in some cases doesn't properly update (only noticed it for PDFs)
  $: resource = $resources.find((r) => r.id === item.id)

  $: resourceState = resource ? resource.state : null
  $: isProcessing =
    resourceState !== null
      ? $resourceState === 'post-processing' || $resourceState === 'extracting'
      : false
  $: processingFailed = resourceState !== null ? $resourceState === 'error' : false
</script>

<ContextBubbleItemWrapper
  {item}
  {pillProperties}
  loading={isProcessing}
  failed={processingFailed}
  {additionalLabel}
  on:remove-item
  on:select
  on:retry
>
  <div class="w-full h-full relative">
    <div class="w-full h-full {isProcessing || processingFailed ? 'p-1' : ''}">
      {#if $icon.type === 'icon'}
        <Icon name={$icon.data} size="16px" />
      {:else if $icon.type === 'image'}
        <img
          src={$icon.data}
          alt={$label}
          class="w-full h-full object-contain"
          style="transition: transform 0.3s;"
          loading="lazy"
        />
      {:else if resource}
        <FileIcon kind={getFileKind(resource.type)} />
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

  <ResourceHoverPreview {resource} title={$label} type={resource?.type} slot="popover" />
</ContextBubbleItemWrapper>
