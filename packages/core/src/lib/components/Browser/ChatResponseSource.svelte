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
    const fetchedResource = await resourceManager.getResource(source.resource_id)
    if (!fetchedResource) {
      log.error(`Resource with id ${source.resource_id} not found`)
      return
    }

    resource = fetchedResource
  })
</script>

{#if resource}
  <ResourcePreviewClean {resource} />
{/if}

<style lang="scss">
</style>
