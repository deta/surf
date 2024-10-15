<script lang="ts" context="module">
  export type Pill = {
    id: string
    favicon?: string
    title: string
    type: string
    data?: any
    spaceId?: string
  }
</script>

<script lang="ts">
  import { onMount, afterUpdate, tick, createEventDispatcher } from 'svelte'
  import { spring } from 'svelte/motion'
  import { flip } from 'svelte/animate'
  import { useOasis } from '../../service/oasis'
  import { getFileKind, getFileType, getHostname, truncateURL } from '@horizon/utils'
  import { Icon } from '@horizon/icons'

  import SpaceIcon from '../Atoms/SpaceIcon.svelte'
  import type { ContextItem } from '../../types/browser.types'
  import { ResourceTagsBuiltInKeys, ResourceTypes } from '@horizon/types'
  import FileIcon from '../Resources/Previews/File/FileIcon.svelte'
  import { useResourceManager } from '@horizon/core/src/lib/service/resources'

  export let items: ContextItem[]

  const oasis = useOasis()
  const resourceManager = useResourceManager()

  const screenshotPreviews = new Map<string, string>()
  let isInitialized = false

  $: pills = items.map((item) => {
    if (item.type === 'tab') {
      const tab = item.data

      if (tab.type === 'resource' && tab.resourceType.startsWith('image/')) {
        return {
          id: item.id,
          favicon: undefined,
          title: 'Screenshot',
          type: 'image',
          data: tab
        }
      }

      return {
        id: item.id,
        favicon: tab.icon,
        title: tab.title,
        type: tab.type,
        data: tab,
        spaceId: tab.type === 'space' ? tab.spaceId : undefined
      }
    } else if (item.type === 'screenshot') {
      return {
        id: item.id,
        favicon: undefined,
        title: 'Screenshot',
        type: 'image'
      }
    } else if (item.type === 'resource') {
      const resource = item.data

      if (resource.type.startsWith('image/')) {
        return {
          id: resource.id,
          favicon: undefined,
          title: 'Image',
          type: 'image',
          data: item.data
        }
      }

      const canonicalURL =
        (resource.tags ?? []).find((tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL)
          ?.value ?? resource.metadata?.sourceURI

      return {
        id: resource.id,
        favicon: canonicalURL
          ? `https://www.google.com/s2/favicons?domain=${getHostname(canonicalURL)}&sz=48`
          : undefined,
        title:
          resource.metadata?.name ??
          (canonicalURL ? truncateURL(canonicalURL) : getFileType(resource.type)),
        type: item.type,
        data: item.data
      }
    } else if (item.type === 'space') {
      const spaceData = item.data.name
      return {
        id: item.id,
        favicon: spaceData.colors,
        title: spaceData.folderName,
        type: item.type,
        data: item.data
      }
    }
  }) as Pill[]

  const containerWidth = spring(220, { stiffness: 0.2, damping: 0.7 })

  const dispatch = createEventDispatcher<{
    select: string
    'remove-item': string
  }>()

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

  function blobToDataUrl(blob: Blob) {
    return new Promise<string | null>((resolve) => {
      // reduce the size of the image to 32x32
      const canvas = document.createElement('canvas')
      canvas.width = 32
      canvas.height = 32
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }

      const image = new Image()
      image.src = URL.createObjectURL(blob)

      image.onload = () => {
        ctx.drawImage(image, 0, 0, 32, 32)
        const dataUrl = canvas.toDataURL()

        URL.revokeObjectURL(image.src)

        resolve(dataUrl)
      }
    })
  }

  async function getOrCreateScreenshotPreview(item?: ContextItem) {
    if (!item) {
      return null
    }

    let blob: Blob

    if (item.type === 'tab' && item.data.type === 'resource') {
      const tabResource = item.data
      if (!tabResource.resourceType.startsWith('image/')) {
        return null
      }

      const resource = await resourceManager.getResource(tabResource.resourceId)
      if (!resource) {
        return null
      }

      blob = await resource.getData()
      resource.releaseData()
    } else if (item.type === 'screenshot') {
      blob = item.data
    } else {
      return null
    }

    if (screenshotPreviews.has(item.id)) {
      return screenshotPreviews.get(item.id) ?? null
    }

    const dataUrl = await blobToDataUrl(blob)
    if (!dataUrl) {
      return null
    }

    screenshotPreviews.set(item.id, dataUrl)

    return dataUrl
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

  const handleSelectTab = (tabId: string) => {
    dispatch('select', tabId)
  }

  const handleExcludeItem = (id: string) => {
    dispatch('remove-item', id)
  }

  function handleMouseLeave(event: MouseEvent) {}
</script>

<div class="relative w-full" style="height: 54px;" aria-hidden="true">
  <div
    class="flex items-center h-full relative overflow-x-autoscrollbar-hide overflow-y-hidden"
    style="width: {$containerWidth}px; height: 64px; min-width: 100%;  overflow-x: scroll;"
  >
    {#each pills as pill (pill.id)}
      <div
        aria-hidden="true"
        class="absolute top-0 left-0 shine-border pill transform hover:translate-y-[-6px]"
        animate:flip={{ duration: 300 }}
        on:click={() => handleSelectTab(pill.id)}
        on:contextmenu={() => handleExcludeItem(pill.id)}
        style="transform: translate({$pillProperties[pills.findIndex((p) => p.id === pill.id)]
          .x}px, {$pillProperties[pills.findIndex((p) => p.id === pill.id)]
          .y}px) rotate({$pillProperties[pills.findIndex((p) => p.id === pill.id)]
          .rotate}deg); transform-origin: center center;"
      >
        <div
          aria-hidden="true"
          class="pill flex items-center bg-white z-0 shadow-md {pill.type === 'image'
            ? 'pl-[6.5px]'
            : 'pl-[11px]'} hover:bg-red-100 transform hover:translate-y-[-6px]"
          style="width: {$pillProperties[pills.findIndex((p) => p.id === pill.id)]
            .width}px; height: {$pillProperties[pills.findIndex((p) => p.id === pill.id)]
            .height}px; border-radius: {$pillProperties[pills.findIndex((p) => p.id === pill.id)]
            .borderRadius}px; transition: width 0.3s, height 0.3s, transform 0.3s, background-color 0.3s;"
          on:mouseleave={handleMouseLeave}
        >
          <button
            class="remove absolute top-0 left-0 shadow-sm transform"
            style="background: white; border: 1px solid rgb(220,220,220); transform: translate(-20%, -20%); z-index: 10; width: 16px; aspect-ratio: 1 / 1; border-radius: 100%;"
            on:click={() => handleExcludeItem(pill.id)}
          >
            <Icon name="close" size="11px" color="black" />
          </button>
          <div
            class="flex items-center justify-center flex-shrink-0 {pill.type === 'image'
              ? 'w-8 h-8'
              : 'w-5 h-5'}"
          >
            {#if pill.type === 'page'}
              <img
                src={pill.favicon}
                alt={pill.title}
                class="w-full h-full object-contain"
                style="transition: transform 0.3s;"
                loading="lazy"
              />
            {:else if pill.type === 'space'}
              {#if pill?.data?.type === 'space'}
                {#await oasis.getSpace(pill.data.spaceId) then fetchedSpace}
                  {#if fetchedSpace}
                    <SpaceIcon folder={fetchedSpace} />
                  {/if}
                {/await}
              {:else}
                <SpaceIcon folder={pill.data} />
              {/if}
            {:else if pill.type === 'image'}
              {#await getOrCreateScreenshotPreview(items.find((i) => i.id === pill.id))}
                <Icon name="spinner" />
              {:then preview}
                {#if preview}
                  <img
                    src={preview}
                    alt={pill.title}
                    class="w-full h-full object-contain rounded"
                    style="transition: transform 0.3s;"
                    loading="lazy"
                  />
                {:else}
                  <Icon name="screenshot" size="20px" color="black" />
                {/if}
              {/await}
            {:else if pill.type === 'resource'}
              {#if pill.data.type === ResourceTypes.DOCUMENT_SPACE_NOTE}
                <Icon name="docs" size="16px" />
              {:else if pill.favicon}
                <img
                  src={pill.favicon}
                  alt={pill.title}
                  class="w-full h-full object-contain"
                  style="transition: transform 0.3s;"
                  loading="lazy"
                />
              {:else}
                <FileIcon kind={getFileKind(pill.data.type)} />
              {/if}
            {/if}
          </div>
          <span
            class="ml-2 whitespace-nowrap overflow-hidden text-sm"
            style="opacity: {$pillProperties[pills.findIndex((p) => p.id === pill.id)]
              .textOpacity}; filter: blur({$pillProperties[pills.findIndex((p) => p.id === pill.id)]
              .textBlur}px); transform: translateX({$pillProperties[
              pills.findIndex((p) => p.id === pill.id)
            ].textX}px); transition: opacity 0.3s, filter 0.3s;"
          >
            {pill.title}
          </span>
        </div>
      </div>
    {/each}
  </div>
</div>

<style lang="scss">
  .relative::-webkit-scrollbar {
    display: none;
  }
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  .shine-border {
    transform-box: fill-box;
    transform-origin: center center;
  }
  .pill {
    cursor: default;
    transition: transform 0.3s ease;
  }

  .add-container {
    position: absolute;
    z-index: 100000;
    top: -7px;
    left: -14px;
    bottom: 10px;
    height: 78px;
    background: linear-gradient(90deg, rgba(224, 242, 254, 1) 75%, rgba(255, 255, 255, 0) 100%);
    padding-left: 0.75rem;
    padding-right: 1.25rem;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .pill {
    button.remove {
      display: none;
      justify-content: center;
      align-items: center;
      transition: all 0.3 ease;
    }
    &:hover button.remove {
      display: flex;
    }
  }
  /*.pill.add {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 36px;
    aspect-ratio: 1 / 1;
    border-radius: 9px;

    &:hover,
    &.active {
      background: rgba(0, 0, 0, 0.1);
    }
  }*/
</style>
