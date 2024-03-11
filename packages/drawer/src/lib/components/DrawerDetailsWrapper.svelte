<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import type { ResourceManager, ResourceObject } from '@horizon/core/src/lib/service/resources'
  import { generateRootDomain } from '@horizon/core/src/lib/utils/url'
  import { useLogScope } from '@horizon/core/src/lib/utils/log'

  const log = useLogScope('DrawerDetailsWrapper')
  const dispatch = createEventDispatcher()

  export let draggable = true
  export let resource: ResourceObject
  export let resourceManager: ResourceManager

  let userContext = resource.metadata?.userContext

  // TODO: Move this component to the core package and import the ResourceSearchResultItem type
  let nearbyResults: any[] = []

  const handleKeyDown = () => {
    resourceManager.updateResourceMetadata(resource.id, { userContext })
  }

  const handleNearbySearch = async () => {
    const results = await resourceManager.searchForNearbyResources(resource.id)
    log.debug('Nearby search results:', results)
    nearbyResults = results
  }

  onMount(() => {
    handleNearbySearch()
  })
</script>

<!-- svelte-ignore missing-declaration a11y-no-static-element-interactions -->
<div class="details-item">
  <div {draggable} on:dragstart class="details-preview">
    <slot />
  </div>
  <div class="textarea-wrapper">
    <textarea
      id="modernTextarea"
      placeholder="Add Context..."
      bind:value={userContext}
      on:keyup={handleKeyDown}
    ></textarea>
  </div>

  <div class="metadata-wrapper">
    <div class="metadata">
      Metadata<br />
      Name: {resource.metadata?.name}<br />
      Origin: {generateRootDomain(resource.metadata?.sourceURI)}<br />
      Updated At: {resource.updatedAt}<br />
      Created At: {resource.createdAt}<br />
    </div>
  </div>

  <slot name="proximity-view" result={nearbyResults} />
</div>

<style lang="scss">
  .details-item {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    height: min-content;
    .details-preview {
      padding: 2rem;
      max-width: 42rem;
    }
  }

  .textarea-wrapper,
  .metadata-wrapper {
    position: relative;
    padding: 1rem 0;
    left: -1rem;
    right: -1rem;
    display: flex;
    width: calc(100% + 4rem);
    justify-content: center;
    background: white;
    border-top: 0.5px solid rgba(0, 0, 0, 0.15);
    border-bottom: 0.5px solid rgba(0, 0, 0, 0.15);
  }

  textarea {
    width: 100%;
    max-width: 28rem;
    height: 150px;
    padding: 10px;
    border-radius: 8px;
    outline: none;
    resize: vertical;
    font-family: inherit;
    font-size: 1.25rem;
    font-weight: 500;
    letter-spacing: 0.02rem;
    border: 0;
    resize: none;
  }

  .metadata-wrapper {
    margin: 4rem 0;
    padding: 2rem 0;
    .metadata {
      width: 100%;
      max-width: 28rem;
      font-family: inherit;
      font-size: 1.25rem;
      font-weight: 500;
    }
  }
</style>
