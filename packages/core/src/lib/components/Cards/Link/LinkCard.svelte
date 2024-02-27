<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import type { Writable } from 'svelte/store'

  import type { Card, SFFSResourceDataBookmark } from '../../../types/index'
  import { useLogScope } from '../../../utils/log'
  import type { ResourceBookmark } from '../../../service/resources'
  import type { Horizon } from '../../../service/horizon'

  export let card: Writable<Card>
  export let horizon: Horizon

  const log = useLogScope('LinkCard')

  let resource: ResourceBookmark | null = null
  let bookmark: SFFSResourceDataBookmark | null = null

  let title = ''
  let subtitle = ''
  let error = ''

  onMount(async () => {
    try {
      if (!$card.resourceId) {
        log.error('No resource id found', $card)
        error = 'No resource id found'
        return
      }

      resource = (await horizon.getResource($card.resourceId)) as ResourceBookmark | null
      if (!resource) {
        log.error('Resource not found', $card.resourceId)
        error = 'Resource not found'
        return
      }

      bookmark = await resource.getBookmark()

      const url = new URL(bookmark.url)

      const hostname = url.hostname.split('.').slice(-2, -1).join('')
      title = hostname[0].toUpperCase() + hostname.slice(1)
      subtitle = `${url.hostname}${url.pathname}`
    } catch (e) {
      log.error(e)
      error = 'Invalid URL'
    }
  })

  onDestroy(() => {
    if (resource) {
      resource.releaseData()
    }
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
    flex-direction: column;
    justify-content: center;
    gap: 0.5rem;
    flex-grow: 1;
  }

  .title {
    font-size: 1.25rem;
    font-weight: 500;
  }

  .subtitle {
    font-size: 1rem;
    font-weight: 300;
  }
</style>
