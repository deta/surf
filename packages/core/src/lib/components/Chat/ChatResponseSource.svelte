<script lang="ts">
  import { onMount } from 'svelte'
  import type { Resource, ResourceManager } from '../../service/resources'
  import type { AIChatMessageSource } from '../../types/browser.types'
  import ResourcePreview from '../Resources/ResourcePreview.svelte'
  import { useLogScope } from '@horizon/utils'

  export let source: AIChatMessageSource
  export let resourceManager: ResourceManager

  const log = useLogScope('ChatResponseSource')

  let resource: Resource

  onMount(async () => {
    if (!source.resource_id) {
      return
    }

    log.debug('Fetching resource with id', source.resource_id)

    /*
    let remoteOasisEndpoint = get(oasisAPIEndpoint)
    let fetchedResource
    if (remoteOasisEndpoint) {
      log.debug('Fetching resource from remote oasis endpoint', remoteOasisEndpoint)
      fetchedResource = await resourceManager.getRemoteResource(
        source.resource_id,
        remoteOasisEndpoint
      )
    } else {
      fetchedResource = await resourceManager.getResource(source.resource_id)
    }
    */

    const res = await resourceManager.getResourceWithAnnotations(source.resource_id)
    if (!res) {
      log.error(`Resource with id ${source.resource_id} not found`)
      return
    }

    resource = res

    log.debug('Fetched resource:', resource)
  })
</script>

{#if resource}
  <ResourcePreview {resource} on:click />
{:else if source.metadata && source.metadata.url}
  <div>
    {source.render_id})
    <a href={source.metadata.url}>{source.metadata.url}</a>
  </div>
{/if}

<style lang="scss">
</style>
