<script lang="ts">
  import { onDestroy, onMount } from 'svelte'

  import { useLogScope } from '../../../utils/log'
  import type { ResourcePost } from '../../../service/resources'
  import type { ResourceDataPost } from '../../../types'

  export let resource: ResourcePost

  const log = useLogScope('PostPreview')

  let post: ResourceDataPost | null = null
  let title = ''
  let subtitle = ''
  let error = ''

  const MAX_TITLE_LENGTH = 55
  const MAX_SUBTITLE_LENGTH = 100

  const truncate = (text: string, length: number) => {
    return text.length > length ? text.slice(0, length) + '...' : text
  }

  onMount(async () => {
    try {
      post = await resource.getParsedData()

      console.log('post', post)

      const url = new URL(post.url)

      const hostname = url.hostname.split('.').slice(-2, -1).join('')
      title = truncate(
        post.title || post.excerpt || hostname[0].toUpperCase() + hostname.slice(1),
        MAX_TITLE_LENGTH
      )
      subtitle = truncate(
        post.excerpt || post.content_plain || `${url.hostname}${url.pathname}`,
        MAX_SUBTITLE_LENGTH
      )
    } catch (e) {
      log.error(e)
      error = 'Invalid URL'
    }
  })

  onDestroy(() => {
    resource.releaseData()
  })
</script>

<a href={post?.url} target="_blank" class="link-card">
  <div class="details">
    {#if error}
      <div class="title">{error}</div>
      <div class="subtitle">{post?.url}</div>
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
    gap: 0.25rem;
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
    // overflow: hidden;
    // text-overflow: ellipsis;
    // white-space: nowrap;
    // max-width: 225px;
  }
</style>
