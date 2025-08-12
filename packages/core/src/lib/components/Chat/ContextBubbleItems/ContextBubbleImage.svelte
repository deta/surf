<script lang="ts">
  import { Icon } from '@deta/icons'
  import ContextBubbleItemWrapper from './ContextBubbleItemWrapper.svelte'
  import { blobToDataUrl } from '../../../utils/screenshot'
  import type { ContextItemScreenshot } from '@horizon/core/src/lib/service/ai/contextManager'

  export let item: ContextItemScreenshot

  $: label = item.label
  $: icon = item.icon

  async function getBigImage() {
    return blobToDataUrl(item.data)
  }
</script>

<ContextBubbleItemWrapper {item} on:remove-item on:select on:retry>
  {#if $icon.type === 'image'}
    <img
      src={$icon.data}
      alt={$label}
      class="w-[1.25rem] h-[1.25rem] object-contain rounded"
      style="transition: transform 0.3s;"
      loading="lazy"
    />
  {:else if $icon.type === 'icon'}
    <Icon name={$icon.data} size="20px" color="black" />
  {:else}
    <Icon name="screenshot" size="20px" color="black" />
  {/if}

  <div slot="popover">
    {#await getBigImage()}
      <Icon name="spinner" />
    {:then image}
      {#if image}
        <img
          src={image}
          alt={$label}
          class="w-full h-full object-contain rounded-lg"
          style="transition: transform 0.3s;"
        />
      {:else}
        <Icon name="screenshot" size="20px" color="black" />
      {/if}
    {/await}
  </div>
</ContextBubbleItemWrapper>
