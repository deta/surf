<script lang="ts">
  import { onMount } from 'svelte'
  import type { Resource, ResourceManager } from '../../service/resources'
  import type { AIChatMessageSource } from './types'
  import ResourcePreviewClean from '../Resources/ResourcePreviewClean.svelte'
  import { useLogScope } from '../../utils/log'

  export let source: AIChatMessageSource
  export let resourceManager: ResourceManager

  const log = useLogScope('ChatResponseSource')

  let resource: Resource

  onMount(async () => {
    log.debug('Fetching resource with id', source.resource_id)
    const fetchedResource = await resourceManager.getResource(source.resource_id)
    if (!fetchedResource) {
      log.error(`Resource with id ${source.resource_id} not found`)
      return
    }

    log.debug('Fetched resource:', fetchedResource)

    resource = fetchedResource
  })
</script>

{#if resource}
  <ResourcePreviewClean {resource} on:click />
{:else if source.metadata && source.metadata.url}
  <div>
    {source.id})
    <a href={source.metadata.url}>{source.metadata.url}</a>
  </div>
{/if}

<style lang="scss">
</style>
