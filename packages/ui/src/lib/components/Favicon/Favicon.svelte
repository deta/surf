<script lang="ts">
  import { DynamicIcon, Icon, type Icons } from '@deta/icons'
  import { getFallbackFavicon } from '@deta/utils'
  import { parseURL, generateRootDomain } from '@deta/utils'

  export let url: string
  export let title: string = ''
  
  let error = false
  let loaded = false
  let imgElement: HTMLImageElement

  // Derive favicon URL from the main URL
  $: faviconURL = deriveFaviconURL(url)

  // Reset states when faviconURL changes
  $: if (faviconURL) {
    error = false
    loaded = false
    preloadImage()
  }

  const deriveFaviconURL = (pageURL: string): string => {
    if (!pageURL || typeof pageURL !== 'string') return ''
    
    const urlObj = parseURL(pageURL)
    if (!urlObj) {
      console.warn('Failed to parse URL for favicon:', pageURL)
      return ''
    }
    
    const domain = generateRootDomain(urlObj)
    if (!domain) return ''
    
    return getFallbackFavicon(domain, 32)
  }

  const preloadImage = () => {
    if (!faviconURL) return
    
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
    img.src = faviconURL
  }
</script>

{#if url && typeof url === 'string' && url.startsWith('http://localhost')}
  <DynamicIcon name="icon;;file-text-ai" />
{:else if loaded && !error && faviconURL}
  <img bind:this={imgElement} src={faviconURL} alt={title} draggable="false" />
{:else}
  <div class="favicon-fallback">
    <Icon name="squircle" size="100%" fill="white" />
  </div>
{/if}

<style>
  img {
    width: 16px;
    height: 16px;
    display: block;
    user-select: none;
    border-radius: 2px;
  }
  
  .favicon-fallback {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
