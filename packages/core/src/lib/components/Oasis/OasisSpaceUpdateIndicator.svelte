<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { writable, type Writable } from 'svelte/store'

  import { Icon } from '@horizon/icons'
  import { hover, tooltip, useLogScope } from '@horizon/utils'

  import { ResourceTagsBuiltInKeys } from '@horizon/core/src/lib/types'
  import { useResourceManager } from '@horizon/core/src/lib/service/resources'
  import { slide } from 'svelte/transition'
  import type { OasisSpace } from '@horizon/core/src/lib/service/oasis'

  export let space: Writable<OasisSpace | null>
  export let newlyLoadedResources: Writable<any[]>
  export let processingSourceItems: Writable<any[]>
  export let loadingSpaceSources: Writable<boolean>

  const log = useLogScope('OasisSpaceUpdateIndicator')
  const resourceManager = useResourceManager()
  const dispatch = createEventDispatcher<{
    refresh: void
  }>()

  const isHovered = writable(false)

  $: spaceData = $space?.data

  const handleRefreshLiveSpace = () => {
    dispatch('refresh')
  }

  const fetchNewlyAddedResourcePrevies = async (num = 3) => {
    if ($newlyLoadedResources.length === 0) {
      return []
    }

    const resourceIds = $newlyLoadedResources.slice(0, num)
    log.debug('Fetching previews for newly added resources:', resourceIds)

    const fetched = await Promise.all(
      resourceIds.map(async (id) => {
        const resource = await resourceManager.getResource(id)
        if (!resource) {
          log.error('Resource not found')
          return null
        }

        const url =
          resource.tags?.find((x) => x.name === ResourceTagsBuiltInKeys.CANONICAL_URL)?.value ||
          resource.metadata?.sourceURI
        if (!url) {
          log.error('Resource URL not found')
          return null
        }

        return {
          id: resource.id,
          url: url
        }
      })
    )

    const items = fetched.filter((x) => x !== null)
    log.debug('Fetched items:', items)

    const uniqueHosts = Array.from(new Set(items.map((x) => new URL(x.url).hostname)))

    // only return one item per host
    return items.filter((x) => {
      const host = new URL(x.url).hostname
      if (uniqueHosts.includes(host)) {
        uniqueHosts.splice(uniqueHosts.indexOf(host), 1)
        return true
      }

      return false
    })
  }
</script>

{#if $space && ($spaceData?.liveModeEnabled || ($spaceData?.sources ?? []).length > 0 || $spaceData?.smartFilterQuery)}
  {#key '' + $spaceData?.liveModeEnabled + ($newlyLoadedResources.length > 0)}
    <button
      class="live-mode"
      class:live-enabled={$spaceData?.liveModeEnabled &&
        $newlyLoadedResources.length === 0 &&
        !$loadingSpaceSources}
      disabled={$loadingSpaceSources}
      use:hover={isHovered}
      on:click={handleRefreshLiveSpace}
      use:tooltip={{
        text:
          $newlyLoadedResources.length > 0
            ? 'New content has been added to the space. Click to refresh.'
            : $spaceData?.liveModeEnabled
              ? ($spaceData?.sources ?? []).length > 0
                ? 'The sources will automatically be loaded when you open the space. Click to manually refresh.'
                : 'New resources that match the smart query will automatically be added. Click to manually refresh.'
              : ($spaceData?.sources ?? []).length > 0
                ? 'Click to load the latest content from the connected sources'
                : 'Click to load the latest content based on the smart query',
        position: 'top'
      }}
    >
      {#if $loadingSpaceSources}
        <Icon name="spinner" />
        {#if $newlyLoadedResources.length > 0}
          <span>
            Processing items (<span class="tabular-nums"
              >{$newlyLoadedResources.length} / {$processingSourceItems.length}</span
            >)
          </span>
        {:else if ($spaceData?.sources ?? []).length > 0}
          Loading source{($spaceData?.sources ?? []).length > 1 ? 's' : ''}…
        {:else}
          Refreshing…
        {/if}
      {:else if $newlyLoadedResources.length > 0}
        {#await fetchNewlyAddedResourcePrevies()}
          <Icon name="reload" />
          Update Space with {$newlyLoadedResources.length} items
        {:then previews}
          <!-- <Icon name="reload" /> -->
          <div class="flex items-center -space-x-3 flex-shrink-0">
            {#each previews as preview (preview.id)}
              <img
                class="w-6 h-6 rounded-lg overflow-hidden bg-white border-2 border-white/75 box-content flex-shrink-0"
                src={`https://www.google.com/s2/favicons?domain=${preview.url}&sz=48`}
                alt={`favicon`}
              />
            {/each}
          </div>

          {#if $newlyLoadedResources.length > previews.length}
            <span>+{$newlyLoadedResources.length - previews.length} new items</span>
          {:else}
            <span
              >{$newlyLoadedResources.length} new item{$newlyLoadedResources.length > 1
                ? 's'
                : ''}</span
            >
          {/if}
        {/await}
        <!-- {:else if $space.name.liveModeEnabled}
                <Icon name="news" />
                Auto Refresh -->
      {:else if ($spaceData?.sources ?? []).length > 0}
        <div class="flex items-center">
          <Icon name="reload" size="20px" />

          {#if $isHovered}
            <div transition:slide={{ axis: 'x' }} class="text-nowrap ml-2">Refresh Sources</div>
          {/if}
        </div>
      {:else}
        <div class="flex items-center">
          <Icon name="reload" size="20px" />

          {#if $isHovered}
            <div transition:slide={{ axis: 'x' }} class="text-nowrap ml-2">Smart Refresh</div>
          {/if}
        </div>
      {/if}
    </button>
  {/key}
{/if}

<style lang="scss">
  button {
    padding: 0.5rem;
    cursor: pointer;
  }

  .live-mode {
    appearance: none;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 0.75rem;
    // background: #ffffffc0;
    border: none;
    color: #0b689ac1;
    font-size: 1rem;
    font-weight: 500;
    letter-spacing: 0.02rem;

    //   &.live-enabled {
    //     background: #ff4eed;
    //     color: white;

    //     &:hover {
    //       background: #fb3ee9;
    //     }
    //   }

    &:hover {
      color: #0b689a;
      background: rgb(232, 238, 241);
    }

    :global(.dark) & {
      color: #b9b9b9;
      &:hover {
        color: #ffffff;
        background: #ffffff10;
      }
    }
  }
</style>
