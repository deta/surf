<script lang="ts">
  import { Icon } from '@deta/icons'
  import { Resource } from '@horizon/core/src/lib/service/resources'
  import { blobToSmallImageUrl } from '../../utils/screenshot'

  export let resource: Resource

  let blob: Blob | null = null

  async function loadImage() {
    if (!blob) {
      blob = await resource.getData()
      resource.releaseData()
    }

    const dataUrl = await blobToSmallImageUrl(blob)
    if (!dataUrl) {
      return null
    }

    return dataUrl
  }
</script>

<div class="w-5 h-5">
  {#await loadImage()}
    <Icon name="spinner" />
  {:then image}
    {#if image}
      <img
        src={image}
        alt={resource.metadata?.name ?? 'Preview'}
        class="w-full h-full object-contain rounded !m-0"
        style="transition: transform 0.3s;"
        loading="lazy"
      />
    {:else}
      <Icon name="screenshot" size="20px" color="black" />
    {/if}
  {/await}
</div>
