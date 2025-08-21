<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'

  import { useLogScope } from '@deta/utils/io'
  import type { ResourcePost } from '../../../../service/resources'
  import type { ResourceDataPost } from '../../../../types'
  import Link from '../../../Atoms/Link.svelte'
  import LoadingBox from '../../../Atoms/LoadingBox.svelte'
  import type { ResourcePreviewEvents } from '../../../Resources/events'

  export let resource: ResourcePost
  export let type: string

  const log = useLogScope('PostPreview')
  const dispatch = createEventDispatcher<ResourcePreviewEvents<ResourceDataPost>>()

  let post: ResourceDataPost | null = null
  let title = ''
  let error = ''
  let isTwitter = false
  let isReddit = false
  let loading = true

  const MAX_TITLE_LENGTH = 300

  const truncate = (text: string, length: number) => {
    return text.length > length ? text.slice(0, length) + '...' : text
  }

  onMount(async () => {
    try {
      loading = true
      post = await resource.getParsedData()
      dispatch('data', post)

      const url = new URL(post.url)

      const hostname = url.hostname.split('.').slice(-2, -1).join('')
      title = truncate(
        post.title || post.excerpt || hostname[0].toUpperCase() + hostname.slice(1),
        MAX_TITLE_LENGTH
      )

      isTwitter = type === 'application/vnd.space.post.twitter'
      isReddit = type === 'application/vnd.space.post.reddit'

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

<div class="link-card" class:loading>
  <!-- <a href={post?.url} target="_blank" class="link-card"> -->
  <div class="details" class:twitter={isTwitter} class:reddit={isReddit}>
    {#if error}
      <div class="title">{error}</div>
      <div class="subtitle">{post?.url}</div>
    {:else if loading}
      <LoadingBox height="150px" />
    {:else}
      <img
        class="favicon"
        src={`https://www.google.com/s2/favicons?domain=${post?.url}&sz=48`}
        alt={`${post?.site_name} favicon`}
      />
      <div class="title">{title}</div>
      <div class="post-metadata">
        <Link
          class="link"
          url={post?.author_url ?? ''}
          label={`From ${post?.author}`}
          color={isTwitter || isReddit ? 'white' : 'inherit'}
        />
        {#if isTwitter}<div class="from">Tweet</div>{/if}
        {#if isReddit}<div class="from">Reddit Post</div>{/if}
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
    gap: 1em;
    padding: 2em;
    color: inherit;
    text-decoration: none;
    user-select: none;
    -webkit-user-drag: none;

    &.loading {
      padding: 0 !important;
    }
  }

  .details {
    display: flex;
    flex-direction: column;
    gap: 0.25em;
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
    width: 1.5em;
    height: 1.5em;
    border-radius: 5.1px;
    box-shadow:
      0px 0.425px 0px 0px rgba(65, 58, 86, 0.25),
      0px 0px 0.85px 0px rgba(0, 0, 0, 0.25);
  }

  .title {
    font-size: 1.25em;
    line-height: 1.775em;
    letter-spacing: 0.02em;
    color: #281b53;
    font-weight: 500;
    flex-shrink: 0;
    margin-top: 1em;
    max-width: 95%;
    word-break: break-all;
  }
  .post-metadata {
    display: flex;
    flex-direction: column;
    padding: 0.5em 0;
    gap: 0.125em;
    .from {
      font-size: 1em;
      font-weight: 500;
      text-decoration: none;
      color: #281b53;
      opacity: 0.65;
    }
  }
</style>
