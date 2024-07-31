<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'

  import { useLogScope } from '../../../utils/log'
  import type { ResourcePost } from '../../../service/resources'
  import type { ResourceDataPost } from '../../../types'
  import { Icon } from '@horizon/icons'
  import Link from '../../Atoms/Link.svelte'
  import LoadingBox from '../../Atoms/LoadingBox.svelte'
  import type { ResourcePreviewEvents } from '../../Resources/events'
  import fallback from '../../../../../public/assets/fallback.youtube.png'

  export let resource: ResourcePost
  export let type: string

  const log = useLogScope('PostPreview')
  const dispatch = createEventDispatcher<ResourcePreviewEvents<ResourceDataPost>>()

  let post: ResourceDataPost | null = null
  let title = ''
  let subtitle = ''
  let error = ''
  let isTwitter = false
  let isReddit = false
  let youtubeThumbnailURL = ''
  let loading = true

  const MAX_TITLE_LENGTH = 300
  const MAX_SUBTITLE_LENGTH = 100

  const truncate = (text: string, length: number) => {
    return text.length > length ? text.slice(0, length) + '...' : text
  }

  const getYoutubeThumbnailURL = (url: URL) => {
    try {
      const videoId = url.searchParams.get('v')
      if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
      } else {
        log.warn('Video ID not found in URL')
      }
    } catch (e) {
      log.error('Failed to parse YouTube URL', e)
    }

    const fallbackURL = fallback
    log.info('Returning fallback thumbnail URL')
    return fallbackURL
  }

  const handleLoad = () => {
    dispatch('load')
  }

  onMount(async () => {
    try {
      loading = true
      post = await resource.getParsedData()
      dispatch('data', post)

      const url = new URL(post.url)
      const hostname = url.hostname.split('.').slice(-2, -1).join('')
      title = truncate(
        post.title || post.excerpt || `${hostname[0].toUpperCase()}${hostname.slice(1)}`,
        MAX_TITLE_LENGTH
      )

      if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
        youtubeThumbnailURL = getYoutubeThumbnailURL(url)
      }

      if (!youtubeThumbnailURL) {
        dispatch('load')
      }
    } catch (e) {
      log.error(e)
      title = 'Invalid URL'
    } finally {
      loading = false
    }
  })

  onDestroy(() => {
    resource.releaseData()
  })
</script>

<div class="link-card">
  {#if loading}
    <LoadingBox>
      <img src={fallback} alt="Loading fallback image" />
    </LoadingBox>
  {:else}
    <img
      class="youtube-thumbnail"
      src={youtubeThumbnailURL}
      alt="YouTube video thumbnail"
      on:load={handleLoad}
    />
  {/if}
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
    color: inherit;
    text-decoration: none;
    user-select: none;
    -webkit-user-drag: none;
  }

  .thumbnail-wrapper {
    position: relative;
    line-height: 0; /* Remove space below the image caused by line height */
    display: block; /* Ensure the wrapper behaves as a block element */
  }

  .play-icon {
    position: absolute;
    bottom: 0.5rem;
    left: 0.5rem;
    z-index: 10;
    opacity: 0.95;
    backdrop-filter: blur(0.5px);
  }

  .youtube-thumbnail {
    display: block; /* Make the image a block element to remove bottom space */
    width: 100%;
    height: auto;
    border-radius: 16px;
    vertical-align: bottom; /* Align the image to the bottom to eliminate gap */
  }

  .details {
    display: flex;
    flex-direction: column;
    width: 100%;
    flex-shrink: 1;
    flex-grow: 1;
  }

  .twitter,
  .reddit {
    .title,
    .post-metadata > .from {
      color: #ffffff;
    }
  }

  .favicon {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 5.1px;
    box-shadow:
      0px 0.425px 0px 0px rgba(65, 58, 86, 0.25),
      0px 0px 0.85px 0px rgba(0, 0, 0, 0.25);
  }

  .title {
    font-size: 1.25rem;
    line-height: 1.775rem;
    letter-spacing: 0.02rem;
    color: #281b53;
    font-weight: 500;
    flex-shrink: 0;
    max-width: 95%;
  }
  .post-metadata {
    display: flex;
    flex-direction: column;
    padding: 0.5rem;
    gap: 0.125rem;
    .from {
      font-size: 1rem;
      font-weight: 500;
      text-decoration: none;
      color: #281b53;
      opacity: 0.65;
    }
  }
</style>
