<script lang="ts">
  import { derived, writable, type Readable } from 'svelte/store'
  import { createEventDispatcher } from 'svelte'
  import type { Writable } from 'svelte/store'
  import { useLogScope } from '@horizon/utils'
  import type { ResourceSearchResultItem } from '../../service/resources'
  import Masonry from './MasonrySpace.svelte'
  import OasisResourceLoader from './OasisResourceLoader.svelte'
  import { selectedItemIds, deselectAll } from './utils/select'
  import { contextMenu } from '../Core/ContextMenu.svelte'
  import { useOasis } from '../../service/oasis'
  import { useToasts } from '../../service/toast'
  import { useTelemetry } from '../../service/telemetry'
  import { MultiSelectResourceEventAction } from '@horizon/types'

  import { SpaceEntryOrigin } from '../../types'

  export let resources: Readable<ResourceSearchResultItem[]>
  export let selected: string | null = null
  export let isEverythingSpace: boolean
  export let isInSpace: boolean = false
  export let searchValue: Writable<string> | undefined
  export let resourcesBlacklistable: boolean = false
  export let interactive: boolean = true

  const log = useLogScope('OasisResourcesView')
  const dispatch = createEventDispatcher()
  const toasts = useToasts()
  const telemetry = useTelemetry()

  const CHUNK_SIZE = 40
  const MAXIMUM_CHUNK_SIZE = 20
  const CHUNK_THRESHOLD = 300
  let scrollElement: HTMLDivElement
  let refreshContentLayout: () => Promise<void>
  const renderLimit = writable(CHUNK_SIZE)
  const renderContents = derived([resources, renderLimit], ([resources, renderLimit]) => {
    return resources.slice(0, renderLimit)
  })

  const oasis = useOasis()
  const spaces = oasis.spaces

  const handleLoadChunk = (e: CustomEvent) => {
    if ($renderContents.length === 0) {
      renderLimit.set($resources.length)
      return
    }
    if ($resources.length <= $renderContents.length) {
      return
    }
    const CHUNK_SIZE = e.detail
    renderLimit.update((limit) => limit + CHUNK_SIZE)
  }

  export let scrollTop: number

  const handleScroll = (event: CustomEvent<{ scrollTop: number; viewportHeight: number }>) => {
    dispatch('scroll', { scrollTop: event.detail.scrollTop })
    scrollTop = event.detail.scrollTop
  }

  const handleBatchRemove = () => {
    dispatch('batch-remove', $selectedItemIds)
  }

  const handleAddToSpace = async (spaceId: string) => {
    const itemCount = $selectedItemIds.length
    const spaceName = $spaces.find((space) => space.id === spaceId)?.name.folderName
    try {
      await oasis.addResourcesToSpace(spaceId, $selectedItemIds, SpaceEntryOrigin.ManuallyAdded)
      toasts.success(`Added ${itemCount} item${itemCount > 1 ? 's' : ''} to ${spaceName}`)
    } catch (error) {
      toasts.error(`Failed to add items to space: ${error.message}`)
    } finally {
      await telemetry.trackMultiSelectResourceAction(
        MultiSelectResourceEventAction.AddToSpace,
        $selectedItemIds.length,
        isInSpace ? 'space' : 'oasis'
      )
      deselectAll()
    }
  }
</script>

<div
  class="wrapper"
  use:contextMenu={{
    canOpen: $selectedItemIds.length > 1,
    items: [
      {
        type: 'action',
        icon: 'arrow.up.right',
        text: 'Open as Tab',
        action: () => {
          dispatch('batch-open', $selectedItemIds)
          deselectAll()
        }
      },
      {
        type: 'action',
        icon: 'chat',
        text: 'Open in Chat',
        action: () => {
          dispatch('open-and-chat', $selectedItemIds)
          deselectAll()
        }
      },
      { type: 'separator' },
      {
        type: 'sub-menu',
        icon: '',
        text: 'Add to Space',
        items: $spaces
          .filter(
            (e) =>
              e.name.folderName.toLowerCase() !== 'all my stuff' &&
              e.name.folderName.toLowerCase() !== '.tempspace' &&
              !e.name.builtIn
          )
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          .map((space) => ({
            type: 'action',
            icon: '',
            text: space.name.folderName,
            action: () => handleAddToSpace(space.id)
          }))
      },
      { type: 'separator' },
      {
        type: 'action',
        icon: 'trash',
        text: `${!isInSpace ? 'Delete from Stuff' : 'Remove from Space'}`,
        kind: 'danger',
        action: () => handleBatchRemove()
      }
    ]
  }}
>
  <div bind:this={scrollElement} class="content">
    {#if scrollElement}
      {#key $searchValue === ''}
        <Masonry
          items={$renderContents.map((item) => ({ id: item.id, data: item.resource }))}
          on:load-more={handleLoadChunk}
          on:scroll={handleScroll}
          on:wheel
          {searchValue}
          {isEverythingSpace}
          let:item
          let:renderingDone={handleRenderingDone}
        >
          <OasisResourceLoader
            resourceOrId={item.data ? item.data : item.id}
            {isInSpace}
            {resourcesBlacklistable}
            on:open
            on:open-and-chat
            on:remove
            on:load
            on:space-selected
            on:open-space-as-tab
            on:blacklist-resource
            on:whitelist-resource
            on:rendered={handleRenderingDone}
            {interactive}
          />
        </Masonry>
      {/key}
    {/if}
  </div>
</div>

<style lang="scss">
  .wrapper {
    height: 100%;
    overflow: hidden;
    position: relative;
  }
  .header {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 5rem;
    padding: 0;
    padding-bottom: 0;
    position: absolute;
    top: 1rem;
    left: 0;
    right: 0;
    z-index: 10;
    will-change: transform, opacity;
    transform-origin: top center;
    width: 100%;
    /* height: calc(100vh - 400px); */
    pointer-events: none;
  }
  .content {
    height: 100%;
    overflow: auto;
    padding-top: 4rem;
  }
</style>
