<script lang="ts">
  import { derived, writable, type Readable } from 'svelte/store'
  import { createEventDispatcher } from 'svelte'
  import type { Writable } from 'svelte/store'
  import { useLogScope } from '@horizon/utils'
  import Masonry from './MasonrySpace.svelte'
  import OasisResourceLoader from './OasisResourceLoader.svelte'
  import { selectedItemIds, deselectAll } from './utils/select'
  import { contextMenu } from '../Core/ContextMenu.svelte'
  import { useOasis } from '../../service/oasis'
  import { useToasts } from '../../service/toast'
  import { useTelemetry } from '../../service/telemetry'
  import { MultiSelectResourceEventAction } from '@horizon/types'

  import { SpaceEntryOrigin } from '../../types'

  export let resourceIds: Readable<string[]>
  export let selected: string | null = null
  export let isInSpace: boolean = false
  export let useMasonry: boolean = true
  export let searchValue: Writable<string> | undefined
  export let interactive: boolean = true

  const log = useLogScope('OasisResourcesView')
  const dispatch = createEventDispatcher()
  const oasis = useOasis()
  const spaces = oasis.spaces
  const toasts = useToasts()
  const telemetry = useTelemetry()

  const CHUNK_SIZE = 40
  const CHUNK_THRESHOLD = 300

  let scrollElement: HTMLDivElement
  let refreshContentLayout: () => void

  const renderLimit = writable(CHUNK_SIZE)

  const renderContents = derived([resourceIds, renderLimit], ([resourceIds, renderLimit]) => {
    return resourceIds.slice(0, renderLimit)
  })

  const handleRemove = async (e?: MouseEvent, deleteFromStuff = false) => {
    e?.stopImmediatePropagation()
    dispatch('batch-remove', { ids: $selectedItemIds, deleteFromStuff })
  }

  const handleLoadChunk = (e: CustomEvent) => {
    if ($renderContents.length === 0) {
      renderLimit.set(40)
      return
    }
    if ($resourceIds.length <= $renderContents.length) {
      return
    }
    const CHUNK_SIZE = e.detail
    renderLimit.update((limit) => limit + CHUNK_SIZE)
  }

  const handleAddToSpace = async (spaceId: string) => {
    const itemCount = $selectedItemIds.length
    const spaceName = $spaces.find((space) => space.id === spaceId)?.dataValue.folderName
    try {
      await oasis.addResourcesToSpace(spaceId, $selectedItemIds, SpaceEntryOrigin.ManuallyAdded)
      toasts.success(`Added ${itemCount} item${itemCount > 1 ? 's' : ''} to ${spaceName}`)
    } catch (error) {
      toasts.error(`Failed to add items to space: ${error.message}`)
    } finally {
      deselectAll()
      await telemetry.trackMultiSelectResourceAction(
        MultiSelectResourceEventAction.AddToSpace,
        $selectedItemIds.length,
        isInSpace ? 'space' : 'oasis'
      )
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
        text: 'Add to Context',
        items: $spaces
          .filter(
            (e) =>
              e.id !== 'all' &&
              e.id !== 'inbox' &&
              e.dataValue.folderName.toLowerCase() !== '.tempspace' &&
              !e.dataValue.builtIn
          )
          .map((space) => ({
            type: 'action',
            icon: space,
            text: space.dataValue.folderName,
            action: () => handleAddToSpace(space.id)
          }))
      },
      { type: 'separator' },
      ...(isInSpace
        ? [
            {
              type: 'sub-menu',
              icon: 'trash',
              text: 'Delete',
              kind: 'danger',
              items: [
                {
                  type: 'action',
                  icon: 'close',
                  text: 'Remove from Context',
                  kind: 'danger',
                  action: () => {
                    handleRemove()
                    deselectAll()
                  }
                },
                {
                  type: 'action',
                  icon: 'trash',
                  text: 'Delete from Stuff',
                  kind: 'danger',
                  action: () => {
                    handleRemove(undefined, true)
                    deselectAll()
                  }
                }
              ]
            }
          ]
        : [
            {
              type: 'action',
              icon: 'trash',
              text: 'Delete from Stuff',
              kind: 'danger',
              action: () => {
                handleRemove(undefined, true)
                deselectAll()
              }
            }
          ])
    ]
  }}
>
  {#if useMasonry}
    <div bind:this={scrollElement} class="content">
      {#if scrollElement}
        {#key $searchValue === ''}
          <Masonry
            items={$renderContents.map((id) => ({ id, data: null }))}
            isEverythingSpace={false}
            {searchValue}
            on:load-more={handleLoadChunk}
            let:item
            let:renderingDone={handleRenderingDone}
          >
            <OasisResourceLoader
              resourceOrId={item.id}
              {isInSpace}
              on:click
              on:open
              on:open-and-chat
              on:remove
              on:load
              on:blacklist-resource
              on:whitelist-resource
              on:set-resource-as-space-icon
              on:rendered={handleRenderingDone}
              {interactive}
              draggable
            />
          </Masonry>
        {/key}
      {/if}
    </div>
  {:else}
    <div class="content flex flex-wrap gap-16 pt-[100px]">
      {#each $renderContents as resourceId (resourceId)}
        <div class="max-w-[420px] w-full">
          <OasisResourceLoader
            resourceOrId={resourceId}
            {isInSpace}
            on:click
            on:open
            on:open-and-chat
            on:blacklist-resource
            on:whitelist-resource
            on:remove
            on:load
            on:set-resource-as-space-icon
            {interactive}
            draggable
          />
        </div>
      {/each}
    </div>
  {/if}
</div>

<style lang="scss">
  .wrapper {
    height: 100%;
    overflow: hidden;
    position: relative;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2rem;
    padding-bottom: 0;
  }

  .title {
    font-size: 1.5rem;
    font-weight: bold;
  }

  .content {
    height: 100%;
    overflow: auto;
  }

  .go-back {
    position: absolute;
    top: 2rem;
    left: 2rem;
    z-index: 1000;
  }
</style>
