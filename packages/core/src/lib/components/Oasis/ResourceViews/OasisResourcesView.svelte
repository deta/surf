<script lang="ts">
  import { derived, type Readable, writable } from 'svelte/store'
  import { createEventDispatcher } from 'svelte'
  import type { Writable } from 'svelte/store'
  import { useLogScope } from '@horizon/utils'
  import MasonryView from '../ResourceViews/MasonryView.svelte'
  import {
    selectedItemIds,
    selectedSpaceIds,
    selectedResourceIds,
    deselectAll
  } from '../utils/select'
  import { contextMenu, type CtxItem } from '../../Core/ContextMenu.svelte'
  import { useOasis } from '../../../service/oasis'
  import { useToasts } from '../../../service/toast'
  import { useTelemetry } from '../../../service/telemetry'
  import {
    ContextViewDensities,
    ContextViewTypes,
    MultiSelectResourceEventAction,
    type ContextViewDensity,
    type ContextViewType
  } from '@horizon/types'

  import { SpaceEntryOrigin } from '../../../types'
  import { Resource } from '../../../service/resources'
  import OasisResourceLoader from '../../Oasis/OasisResourceLoader.svelte'
  import { Icon, type Icons } from '@horizon/icons'
  import GridView from './GridView.svelte'
  import type { ResourceRenderableItem, RenderableItem } from '../../../types'
  import { selection } from '@horizon/core/src/lib/components/Oasis/utils/select'

  export let resources: Readable<(Resource | string | { id: string } | { resource: Resource })[]> =
    writable([])

  // TODO: we should migrate to using the new items for all cases
  export let items: Readable<RenderableItem[]> | undefined = undefined

  export let isInSpace: boolean = false
  export let searchValue: Writable<string> | undefined
  export let resourcesBlacklistable: boolean = false
  export let fadeIn = false
  export let openIn: 'tab' | 'sidebar' = 'tab'
  export let interactive: boolean = true
  export let viewType: ContextViewType | undefined = ContextViewTypes.Grid
  export let viewDensity: ContextViewDensity | undefined = ContextViewDensities.Compact

  export const hideViewSettings = false
  export const hideFilterSettings: boolean = false
  export const hideSortingSettings: boolean = false
  export const sortBy: string | undefined = undefined
  export const order: string | null = null

  export let status: undefined | { icon: Icons | undefined; message: string } = undefined

  const dispatch = createEventDispatcher()

  const log = useLogScope('OasisResourcesView')

  const oasis = useOasis()
  const toasts = useToasts()
  const telemetry = useTelemetry()

  const spaces = oasis.spaces
  const sortedSpaces = oasis.sortedSpacesListFlat

  function resourceToRenderableItem(
    idOrResource: Resource | string | { id: string } | { resource: Resource }
  ): ResourceRenderableItem | undefined {
    if (typeof idOrResource === 'string') {
      return { id: idOrResource, data: null, type: 'resource' }
    } else if (idOrResource instanceof Resource) {
      return { id: idOrResource.id, data: idOrResource, type: 'resource' }
    } else if (typeof idOrResource === 'object') {
      if ('resource' in idOrResource && idOrResource.resource !== undefined) {
        return { id: idOrResource.resource.id, data: idOrResource.resource, type: 'resource' }
      } else if ('id' in idOrResource) {
        const result: ResourceRenderableItem = { id: idOrResource.id, data: null, type: 'resource' }
        if ('createdAt' in idOrResource) {
          result.createdAt = idOrResource.createdAt as string
        }
        return result
      }
    }
    log.warn('Cannot render invalid object in OasisResourcesView', idOrResource)
    return undefined
  }

  const renderableItems = derived(
    [items || writable<RenderableItem[]>([]), resources],
    ([items, resources]): RenderableItem[] => {
      // if items provided, use it directly
      if (items && items.length > 0) {
        return items
      }
      return resources
        .map(resourceToRenderableItem)
        .filter((item) => item !== undefined) as RenderableItem[]
    }
  )

  const handleRemove = async (e?: MouseEvent, deleteFromStuff = false) => {
    e?.stopImmediatePropagation()
    dispatch('batch-remove', {
      resourceIds: $selectedResourceIds,
      spaceIds: $selectedSpaceIds,
      deleteFromStuff
    })
    deselectAll()
  }

  const handleAddToSpace = async (spaceId: string) => {
    const itemCount = $selectedItemIds.length
    const spaceName = $spaces.find((space) => space.id === spaceId)?.dataValue.folderName
    try {
      await oasis.addResourcesToSpace(spaceId, $selectedItemIds, SpaceEntryOrigin.ManuallyAdded)
      toasts.success(`Added ${itemCount} item${itemCount > 1 ? 's' : ''} to ${spaceName}`)
    } catch (error) {
      toasts.error(`Failed to add items to space: ${error}`)
    } finally {
      deselectAll()
      await telemetry.trackMultiSelectResourceAction(
        MultiSelectResourceEventAction.AddToSpace,
        $selectedItemIds.length,
        isInSpace ? 'space' : 'oasis'
      )
    }
  }

  const CONTEXT_MENU_ITEMS: CtxItem[] = [
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
      search: true,
      items: $sortedSpaces
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
          } as CtxItem
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
          } as CtxItem
        ])
  ]
