<script lang="ts">
  import { Icon } from '@horizon/icons'
  import type { PillImage } from '../ContextBubbles.svelte'
  import { useResourceManager } from '@horizon/core/src/lib/service/resources'
  import ContextBubbleItemWrapper, { type PillProperties } from './ContextBubbleItemWrapper.svelte'
  import { blobToDataUrl, blobToSmallImageUrl } from '../../../utils/screenshot'

  export let pill: PillImage
  export let pillProperties: PillProperties

  const resourceManager = useResourceManager()

  let blob: Blob | null = null
  let previewImage: string | null = null
  let fullImage: string | null = null

  async function getSmallImage() {
    if (typeof pill.data === 'string') {
      const resource = await resourceManager.getResource(pill.data)
      if (!resource) {
        return null
      }

      blob = await resource.getData()
      resource.releaseData()
    } else {
      blob = pill.data
    }

    // if (screenshotPreviews.has(pill.id)) {
    //   return screenshotPreviews.get(pill.id) ?? null
    // }

    const dataUrl = await blobToSmallImageUrl(blob)
    if (!dataUrl) {
      return null
    }

    previewImage = dataUrl

    // screenshotPreviews.set(pill.id, dataUrl)

    return dataUrl
  }

  async function getBigImage() {
    if (!blob) {
      return null
    }

    return blobToDataUrl(blob)
  }
</script>

<ContextBubbleItemWrapper {pill} {pillProperties} on:remove-item on:select on:retry>
  {#await getSmallImage()}
    <Icon name="spinner" />
  {:then image}
    {#if image}
      <img
        src={image}
        alt={pill.title}
        class="w-full h-full object-contain rounded"
        style="transition: transform 0.3s;"
        loading="lazy"
      />
    {:else}
      <Icon name="screenshot" size="20px" color="black" />
    {/if}
  {/await}

  <div slot="popover" class="p-1">
    {#await getBigImage()}
      <Icon name="spinner" />
    {:then image}
      {#if image}
        <img
          src={image}
          alt={pill.title}
          class="w-full h-full object-contain rounded-lg"
          style="transition: transform 0.3s;"
        />
      {:else}
        <Icon name="screenshot" size="20px" color="black" />
      {/if}
    {/await}
  </div>
</ContextBubbleItemWrapper>
