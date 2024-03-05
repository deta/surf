<script lang="ts">
  import { onDestroy, onMount } from 'svelte'

  import { useLogScope } from '../../../utils/log'
  import type { ResourceBookmark } from '../../../service/resources'
  import type { SFFSResourceDataBookmark } from '../../../types'

  export let resource: ResourceBookmark

  const log = useLogScope('LinkCard')

  let bookmark: SFFSResourceDataBookmark | null = null
  let title = ''
  let subtitle = ''
  let error = ''

  onMount(async () => {
    try {
      const blob = await resource.getData()
      const text = await blob.text()
      bookmark = JSON.parse(text)

      console.log('bookmark', bookmark)

      const url = new URL(bookmark.url)

      const hostname = url.hostname.split('.').slice(-2, -1).join('')
      title = resource?.metadata?.name ?? hostname[0].toUpperCase() + hostname.slice(1)
      subtitle = `${url.hostname}${url.pathname}`
    } catch (e) {
      log.error(e)
      error = 'Invalid URL'
    }
  })

  onDestroy(() => {
    resource.releaseData()
  })
</script>

<a href={bookmark?.url} target="_blank" class="link-card">
  <div class="details">
    {#if error}
      <div class="title">{error}</div>
      <div class="subtitle">{bookmark?.url}</div>
    {:else}
      <div class="title">{title}</div>
      <div class="subtitle">{subtitle}</div>
    {/if}
  </div>
</a>

<style lang="scss">
  .link-card {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    color: inherit;
    text-decoration: none;
    user-select: none;
    -webkit-user-drag: none;
  }

  .details {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-grow: 1;
  }

  .title {
    font-size: 1.25rem;
    font-weight: 500;
    flex-shrink: 0;
  }

  .subtitle {
    font-size: 1rem;
    font-weight: 300;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 225px;
  }
</style>