</script>

<div
  class="resources-view"
  class:fadeIn
  data-density={viewDensity ?? ContextViewDensities.Cozy}
  use:selection
  use:contextMenu={{
    canOpen: $selectedItemIds.length > 1,
    items: CONTEXT_MENU_ITEMS
  }}
>
  <div class="content">
    {#if status !== undefined}
      <div class="w-full h-full flex items-center justify-center">
        <div
          class="h-min flex flex-col gap-4 items-center justify-center text-center text-lg font-medium text-gray-500"
        >
          {#if status.icon}
            <Icon name={status.icon} size="1.3em" />
          {/if}
          <span class="max-w-lg">{status.message}</span>
        </div>
      </div>
    {:else if $renderableItems.length === 0 && $searchValue && $searchValue.length > 0}
      <div class="w-full h-full flex items-center justify-center">
        <div
          class="h-min flex flex-col gap-4 items-center justify-center text-center text-lg font-medium text-gray-500"
        >
          <Icon name="save" size="1.3em" class="mb-2" />
          <span class="max-w-lg"
            >No results found for "{$searchValue}". <br />Try a different search term.</span
          >
        </div>
      </div>
    {:else}
      {#key $searchValue === ''}
        {#if (viewType ?? ContextViewTypes.Masonry) === 'masonry'}
          <MasonryView items={renderableItems} let:item>
            <OasisResourceLoader
              resourceOrId={item.data ?? item.id}
              draggable
              {interactive}
              {isInSpace}
              {resourcesBlacklistable}
              {openIn}
              viewMode="card"
              on:click
              on:open
              on:open-and-chat
              on:open-in-sidebar
              on:navigate-context
              on:remove
              on:batch-remove
              on:load
              on:space-selected
              on:blacklist-resource
              on:whitelist-resource
              on:set-resource-as-space-icon
              on:select={(e) =>
                item.type === 'space' ? dispatch('space-selected', e.detail) : null}
              on:update-data
              on:editing-start
              on:editing-end
              on:Drop={(e) => {
                log.debug('OasisResourcesView forwarding Drop event:', e.detail)
                dispatch('Drop', e.detail)
              }}
              on:open-space-as-tab
              on:open-space-and-chat
              on:use-as-context
              on:force-reload
              on:pin
              on:unpin
            />
          </MasonryView>
        {:else if viewType === 'grid'}
          <GridView items={renderableItems} let:item>
            <OasisResourceLoader
              resourceOrId={item.data ?? item.id}
              draggable
              {interactive}
              {isInSpace}
              {resourcesBlacklistable}
              {openIn}
              mode="full"
              viewMode="responsive"
              on:click
              on:open
              on:open-and-chat
              on:open-in-sidebar
              on:navigate-context
              on:remove
              on:batch-remove
              on:load
              on:space-selected
              on:blacklist-resource
              on:whitelist-resource
              on:set-resource-as-space-icon
              on:select={(e) =>
                item.type === 'space' ? dispatch('space-selected', e.detail) : null}
              on:update-data
              on:editing-start
              on:editing-end
              on:Drop={(e) => {
                log.debug('OasisResourcesView forwarding Drop event:', e.detail)
                dispatch('Drop', e.detail)
              }}
              on:open-space-as-tab
              on:open-space-and-chat
              on:use-as-context
              on:force-reload
              on:pin
              on:unpin
            />
          </GridView>
        {/if}
      {/key}
    {/if}
  </div>
</div>

<style lang="scss">
  @keyframes reveal-up {
    from {
      opacity: 0;
      translate: 0 2px;
    }
    to {
      opacity: 1;
      translate: 0 0;
    }
  }
  .resources-view {
    isolation: isolate;
    position: relative;
    overflow: hidden;
    height: auto;
    padding-block: 0.75em;

    &.fadeIn {
      animation: reveal-up 145ms ease-in;
      animation-fill-mode: forwards;
      animation-iteration-count: 1;
      animation-delay: 113ms;
      opacity: 0;
    }

    > header {
      display: flex;
      justify-content: end;
      gap: 0.25em;
      padding-inline: 2em;
      margin-bottom: -1em;

      :global(button) {
        opacity: 0.8;
        &:hover,
        &.active {
          opacity: 1;
        }
      }
    }
  }

  .content {
    height: 100%;
    overflow: auto;
  }
</style>
