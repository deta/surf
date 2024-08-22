<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { Resource, ResourceAnnotation, useResourceManager } from '../../service/resources'
  import { useLogScope } from '@horizon/utils'
  import ResourcePreviewClean from '../Resources/ResourcePreviewClean.svelte'
  import DragResourceWrapper from './DragResourceWrapper.svelte'
  import Skelleton from './OasisSkelleton.svelte'

  export let id: string
  export let selected: boolean = false
  export let showSource: boolean = false
  export let newTabOnClick: boolean = false

  const log = useLogScope('OasisSpaceItem')
  const resourceManager = useResourceManager()
  const dispatch = createEventDispatcher<{ load: Resource; rendered: void }>()

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

  onMount(() => {
    queueMicrotask(() => {
      dispatch('rendered')
    })
  })
</script>

<div class="wrapper">
  {#if resource}
    <DragResourceWrapper {resource}>
      <ResourcePreviewClean
        {resource}
        {selected}
        {showSource}
        {newTabOnClick}
        showSummary
        on:load
        on:click
        on:open
        on:remove
        on:new-tab
      />
    </DragResourceWrapper>
  {:else if loading}
    <Skelleton />
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
