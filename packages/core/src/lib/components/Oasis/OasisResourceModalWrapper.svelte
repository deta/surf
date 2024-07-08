<script lang="ts">
  import { ResourceOverlay } from '@horizon/drawer'
  import MiniBrowser from '../Browser/MiniBrowser.svelte'
  import { writable, type Writable } from 'svelte/store'
  import { useResourceManager, type Resource } from '../../service/resources'
  import ResourcePreviewClean from '../Resources/ResourcePreviewClean.svelte'
  import OasisResourceDetails from './OasisResourceDetails.svelte'
  import { useLogScope } from '../../utils/log'
  import OasisResourceModal from './OasisResourceModal.svelte'

  export let resourceId: string

  const log = useLogScope('OasisResourceModalWrapper')
  const resourceManager = useResourceManager()

  const resource = writable<Resource | null>(null)

  $: {
    loadResource(resourceId)
  }

  const loadResource = async (id: string) => {
    try {
      log.debug('loadResource')

      const resourceData = await resourceManager.getResource(id)
      resource.set(resourceData)

      log.debug('Loaded resource:', resourceData)
    } catch (e) {
      log.error(e)
    }
  }
</script>

<div class="modal">
  {#if $resource}
    <OasisResourceModal resource={$resource} on:close on:new-tab />
  {/if}
</div>
