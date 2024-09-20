<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { useLogScope } from '@horizon/utils'
  import { Resource, useResourceManager } from '@horizon/core/src/lib/service/resources'

  import DragResourceWrapper from './DragResourceWrapper.svelte'
  import ResourcePreview from '../Resources/ResourcePreview.svelte'

  export let resourceOrId: string | Resource
  export let selected: boolean = false
  export let isInSpace: boolean = false

  const log = useLogScope('OasisResourceLoader')
  const resourceManager = useResourceManager()
  const dispatch = createEventDispatcher<{ load: Resource; rendered: void }>()

  let fetchedResource: Resource | null = null

  $: resource = resourceOrId instanceof Resource ? resourceOrId : fetchedResource

  const loadResource = async () => {
    try {
      if (typeof resourceOrId !== 'string') {
        fetchedResource = resourceOrId
        dispatch('load', fetchedResource)
        return
      }

      const res = await resourceManager.getResourceWithAnnotations(resourceOrId)
      if (!res) {
        return
      }
      fetchedResource = res

      dispatch('rendered')
    } catch (e) {
      log.error(e)
    }
  }

  onMount(() => {
    loadResource()
  })
</script>

<div class="wrapper">
  {#if resource}
    <DragResourceWrapper {resource}>
      <ResourcePreview {resource} {selected} {isInSpace} on:load on:click on:open on:remove />
    </DragResourceWrapper>
  {/if}
</div>

<style lang="scss">
  .wrapper {
    display: block;
    width: 100%;
    height: min-content;
  }
</style>
