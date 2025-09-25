<script lang="ts">
  import { Icon } from '@deta/icons'
  import SurfIcon from './surf.ico'

  export let url: string
  export let title: string = ''

  let error = false
  let loaded = false
  let imgElement: HTMLImageElement

  // Reset states when faviconURL changes
  $: if (url) {
    error = false
    loaded = false
    preloadImage()
  }

  const preloadImage = () => {
    if (!url) return
    
    const img = new Image()
    img.onload = () => {
      // generic fallback
      if (img.naturalWidth <= 16 && img.naturalHeight <= 16) {
        error = true
        loaded = false
      } else {
        loaded = true
        error = false
      }
    }
    img.onerror = () => {
      error = true
      loaded = false
    }
    img.src = url
  }
</script>

{#if loaded && !error && url}
  <img bind:this={imgElement} src={url} alt={title} draggable="false" />
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
