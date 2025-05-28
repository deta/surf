<script lang="ts">
  import { ContextItemTypes, type ContextItem } from '@horizon/core/src/lib/service/ai/context'
  import { useResourceManager } from '@horizon/core/src/lib/service/resources'
  import { DynamicIcon, Icon } from '@horizon/icons'
  import { useLogScope } from '@horizon/utils'
  import type { Readable } from 'svelte/store'

  export let item: ContextItem
  export let loading: boolean = false

  const log = useLogScope('NoteContextItemIcon')
  const resourceManager = useResourceManager()
  const resources = resourceManager.resources

  $: icon = item?.icon
  $: iconString = item?.iconString

  $: hasNestedItem = [ContextItemTypes.ACTIVE_TAB, ContextItemTypes.ACTIVE_SPACE].includes(
    item?.type
  )
  $: nestedItem = hasNestedItem ? ((item as any)?.item as Readable<ContextItem>) : null

  $: itemLoading = item?.loading

  // old comment from ContextBubbleResource.svelte
  // for some reason the resource that gets passed in is not the same as the one in the store
  // so the resource state in some cases doesn't properly update (only noticed it for PDFs)
  $: resource = $resources.find((r) => r.id === item?.id)

  $: resourceState = resource ? resource.state : null
  $: isProcessing =
    resourceState !== null
      ? $resourceState === 'post-processing' || $resourceState === 'extracting'
      : false
  $: processingFailed = resourceState !== null ? $resourceState === 'error' : false

  $: showLoading = isProcessing || loading || $itemLoading
</script>

{#if icon && icon}
  {#if nestedItem}
    <svelte:self item={$nestedItem} loading={$itemLoading} />
  {:else}
    <div class="w-full h-full relative" data-type={item.type}>
      <div class="w-full h-full {showLoading || processingFailed ? 'p-1' : ''}">
        <DynamicIcon name={$iconString} size={showLoading || processingFailed ? '10px' : '14px'} />
      </div>

      {#if showLoading}
        <div
          class="absolute z-10 left-0 top-0 w-full h-full flex items-center justify-center bg-white/10 text-sky-400"
        >
          <Icon name="spinner" size="100%" />
        </div>
      {:else if processingFailed}
        <div
          class="absolute z-10 left-0 top-0 w-full h-full flex items-center justify-center bg-red-500/50 text-white"
        >
          <Icon name="close" size="100%" />
        </div>
      {/if}
    </div>
  {/if}
{/if}
