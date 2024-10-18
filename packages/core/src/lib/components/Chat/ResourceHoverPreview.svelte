<script lang="ts">
  import type { Resource } from '@horizon/core/src/lib/service/resources'
  import ResourcePreview from '../Resources/ResourcePreview.svelte'
  import { getFileType, truncate } from '@horizon/utils'
  import { Icon } from '@horizon/icons'

  export let resource: Resource | null = null
  export let loading: boolean = false
  export let title: string
  export let type: string = ''

  const MAX_TITLE_LENGTH = 300
</script>

<div class={resource ? 'p-1' : 'p-4 space-y-2'}>
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
      {truncate(title, MAX_TITLE_LENGTH)}
    </div>

    {#if loading}
      <div class="flex items-center gap-2">
        <Icon name="spinner" />
        <div class="text-slate-500">Preparing for chat…</div>
      </div>
    {:else}
      <div class="text-slate-500">
        {type ? getFileType(type) : 'Resource'}
      </div>
    {/if}
  {/if}
</div>
