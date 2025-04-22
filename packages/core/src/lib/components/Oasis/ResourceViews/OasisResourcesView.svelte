<script lang="ts">
  import { derived, get, type Readable } from 'svelte/store'
  import { createEventDispatcher } from 'svelte'
  import type { Writable } from 'svelte/store'
  import { useLogScope } from '@horizon/utils'
  import MasonryView from '../ResourceViews/MasonryView.svelte'
  import { selectedItemIds, deselectAll } from '../utils/select'
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
  import SpaceFilterViewButtons from '../SpaceFilterViewButtons.svelte'
  import { selection } from '../utils/select'

  export let resources: Readable<(Resource | string | { id: string } | { resource: Resource })[]>

  export let isInSpace: boolean = false
  export let searchValue: Writable<string> | undefined
  export let resourcesBlacklistable: boolean = false
  export let fadeIn = false
  export let openIn: 'tab' | 'sidebar' = 'tab'
  export let hideViewSettings = false
  export let hideFilterSettings: boolean = false
  export let hideSortingSettings: boolean = false

  export let interactive: boolean = true
  export let viewType: ContextViewType | undefined = ContextViewTypes.Grid // TODO: (@maxu) impl
  export let viewDensity: ContextViewDensity | undefined = ContextViewDensities.Compact
  export let sortBy: string | undefined
  export let order: string | null

  export let status: undefined | { icon: Icons | undefined; message: string } = undefined

  const dispatch = createEventDispatcher()

  const log = useLogScope('OasisResourcesView')
  const oasis = useOasis()
  const toasts = useToasts()
  const telemetry = useTelemetry()

  const spaces = oasis.spaces
  const sortedSpaces = oasis.sortedSpacesListFlat
  const selectedFilterTypeId = oasis.selectedFilterTypeId

  const renderContents = derived([resources], ([resources]) => {
    return resources
      .map((idOrResource) => {
        if (typeof idOrResource === 'string') {
          return { id: idOrResource, data: null }
        } else if (idOrResource instanceof Resource) {
          return { id: idOrResource.id, data: idOrResource }
        } else if (typeof idOrResource === 'object') {
          if (idOrResource.resource !== undefined) {
            return { id: idOrResource.resource.id, data: idOrResource.resource }
          } else if (idOrResource.id !== undefined) {
            return { id: idOrResource, data: null }
          }
        }
        log.warn('Cannot render invalid object in OasisResourcesView', idOrResource)
        return undefined
      })
      .filter((e) => e !== undefined)
  })

  const handleRemove = async (e?: MouseEvent, deleteFromStuff = false) => {
    e?.stopImmediatePropagation() // TODO: Still needed?
    dispatch('batch-remove', { ids: $selectedItemIds, deleteFromStuff })
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
  {#if !hideViewSettings}
    <header>
      <SpaceFilterViewButtons
        filter={$selectedFilterTypeId}
        {viewType}
        {viewDensity}
        {sortBy}
        {order}
        {hideFilterSettings}
        {hideSortingSettings}
        on:changedView
        on:changedFilter
        on:changedSortBy
        on:changedOrder
      />
    </header>
  {/if}
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
    {:else if $renderContents.length === 0 && $searchValue && $searchValue.length > 0}
      <div class="w-full h-full flex items-center justify-center">
        <div
          class="h-min flex flex-col gap-4 items-center justify-center text-center text-lg font-medium text-gray-500"
        >
          <Icon name="save" size="1.3em" class="mb-2" />
          <span class="max-w-lg"
            >No stuff found for "{$searchValue}". <br />Try a different search term.</span
          >
        </div>
      </div>
    {:else}
      {#key $searchValue === ''}
        {#if (viewType ?? ContextViewTypes.Masonry) === 'masonry'}
          <MasonryView items={resources} let:item>
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
              on:remove
              on:load
              on:space-selected
              on:blacklist-resource
              on:whitelist-resource
              on:set-resource-as-space-icon
            />
          </MasonryView>
        {:else if viewType === 'grid'}
          <GridView items={resources} let:item>
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
              on:remove
              on:load
              on:space-selected
              on:blacklist-resource
              on:whitelist-resource
              on:set-resource-as-space-icon
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
