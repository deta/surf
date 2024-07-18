<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { Resource, ResourceAnnotation, useResourceManager } from '../../service/resources'
  import { useLogScope } from '../../utils/log'
  import ResourcePreviewClean from '../Resources/ResourcePreviewClean.svelte'
  import DragResourceWrapper from './DragResourceWrapper.svelte'

  export let id: string
  export let selected: boolean = false

  const log = useLogScope('OasisSpaceItem')
  const resourceManager = useResourceManager()
  const dispatch = createEventDispatcher<{ load: Resource }>()

  let loading = false
  let resource: Resource | null = null

  const loadResource = async () => {
    try {
      log.debug('loadResource')

      loading = true
      const res = await resourceManager.getResourceWithAnnotations(id)
      if (!res) {
        return
      }

      resource = res

      log.debug('Loaded resource:', resource)
      dispatch('load', resource)
    } catch (e) {
      log.error(e)
    } finally {
      loading = false
    }
  }

  $: {
    if (id) {
      loadResource()
    }
  }
</script>

<div class="wrapper">
  {#if resource}
    <DragResourceWrapper {resource}>
      <ResourcePreviewClean {resource} {selected} showSummary on:load on:click on:open on:remove />
    </DragResourceWrapper>
  {:else if loading}
    <div>Loading...</div>
  {:else}
    <div>Resource not found</div>
  {/if}
</div>

<style lang="scss">
  .wrapper {
    display: block;
    width: 100%;
    height: min-content;
  }
</style>
