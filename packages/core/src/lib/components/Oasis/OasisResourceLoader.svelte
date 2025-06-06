<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { useLogScope } from '@horizon/utils'
  import { Resource, useResourceManager } from '@horizon/core/src/lib/service/resources'

  import ResourcePreview from '../Resources/ResourcePreview.svelte'
  import type { ContentMode, Origin, ViewMode } from '@horizon/core/src/lib/utils/resourcePreview'
  import Folder from './Folder.svelte'
  import { OasisSpace } from '../../service/oasis'
  import { writable } from 'svelte/store'

  export let resourceOrId: string | Resource | OasisSpace
  export let selected: boolean = false
  export let isInSpace: boolean = false
  export let resourcesBlacklistable: boolean = false
  export let interactive: boolean = true
  export let mode: ContentMode = 'full'
  export let viewMode: ViewMode = 'card'
  export let origin: Origin = 'stuff'
  export let draggable: boolean = true
  export let frameless: boolean = false
  export let hideProcessing: boolean = false
  export let openIn: 'tab' | 'sidebar' = 'tab'

  $: isFolder =
    resourceOrId instanceof OasisSpace ||
    (typeof resourceOrId === 'object' &&
      resourceOrId !== null &&
      'id' in resourceOrId &&
      'data' in resourceOrId &&
      resourceOrId.data?.folderName)

  const log = useLogScope('OasisResourceLoader')
  const resourceManager = useResourceManager()
  const dispatch = createEventDispatcher<{ load: Resource; rendered: void }>()

  let fetchedResource: Resource | null = null

  $: resource = resourceOrId instanceof Resource ? resourceOrId : fetchedResource

  const loadResource = async () => {
    try {
      if (isFolder) {
        return
      }

      if (resourceOrId instanceof Resource) {
        fetchedResource = resourceOrId
        dispatch('load', fetchedResource)
        return
      }

      if (typeof resourceOrId === 'string') {
        resourceManager
          .getResourceWithAnnotations(resourceOrId)
          .then((res) => {
            if (!res) {
              return
            }
            fetchedResource = res
            dispatch('load', fetchedResource)
          })
          .catch((e) => {
            log.error(e)
          })
      }
    } catch (e) {
      log.error(e)
    }
  }

  onMount(() => {
    loadResource()
  })
</script>

<div
  class="wrapper"
  class:full-height={viewMode === 'responsive'}
  class:loaded={resource || isFolder}
>
  {#if isFolder}
    <Folder
      folder={resourceOrId}
      depth={0}
      {selected}
      isEditing={false}
      editingSpaceId={writable(null)}
      displayMode="card"
      loadResources={true}
      allowPinning={true}
      expandable={false}
      selectedItemsCount={0}
      multipleItemsSelected={false}
      {isInSpace}
      on:select
      on:update-data
      on:editing-start
      on:editing-end
      on:navigate-context
      on:Drop={(event) => {
        // Forward the Drop event with its original detail structure
        dispatch('Drop', event.detail)
      }}
      on:open-space-as-tab
      on:open-space-and-chat
      on:use-as-context
      on:force-reload
      on:batch-remove
      on:pin
      on:unpin
    />
  {:else if resource}
    <!-- Render ResourcePreview for regular resources -->
    <slot
      {resource}
      {mode}
      {viewMode}
      {origin}
      {selected}
      {isInSpace}
      {resourcesBlacklistable}
      {interactive}
      {draggable}
      {frameless}
      {hideProcessing}
    >
      {#if interactive}
        <ResourcePreview
          {resource}
          {mode}
          {viewMode}
          {origin}
          {selected}
          {isInSpace}
          {resourcesBlacklistable}
          {interactive}
          {draggable}
          {frameless}
          {hideProcessing}
          {openIn}
          on:load
          on:click
          on:open
          on:open-and-chat
          on:open-in-sidebar
          on:remove
          on:blacklist-resource
          on:whitelist-resource
          on:set-resource-as-background
          on:remove-from-homescreen
          on:set-resource-as-space-icon
          on:highlightWebviewText
          on:seekToTimestamp
        />
      {:else}
        <ResourcePreview
          {resource}
          {mode}
          {viewMode}
          {origin}
          {selected}
          {isInSpace}
          {resourcesBlacklistable}
          {interactive}
          {draggable}
          {frameless}
          {hideProcessing}
          {openIn}
          on:load
          on:click
          on:open
          on:open-and-chat
          on:open-in-sidebar
          on:remove
          on:blacklist-resource
          on:whitelist-resource
          on:remove-from-homescreen
          on:set-resource-as-space-icon
          on:highlightWebviewText
          on:seekToTimestamp
        />
      {/if}
    </slot>
  {/if}
</div>

<style lang="scss">
  .wrapper {
    display: block;
    width: 100%;
    height: min-content;

    &.full-height {
      height: 100%;
    }
  }
</style>
