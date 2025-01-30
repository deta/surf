<script lang="ts">
  import { Icon, type Icons } from '@horizon/icons'
  import ColorIcon from './ColorIcon.svelte'
  import type { IconImage, IconEmoji, IconColors, IconIcon } from './types.ts'

  export let name: string
  export let size: string | number = '18px'

  $: isImage = name.startsWith('image;;') // image;;https://example.com/image.jpg
  $: isFavicon = name.startsWith('favicon;;') // favicon;;https://example.com
  $: isEmoji = name.startsWith('emoji;;') // emoji;;🚀
  $: isColors = name.startsWith('colors;;') // colors;;#FF0000;;#00FF00
  $: isIcon = name.startsWith('icon;;') // icon;;check

  const getData = (name: string) => {
    if (isImage) {
      return {
        type: 'image',
        data: name.split(';;')[1]
      } as IconImage
    } else if (isFavicon) {
      return {
        type: 'image',
        data: `https://www.google.com/s2/favicons?sz=64&domain_url=${name.split(';;')[1]}`
      } as IconImage
    } else if (isEmoji) {
      return {
        type: 'emoji',
        data: name.split(';;')[1]
      } as IconEmoji
    } else if (isColors) {
      const colors = name.split(';;')
      return {
        type: 'colors',
        data: [colors[1], colors[2]] as [string, string]
      } as IconColors
    } else if (isIcon) {
      return {
        type: 'icon',
        data: name.split(';;')[1] as Icons
      } as IconIcon
    } else {
      return {
        type: 'icon',
        data: name as Icons
      } as IconIcon
    }
  }

  $: icon = getData(name)
</script>

{#if icon.type === 'image'}
  <img src={icon.data} alt="icon" style="width: {size}; height: {size}" class="image" />
{:else if icon.type === 'emoji'}
  <div style="max-height: {size};" class="flex items-center justify-center overflow-hidden">
    <span style="font-size: {size}; transfrom: scale(0.95);">{icon.data}</span>
  </div>
{:else if icon.type === 'colors'}
  <ColorIcon colors={icon.data} {size} />
{:else if icon.type === 'icon'}
  <Icon name={icon.data} {size} />
{/if}

<style lang="scss">
  .image {
    border-radius: 5px;
    object-fit: cover;
  }
</style>
