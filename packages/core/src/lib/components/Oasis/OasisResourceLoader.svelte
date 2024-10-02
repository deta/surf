<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { useLogScope } from '@horizon/utils'
  import { Resource, useResourceManager } from '@horizon/core/src/lib/service/resources'

  import DragResourceWrapper from './DragResourceWrapper.svelte'
  import ResourcePreview from '../Resources/ResourcePreview.svelte'

  export let resourceOrId: string | Resource
  export let selected: boolean = false
  export let isInSpace: boolean = false
  export let resourcesBlacklistable: boolean = false
  export let interactive: boolean = true

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
    {#if interactive}
      <DragResourceWrapper {resource}>
        <ResourcePreview
          {resource}
          {selected}
          {isInSpace}
          {resourcesBlacklistable}
          {interactive}
          on:load
          on:click
          on:open
          on:open-and-chat
          on:remove
          on:blacklist-resource
          on:whitelist-resource
        />
      </DragResourceWrapper>
    {:else}
      <ResourcePreview
        {resource}
        {selected}
        {isInSpace}
        {resourcesBlacklistable}
        {interactive}
        on:load
        on:click
        on:open
        on:open-and-chat
        on:remove
        on:blacklist-resource
        on:whitelist-resource
      />
    {/if}
  {/if}
</div>

<style lang="scss">
  .wrapper {
    display: block;
    width: 100%;
    height: min-content;
  }
</style>
