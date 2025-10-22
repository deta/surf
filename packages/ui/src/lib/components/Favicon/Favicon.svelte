<script lang="ts">
  import { Icon } from '@deta/icons'
  import { useLogScope } from '@deta/utils'

  export let url: string
  export let title: string = ''

  const log = useLogScope('Favicon')

  let error = false
  let loaded = false

  // Reset states when faviconURL changes
  $: if (url) {
    log.debug('Loading favicon for URL:', url)
    error = false
    loaded = false
    preloadImage()
  }

  let currentImg: HTMLImageElement | null = null

  const preloadImage = () => {
    if (!url) return

    if (currentImg) {
      currentImg.onload = null
      currentImg.onerror = null
    }

    const img = new Image()
    currentImg = img

    img.onload = () => {
      if (img === currentImg) {
        loaded = true
        error = false
      }
    }

    img.onerror = (imgError) => {
      if (img === currentImg) {
        log.warn('Failed to load favicon, using fallback icon: ', imgError)
        error = true
        loaded = false
      }
    }

    img.src = url
  }
</script>

{#if loaded && !error && url}
  <img bind:this={currentImg} src={url} alt={title} draggable="false" />
{:else}
  <div class="favicon-fallback">
    <Icon name="squircle" size="16px" />
  </div>
{/if}

<style>
  img {
    margin: 0;
    width: 16px;
    height: 16px;
    display: block;
    user-select: none;
    border-radius: 2px;
  }

  .favicon-fallback {
    min-width: 16px;
    min-height: 16px;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
