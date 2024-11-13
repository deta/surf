<script lang="ts" context="module">
  export interface PillBase {
    id: string
    contextItemId: string
    title: string
    type: 'space' | 'image' | 'resource'
    data?: any
  }

  export interface PillSpace extends PillBase {
    icon?: [string, string]
    type: 'space'
    data: string | OasisSpace
  }

  export interface PillImage extends PillBase {
    type: 'image'
    data: Blob | string
  }

  export interface PillResource extends PillBase {
    icon: string
    type: 'resource'
    data: {
      id: string
      type?: string
    }
  }

  export type Pill = PillSpace | PillImage | PillResource
</script>

<script lang="ts">
  import { onMount, afterUpdate, tick } from 'svelte'
  import { spring } from 'svelte/motion'
  import { getFileType, getHostname, truncateURL } from '@horizon/utils'

  import type { ContextItem } from '../../types/browser.types'
  import { ResourceTagsBuiltInKeys } from '@horizon/types'
  import ContextBubbleImage from './ContextBubbleItems/ContextBubbleImage.svelte'
  import ContextBubbleResource from './ContextBubbleItems/ContextBubbleResource.svelte'
  import ContextBubbleSpace from './ContextBubbleItems/ContextBubbleSpace.svelte'
  import type { OasisSpace } from '@horizon/core/src/lib/service/oasis'

  export let items: ContextItem[]

  let isInitialized = false

  const containerWidth = spring(220, { stiffness: 0.2, damping: 0.7 })

  $: pills = items.map((item) => {
    if (item.type === 'tab') {
      const tab = item.data

      if (tab.type === 'space') {
        return {
          id: `${item.id}-${tab.spaceId}`,
          contextItemId: item.id,
          title: tab.title,
          type: tab.type,
          data: tab.spaceId
        } as PillSpace
      } else if (tab.type === 'resource') {
        if (tab.resourceType.startsWith('image/')) {
          return {
            id: `${item.id}-${tab.resourceId}`,
            contextItemId: item.id,
            title: 'Screenshot',
            type: 'image',
            data: tab.resourceId
          } as PillImage
        }
        return {
          id: `${item.id}-${tab.resourceId}`,
          contextItemId: item.id,
          icon: tab.icon,
          title: tab.title,
          type: 'resource',
          data: {
            id: tab.resourceId,
            type: tab.resourceType
          }
        } as PillResource
      } else if (tab.type === 'page') {
        const resourceId = tab.resourceBookmark || tab.chatResourceBookmark
        return {
          id: `${item.id}-${resourceId}`,
          contextItemId: item.id,
          icon: tab.currentLocation?.startsWith('surf://') ? undefined : tab.icon,
          title: tab.title,
          type: 'resource',
          data: {
            id: resourceId,
            type: undefined
          }
        } as PillResource
      } else {
        // TODO: figure out what to do with other tab types
      }
    } else if (item.type === 'screenshot') {
      return {
        id: item.id,
        contextItemId: item.id,
        title: 'Screenshot',
        type: 'image',
        data: item.data
      } as PillImage
    } else if (item.type === 'resource') {
      const resource = item.data

      if (resource.type.startsWith('image/')) {
        return {
          id: resource.id,
          contextItemId: item.id,
          title: 'Image',
          type: 'image',
          data: resource.id
        } as PillImage
      }

      const canonicalURL =
        (resource.tags ?? []).find((tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL)
          ?.value ?? resource.metadata?.sourceURI

      return {
        id: `${item.id}-${resource.id}`,
        contextItemId: item.id,
        icon: canonicalURL
          ? `https://www.google.com/s2/favicons?domain=${getHostname(canonicalURL)}&sz=48`
          : undefined,
        title:
          resource.metadata?.name ??
          (canonicalURL ? truncateURL(canonicalURL) : getFileType(resource.type)),
        type: 'resource',
        data: {
          id: resource.id,
          type: resource.type
        }
      } as PillResource
    } else if (item.type === 'space') {
      const spaceData = item.data.dataValue
      return {
        id: `${item.id}-${item.data.id}`,
        contextItemId: item.id,
        icon: spaceData.colors,
        title: spaceData.folderName,
        type: 'space',
        data: item.data
      } as PillSpace
    }
  }) as Pill[]

  $: pillProperties = spring(
    pills.map((_, index) => ({
      x: index * 30,
      y: getSubtleVerticalOffset(),
      rotate: getSubtleRotation(),
      width: 40,
      height: 40,
      borderRadius: 9,
      textOpacity: 0,
      textBlur: 10,
      textX: -20
    })),
    { stiffness: 0.5, damping: 0.8 }
  )

  async function initializePositions() {
    await tick()
    pillProperties.set(
      pills.map((_, index) => ({
        x: index * 30,
        y: getSubtleVerticalOffset(),
        rotate: getSubtleRotation(),
        width: 40,
        height: 36,
        borderRadius: 9,
        textOpacity: 0,
        textBlur: 10,
        textX: -20
      }))
    )
  }

  function getSubtleVerticalOffset() {
    return (Math.random() * 2 - 1) * 2.5 + 8
  }

  function getSubtleRotation() {
    return (Math.random() * 2 - 1) * 3.5
  }

  async function resetAnimation() {
    await initializePositions()
  }

  onMount(async () => {
    await initializePositions()
    isInitialized = true
  })

  afterUpdate(async () => {
    if (isInitialized && pills.length !== $pillProperties.length) {
      await resetAnimation()
    }
  })
</script>

<div class="relative w-full" style="height: 54px;" aria-hidden="true">
  <div
    class="flex items-center -space-x-3 h-full relative overflow-x-autoscrollbar-hide"
    style="width: {$containerWidth}px; height: 64px; min-width: 100%; overflow-x: scroll;"
  >
    {#each pills as pill (pill?.id)}
      {#if pill?.type === 'space'}
        <ContextBubbleSpace
          {pill}
          pillProperties={$pillProperties[pills.findIndex((p) => p?.id === pill?.id)] ?? {}}
          on:remove-item
          on:select
          on:retry
        />
      {:else if pill?.type === 'image'}
        <ContextBubbleImage
          {pill}
          pillProperties={$pillProperties[pills.findIndex((p) => p?.id === pill?.id)] ?? {}}
          on:remove-item
          on:select
          on:retry
        />
      {:else if pill?.type === 'resource'}
        <ContextBubbleResource
          {pill}
          pillProperties={$pillProperties[pills.findIndex((p) => p?.id === pill?.id)] ?? {}}
          on:remove-item
          on:select
          on:retry
        />
      {/if}
    {/each}
  </div>
</div>

<style lang="scss">
  .relative::-webkit-scrollbar {
    display: none;
  }
</style>
