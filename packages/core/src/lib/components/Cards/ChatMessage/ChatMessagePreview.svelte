<script lang="ts">
  import { onDestroy, onMount } from 'svelte'

  import { useLogScope } from '../../../utils/log'
  import type { ResourceChatMessage } from '../../../service/resources'
  import type { ResourceDataChatMessage } from '../../../types'

  export let resource: ResourceChatMessage

  const log = useLogScope('PostPreview')

  let message: ResourceDataChatMessage | null = null
  let author = ''
  let content = ''
  let error = ''

  const MAX_TITLE_LENGTH = 55
  const MAX_SUBTITLE_LENGTH = 100

  const truncate = (text: string, length: number) => {
    return text.length > length ? text.slice(0, length) + '...' : text
  }

  onMount(async () => {
    try {
      message = await resource.getParsedData()

      console.log('message', message)

      const url = new URL(message.url)

      author = message.author
      content = message.content_plain
    } catch (e) {
      log.error(e)
      error = 'Invalid URL'
    }
  })

  onDestroy(() => {
    resource.releaseData()
  })
</script>

<a href={message?.url} target="_blank" class="link-card">
  <div>
    <img src={message?.platform_icon} alt={message?.platform_name} width="25px" height="25px" />
  </div>
  <div class="details">
    {#if error}
      <div class="title">{error}</div>
      <div class="subtitle">{message?.url}</div>
    {:else}
      <div class="content">{content}</div>
      <div class="author">{author}</div>
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

  .content {
    font-size: 1rem;
  }

  .author {
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }
</style>
