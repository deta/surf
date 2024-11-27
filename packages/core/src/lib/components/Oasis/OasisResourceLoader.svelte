<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { useLogScope } from '@horizon/utils'
  import { Resource, useResourceManager } from '@horizon/core/src/lib/service/resources'

  import DragResourceWrapper from './DragResourceWrapper.svelte'
  import ResourcePreview from '../Resources/ResourcePreview.svelte'
  import type { Mode, Origin } from '../Resources/Previews/Preview.svelte'

  export let resourceOrId: string | Resource
  export let selected: boolean = false
  export let isInSpace: boolean = false
  export let resourcesBlacklistable: boolean = false
  export let interactive: boolean = true
  export let mode: Mode = 'full'
  export let origin: Origin = 'stuff'
  export let draggable: boolean = true
  export let frameless: boolean = false

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
      <ResourcePreview
        {resource}
        {mode}
        {origin}
        {selected}
        {isInSpace}
        {resourcesBlacklistable}
        {interactive}
        {draggable}
        {frameless}
        on:load
        on:click
        on:open
        on:open-and-chat
        on:remove
        on:blacklist-resource
        on:whitelist-resource
        on:set-resource-as-background
        on:remove-from-homescreen
        on:set-resource-as-space-icon
      />
    {:else}
      <ResourcePreview
        {resource}
        {mode}
        {origin}
        {selected}
        {isInSpace}
        {resourcesBlacklistable}
        {interactive}
        {draggable}
        {frameless}
        on:load
        on:click
        on:open
        on:open-and-chat
        on:remove
        on:blacklist-resource
        on:whitelist-resource
        on:remove-from-homescreen
        on:set-resource-as-space-icon
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
