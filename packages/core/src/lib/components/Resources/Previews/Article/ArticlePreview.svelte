<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'
  import { useLogScope } from '@horizon/utils'
  import type { ResourceArticle } from '../../../../service/resources'
  import type { ResourceDataArticle } from '../../../../types'
  import LoadingBox from '../../../Atoms/LoadingBox.svelte'
  import type { ResourcePreviewEvents } from '../../../Resources/events'

  export let resource: ResourceArticle

  const log = useLogScope('articlePreview')
  const dispatch = createEventDispatcher<ResourcePreviewEvents<ResourceDataArticle>>()

  let article: ResourceDataArticle | null = null
  let title = ''
  let error = ''
  let loading = true

  const MAX_TITLE_LENGTH = 300

  const truncate = (text: string, length: number) => {
    return text.length > length ? text.slice(0, length) + '...' : text
  }

  const handleLoad = () => {
    dispatch('load')
  }

  onMount(async () => {
    try {
      loading = true
      article = await resource.getParsedData()
      dispatch('data', article)

      const url = new URL(article.url)
      const hostname = url.hostname.split('.').slice(-2, -1).join('')
      title = truncate(
        article.title || article.excerpt || hostname[0].toUpperCase() + hostname.slice(1),
        MAX_TITLE_LENGTH
      )

      if (!article.images || article.images.length === 0) {
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

<div class="link-card">
  <div class="details">
    {#if error}
      <div class="title">{error}</div>
      <div class="subtitle">{article?.url}</div>
    {:else if loading}
      <LoadingBox />
    {:else if article?.images[0]}
      <img
        class="image"
        alt={`${article?.site_name} image`}
        src={article?.images[0]}
        on:load={handleLoad}
      />
    {:else}
      <div class="article-preview-no-image">
        <img
          class="favicon"
          src={`https://www.google.com/s2/favicons?domain=${article?.url}&sz=48`}
          alt={`${article?.site_name} favicon`}
        />
        <div class="excerpt">
          {article?.excerpt}
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
  }

  .details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    width: 100%;
    flex-shrink: 1;
    flex-grow: 1;
  }

  .image {
    width: 100%;
    height: 100%;
    border-radius: 9px;
    pointer-events: none;
  }

  .title {
    font-size: 1.25rem;
    line-height: 1.775rem;
    letter-spacing: 0.01rem;
    color: #281b53;
    font-weight: 500;
    flex-shrink: 0;
    margin-top: 1rem;
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

  .article-preview-no-image {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 2rem 2.5rem;
    border-radius: 8px;
    background: #f6f5f2;

    .favicon {
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 5.1px;
      box-shadow:
        0px 0.425px 0px 0px rgba(65, 58, 86, 0.25),
        0px 0px 0.85px 0px rgba(0, 0, 0, 0.25);
    }

    .excerpt {
      font-size: 1.25rem;
      line-height: 1.775rem;
      color: #281b53;
      font-weight: 500;
      flex-shrink: 0;
      margin: 1rem 0;
      // truncate to max 15 lines
      display: -webkit-box;
      -webkit-line-clamp: 15;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  }
</style>
