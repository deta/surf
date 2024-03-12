<script lang="ts">
  import { onDestroy, onMount } from 'svelte'

  import { useLogScope } from '../../../utils/log'
  import type { ResourceArticle } from '../../../service/resources'
  import type { ResourceDataArticle } from '../../../types'
  import LoadingBox from '../../Atoms/LoadingBox.svelte'

  export let resource: Resourcearticle

  const log = useLogScope('articlePreview')

  let article: ResourceDataarticle | null = null
  let title = ''
  let subtitle = ''
  let excerpt = ''
  let error = ''
  let loading = true

  const MAX_TITLE_LENGTH = 300
  const MAX_SUBTITLE_LENGTH = 100

  const truncate = (text: string, length: number) => {
    return text.length > length ? text.slice(0, length) + '...' : text
  }

  onMount(async () => {
    try {
      loading = true
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
    } finally {
      loading = false
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
    {:else if loading}
      <LoadingBox />
    {:else if article?.image}
      <img class="image" alt={`${article?.provider} image`} src={article?.image} />
    {:else if article?.images[0]}
      <img class="image" alt={`${article?.provider} image`} src={article?.images[0]} />
    {:else if !article?.image && !article?.images[0]}
      <div class="article-preview-no-image">
        <img
          class="favicon"
          src={`https://www.google.com/s2/favicons?domain=${article?.url}&sz=256`}
          alt={`${article?.provider} favicon`}
        />
        <div class="excerpt">
          {article?.excerpt}
        </div>
      </div>
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
    padding: 1rem;
    color: inherit;
    text-decoration: none;
    user-select: none;
    -webkit-user-drag: none;
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
    border-radius: 3px;
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
    font-weight: 300;
    // overflow: hidden;
    // text-overflow: ellipsis;
    // white-space: nowrap;
    // max-width: 225px;
  }

  .article-preview-no-image {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 2rem 2.5rem;
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
    }
  }
</style>
