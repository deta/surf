<script lang="ts">
  import { onMount } from 'svelte'

  import { Icon } from '@horizon/icons'
  import { getFileKind, getFileType, truncate } from '@horizon/utils'
  import { ResourceTypes } from '@horizon/types'

  import type { PillResource } from '../ContextBubbles.svelte'
  import FileIcon from '../../Resources/Previews/File/FileIcon.svelte'
  import { type Resource, useResourceManager } from '@horizon/core/src/lib/service/resources'
  import ContextBubbleItemWrapper, { type PillProperties } from './ContextBubbleItemWrapper.svelte'
  import ResourcePreview from '../../Resources/ResourcePreview.svelte'

  export let pill: PillResource
  export let pillProperties: PillProperties

  const MAX_TITLE_LENGTH = 300

  const resourceManager = useResourceManager()

  let resource: Resource | null = null
  let loading = false

  $: resourceState = resource ? resource.state : null
  $: isProcessing = resourceState !== null ? $resourceState === 'post-processing' : false

  onMount(async () => {
    if (pill.data.id) {
      loading = true
      resource = await resourceManager.getResource(pill.data.id)
      loading = false
    }
  })
</script>

<ContextBubbleItemWrapper {pill} {pillProperties} loading={isProcessing} on:remove-item on:select>
  <div class="w-full h-full relative">
    <div class="w-full h-full {isProcessing ? 'p-1' : ''}">
      {#if pill.data.type === ResourceTypes.DOCUMENT_SPACE_NOTE}
        <Icon name="docs" size="16px" />
      {:else if pill.icon}
        <img
          src={pill.icon}
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
    {/if}
  </div>

  <div slot="popover" class={resource ? 'p-1' : 'p-4 space-y-2'}>
    {#if resource}
      <ResourcePreview
        {resource}
        interactive={false}
        mode="compact"
        processingText="Preparing for chat…"
        frameless
      />
    {:else}
      <div class="text-slate-900 font-medium text-lg">
        {truncate(pill.title, MAX_TITLE_LENGTH)}
      </div>

      {#if loading}
        <div class="flex items-center gap-2">
          <Icon name="spinner" />
          <div class="text-slate-500">Preparing for chat…</div>
        </div>
      {:else}
        <div class="text-slate-500">
          {pill.data.type ? getFileType(pill.data.type) : 'Resource'}
        </div>
      {/if}
    {/if}
  </div>
</ContextBubbleItemWrapper>
