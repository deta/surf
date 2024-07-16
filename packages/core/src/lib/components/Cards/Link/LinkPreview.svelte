<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'

  import { useLogScope } from '../../../utils/log'
  import type { ResourceLink } from '../../../service/resources'
  import type { ResourceDataLink } from '@horizon/types'

  import Link from '../../Atoms/Link.svelte'
  import { generateRootDomain } from '../../../utils/url'
  import LoadingBox from '../../Atoms/LoadingBox.svelte'
  import type { ResourcePreviewEvents } from '../../Resources/events'

  export let resource: ResourceLink

  const log = useLogScope('LinkPreview')
  const dispatch = createEventDispatcher<ResourcePreviewEvents<ResourceDataLink>>()

  let link: ResourceDataLink | null = null
  let title = ''
  let subtitle = ''
  let image = ''
  let error = ''
  let loading = true

  const handleLoad = () => {
    dispatch('load')
  }

  onMount(async () => {
    try {
      loading = true
      link = await resource.getParsedData()
      dispatch('data', link)

      const url = new URL(link.url)

      const hostname = url.hostname.split('.').slice(-2, -1).join('')
      title =
        link.title ?? resource?.metadata?.name ?? hostname[0].toUpperCase() + hostname.slice(1)
      subtitle = link.description ?? `${url.hostname}${url.pathname}`

      if (!link.image) {
        dispatch('load')
      }
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
      <div class="subtitle">{link?.url}</div>
    {:else if loading}
      <LoadingBox />
    {:else if link?.image}
      <img class="image" alt={`${link?.provider} image`} src={link?.image} on:load={handleLoad} />
    {:else if !link?.image}
      <div class="link-preview-no-image">
        <img
          class="favicon"
          src={`https://www.google.com/s2/favicons?domain=${link?.url}&sz=256`}
          alt={`${link?.provider} favicon`}
        />
        <div class="description">
          {#if link?.description || link?.provider || ''}
            {link?.description || link?.provider || ''}
          {:else}
            <Link
              url={link?.url || '#'}
              label={generateRootDomain(link?.url || '#')}
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
    gap: 1rem;
    padding: 0.5rem;
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
    font-size: 1.25rem;
    line-height: 1.775rem;
    letter-spacing: 0.02rem;
    text-wrap: balance;
    color: #281b53;
    font-weight: 500;
    flex-shrink: 0;
    margin-top: 1rem;
    max-width: 30ch;
  }

  .subtitle {
    font-size: 1rem;
    line-height: 1.4;
    letter-spacing: 0.02rem;
    font-weight: 300;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 225px;
  }

  .link-preview-no-image {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 2rem 2.5rem;
    width: 100%;
    background: #f6f5f2;
    .favicon {
      width: 2rem;
      height: 2rem;
      border-radius: 5.1px;
      box-shadow:
        0px 0.425px 0px 0px rgba(65, 58, 86, 0.25),
        0px 0px 0.85px 0px rgba(0, 0, 0, 0.25);
    }
    .description {
      font-size: 1.25rem;
      line-height: 1.775rem;
      color: #281b53;
      font-weight: 500;
      flex-shrink: 0;
      margin-top: 1rem;
      max-width: 95%;
    }
  }
</style>
