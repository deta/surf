<script lang="ts">
  import { Command } from '@horizon/cmdk-sv'

  import type { TabItem } from './ChatContextTabPicker.svelte'
  import SpaceIcon from '@horizon/core/src/lib/components/Atoms/SpaceIcon.svelte'
  import { Icon, DynamicIcon } from '@horizon/icons'
  import FileIcon from '@horizon/icons/src/lib/FileIcon.svelte'
  import { useOasis } from '@horizon/core/src/lib/service/oasis'
  import { get } from 'svelte/store'
  import type { ContextItem } from '@horizon/core/src/lib/service/ai/context'
  import {
    ContextItemPageTab,
    ContextItemTypes
  } from '@horizon/core/src/lib/service/ai/contextManager'
  import { contextMenu } from '../Core/ContextMenu.svelte'
  import { createEventDispatcher } from 'svelte'
  import { conditionalArrayItem } from '@horizon/utils'
  import { useResourceManager } from '../../service/resources'

  export let item: TabItem
  export let disableCtxMenu: boolean = false

  const dispatch = createEventDispatcher<{
    'open-as-tab': unknown
    'retry-processing': unknown
    'remove-from-ctx': unknown
  }>()

  const oasis = useOasis()
  const resourceManager = useResourceManager()
  const resources = resourceManager.resources

  const getAlternativeLabel = (item: TabItem) => {
    if (item.type !== 'context-item') return undefined

    const contextItem = item.data as ContextItem

    if (contextItem.type === ContextItemTypes.ACTIVE_SPACE) {
      return 'Active Context'
    } else if (contextItem.type === ContextItemTypes.ACTIVE_TAB) {
      return 'Active Tab'
    } else {
      return undefined
    }
  }

  const handleRetry = (item: ContextItem) => {
    if (['active-tab'].includes(item.id)) {
      dispatch('retry-processing', item.data.itemValue.data.id)
    } else {
      dispatch('retry-processing', item.id)
    }
  }

  const handleOpenTab = (item: ContextItem) => {
    dispatch('open-as-tab', item.data?.dataValue?.resourceBookmark ?? item.id)
  }

  $: label = item.label
  $: labelValue = getAlternativeLabel(item) ?? (typeof label === 'string' ? label : get(label))

  $: resource = ['active-tab'].includes(item.id)
    ? $resources.find((r) => r.id === item.data?.itemValue?.data?.id)
    : $resources.find((r) => r.id === item.id)

  $: resourceState = resource ? resource.state : null
  $: isProcessing =
    resourceState !== null
      ? $resourceState === 'post-processing' || $resourceState === 'extracting'
      : false
  $: processingFailed =
    item.type === 'context-item' && resourceState !== null ? $resourceState === 'error' : false
</script>

<Command.Item value={item.value} data-item-selected={item.selected} on:click>
  <div
    class="item flex items-center gap-2 min-w-0 flex-grow"
    class:processingFailed
    data-ignore-click-outside
    use:contextMenu={{
      canOpen: !disableCtxMenu,
      items: [
        ...conditionalArrayItem(!['active-tab', 'active-context', 'everything'].includes(item.id), {
          type: 'action',
          icon: 'arrow.up.right',
          text: 'Open as Tab',
          action: () => handleOpenTab(item)
        }),
        ...conditionalArrayItem(item.canRetryProcessing, {
          type: 'action',
          icon: 'reload',
          // We currently dont easily check the resource and processing state
          text: processingFailed ? 'Retry Processing' : 'Rerun Processing',
          action: () => handleRetry(item)
        }),
        {
          type: 'action',
          icon: 'close',
          text: 'Remove from context',
          kind: 'danger',
          action: () => dispatch('remove-from-ctx', item.id)
        }
      ]
    }}
  >
    <div class="flex items-center justify-center select-none shrink-0 aspect-square w-4">
      <!-- {#if item.selected}
              <Icon name="check" size="14px" /> -->
      {#if isProcessing}
        <Icon name="spinner" size="1em" />
      {:else if item.iconUrl}
        <img
          src={item.iconUrl}
          alt={labelValue}
          class="w-full h-full object-contain flex-shrink-0"
          style="transition: transform 0.3s;"
          loading="lazy"
        />
      {:else if item.iconSpaceId}
        {#await oasis.getSpace(item.iconSpaceId) then fetchedSpace}
          {#if fetchedSpace}
            <SpaceIcon folder={fetchedSpace} size="sm" interactive={false} />
          {/if}
        {/await}
      {:else if item.icon && (item.type === 'built-in' || item.type === 'context-item')}
        <DynamicIcon name={item.icon} size="14px" />
      {:else if item.icon}
        <FileIcon kind={item.icon} />
      {:else}
        <Icon name="world" size="100%" />
      {/if}
    </div>
    <span class="truncate">
      {labelValue}
    </span>
  </div>

  <div class="flex-shrink-0 flex items-center gap-2">
    {#if item.description}
      <div class="description text-xs">
        {item.description}
      </div>
    {/if}

    {#if item.descriptionIcon}
      <div
        class="icon flex items-center justify-center {item.selected
          ? 'opacity-75'
          : ''} dark:text-white"
      >
        <DynamicIcon name={item.descriptionIcon} size="16px" />
      </div>
    {/if}
  </div>
</Command.Item>

<style lang="scss">
  .item {
    color: light-dark(black, white);
    .description,
    .icon {
      color: light-dark(black, white);
    }
  }
  .item.processingFailed {
    color: light-dark(#4f5e6c, #7d94a9);
  }
</style>
