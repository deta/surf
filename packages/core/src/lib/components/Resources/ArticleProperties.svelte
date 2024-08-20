<script lang="ts">
  import { onDestroy, onMount } from 'svelte'

  import { useLogScope } from '@horizon/core/src/lib/utils/log'
  import { generateRootDomain } from '@horizon/core/src/lib/utils/url'
  import type { Resourcearticle } from '@horizon/core/src/lib/service/resources'
  import type { ResourceDataarticle } from '@horizon/core/src/lib/types'

  export let resource: Resourcearticle
  export let hideURL: boolean = false

  const log = useLogScope('articlePreview')

  let article: ResourceDataarticle | null = null
  let title = ''
  let subtitle = ''
  let error = ''

  const MAX_TITLE_LENGTH = 80
  const MAX_SUBTITLE_LENGTH = 100

  const truncate = (text: string, length: number) => {
    return text.length > length ? text.slice(0, length) + '...' : text
  }

  onMount(async () => {
    try {
      article = await resource.getParsedData()

      const url = new URL(article.url)

      const hostname = url.hostname.split('.').slice(-2, -1).join('')
      title = truncate(
        article.title || article.excerpt || hostname[0].toUpperCase() + hostname.slice(1),
        MAX_TITLE_LENGTH
      )
      // subtitle = truncate(
      //   article.excerpt || article.content_plain || `${url.hostname}${url.pathname}`,
      //   MAX_SUBTITLE_LENGTH
      // )
    } catch (e) {
      log.error(e)
      error = 'Invalid URL'
    }
  })

  onDestroy(() => {
    resource.releaseData()
  })
</script>

<!-- <a href={article?.url} target="_blank" class="link-card"></a> -->
<div class="link-card">
  <div class="details">
    {#if error}
      <div class="title">{error}</div>
      <div class="subtitle">{article?.url}</div>
    {:else}
      <div class="title">{title}</div>
      {#if !hideURL}
        <div class="source">
          <img
            class="favicon"
            src={`https://www.google.com/s2/favicons?domain=${article?.url}&sz=48`}
            alt={`favicon`}
            loading="lazy"
          />
          <div class="subtitle">{generateRootDomain(article?.url)}</div>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style lang="scss">
  .link-card {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.25rem;
    color: inherit;
    text-decoration: none;
    user-select: none;
    -webkit-user-drag: none;
  }

  .details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex-grow: 1;
  }

  .image {
    width: 100%;
    height: 100%;
  }

  .title {
    font-size: 1.25rem;
    text-align: center;
    letter-spacing: 0.02rem;
    line-height: 1.5rem;
    color: #281b53;
    font-weight: 500;
    flex-shrink: 0;
    text-wrap: balance;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .source {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .favicon {
    width: 1rem;
    height: 1rem;
    border-radius: 5.1px;
    box-shadow:
      0px 0.425px 0px 0px rgba(65, 58, 86, 0.25),
      0px 0px 0.85px 0px rgba(0, 0, 0, 0.25);
  }

  .subtitle {
    font-size: 1rem;
    line-height: 1.4;
    letter-spacing: 0.02rem;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: center;
    font-smooth: always;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
</style>
