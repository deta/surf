<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'

  import { useLogScope, generateRootDomain } from '@horizon/utils'
  import type { ResourceHistoryEntry } from '../../../../service/resources'
  import type { ResourceDataHistoryEntry } from '@horizon/types'

  import Link from '../../../Atoms/Link.svelte'
  import LoadingBox from '../../../Atoms/LoadingBox.svelte'
  import type { ResourcePreviewEvents } from '../../../Resources/events'

  export let resource: ResourceHistoryEntry

  const log = useLogScope('LinkPreview')
  const dispatch = createEventDispatcher<ResourcePreviewEvents<ResourceDataHistoryEntry>>()

  let link: ResourceDataHistoryEntry | null = null
  let title = ''
  let subtitle = ''
  let error = ''
  let loading = true

  onMount(async () => {
    try {
      loading = true
      link = await resource.getParsedData()
      dispatch('data', link)

      const url = new URL(link.raw_url)

      const hostname = url.hostname.split('.').slice(-2, -1).join('')
      title =
        link.title ?? resource?.metadata?.name ?? hostname[0].toUpperCase() + hostname.slice(1)
      subtitle = `${url.hostname}${url.pathname}`

      dispatch('load')
    } catch (e) {
      log.error(e)
      error = 'Invalid URL'
    } finally {
      loading = false
    }
  })

  onDestroy(() => {
    resource.releaseData()
  })
</script>

<!-- <a href={link?.url} target="_blank" class="link-card"></a> -->
<div class="link-card">
  <div class="details">
    {#if error}
      <div class="title">{error}</div>
      <div class="subtitle">{link?.raw_url}</div>
    {:else if loading}
      <LoadingBox />
    {:else}
      <div class="link-preview-no-image">
        <img
          class="favicon"
          src={`https://www.google.com/s2/favicons?domain=${link?.raw_url}&sz=48`}
          alt="favicon"
        />
        <div class="description">
          {#if title}
            {title}
          {:else}
            <Link
              url={link?.raw_url || '#'}
              label={generateRootDomain(link?.raw_url || '#')}
              style="font-size: {'1rem'}"
            />
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  * {
    user-select: none;
    -webkit-user-drag: none;
  }
  .link-card {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 1em;
    padding: 0.5em;
    color: inherit;
    text-decoration: none;
    user-select: none;
    -webkit-user-drag: none;
  }

  .details {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1em;
    width: 100%;
    flex-shrink: 1;
    flex-grow: 1;
  }

  .image {
    width: 100%;
    height: 100%;
    border-radius: 9px;
  }

  .title {
    font-size: 1.25em;
    line-height: 1.775em;
    letter-spacing: 0.02em;
    text-wrap: balance;
    color: #281b53;
    font-weight: 500;
    flex-shrink: 0;
    margin-top: 1em;
    max-width: 30ch;
  }

  .subtitle {
    font-size: 1em;
    line-height: 1.4;
    letter-spacing: 0.02em;
    font-weight: 300;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 225px;
  }

  .link-preview-no-image {
    display: flex;
    flex-direction: column;
    gap: 1em;
    padding: 2em 2.5em;
    width: 100%;
    background: #f6f5f2;
    .favicon {
      width: 2em;
      height: 2em;
      border-radius: 5.1px;
      box-shadow:
        0px 0.425px 0px 0px rgba(65, 58, 86, 0.25),
        0px 0px 0.85px 0px rgba(0, 0, 0, 0.25);
    }
    .description {
      font-size: 1.25em;
      line-height: 1.775em;
      color: #281b53;
      font-weight: 500;
      flex-shrink: 0;
      margin-top: 1em;
      max-width: 95%;
    }
  }
</style>
