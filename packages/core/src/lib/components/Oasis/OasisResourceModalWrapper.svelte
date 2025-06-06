<script lang="ts">
  import { writable } from 'svelte/store'
  import { useResourceManager, type Resource } from '../../service/resources'
  import { useLogScope } from '@horizon/utils'
  import OasisResourceModal from './OasisResourceModal.svelte'

  export let resourceId: string
  export let active: boolean = true

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
    } catch (e) {
      log.error(e)
    }
  }
</script>

<div class="modal">
  {#if $resource}
    <OasisResourceModal resource={$resource} {active} on:close />
  {/if}
</div>
