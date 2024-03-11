<script lang="ts">
  import { onDestroy, onMount } from 'svelte'

  import { useLogScope } from '../../../utils/log'
  import type { ResourceChatThread } from '../../../service/resources'
  import type { ResourceDataChatThread } from '../../../types'
  import Link from '../../Atoms/Link.svelte'
  import { formatDistanceToNow, parseISO } from 'date-fns'

  export let resource: ResourceChatThread
  export let type: string

  const log = useLogScope('MessagePreview')

  let thread: ResourceDataChatThread | null = null
  let chatMessage = ''
  let subtitle = ''
  let error = ''
  let isSlack = false
  let showFullMessages = false

  const MAX_TITLE_LENGTH = 300
  const MAX_SUBTITLE_LENGTH = 100

  const truncate = (text: string, length: number) => {
    return text.length > length ? text.slice(0, length) + '...' : text
  }

  function formatRelativeDate(dateIsoString) {
    return formatDistanceToNow(parseISO(dateIsoString), { addSuffix: true })
  }

  onMount(async () => {
    try {
      thread = await resource.getParsedData()

      console.log('messagethreaddata', thread)

      const url = new URL(thread.url)

      const hostname = url.hostname.split('.').slice(-2, -1).join('')
      chatMessage = truncate(thread.content_plain, MAX_TITLE_LENGTH)
      // subtitle = truncate(
      //   thread.excerpt || thread.content_plain || `${url.hostname}${url.pathname}`,
      //   MAX_SUBTITLE_LENGTH
      // )

      isSlack = type === 'application/vnd.space.chat-thread.slack'
    } catch (e) {
      log.error(e)
      error = 'Invalid URL'
    }
  })

  onDestroy(() => {
    resource.releaseData()
  })
</script>

<div href={thread?.url} target="_blank" class="link-card">
  <div class="details" class:slack={isSlack}>
    {#if error}
      <div class="title">{error}</div>
      <div class="subtitle">{thread?.url}</div>
    {:else}
      <img class="favicon" src={thread?.platform_icon} alt={`${thread?.platform_name} favicon`} />
      <div class={showFullMessages ? 'show-full-messages' : 'messages-preview'}>
        {#each thread?.messages.slice() || [] as message}
          <div class="message-author">
            {message.author} — {formatRelativeDate(message.date_sent)}
          </div>
          <div class="message-text">{message.content_plain}</div>
        {/each}
      </div>
      <div class="toggle-messages" on:click={() => (showFullMessages = !showFullMessages)}>
        {showFullMessages ? 'Show Less' : 'Show More'}
      </div>

      <div class="thread-metadata">
        <Link class="link" url={thread?.url} label={`Started from ${thread?.creator}`} />
        <div class="from">Slack Thread</div>
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .messages-preview {
    max-height: 500px; /* Adjust based on your font and line-height to match approximately 15 lines */
    overflow: hidden;
    transition: max-height 0.5s ease;
  }

  .show-full-messages {
    max-height: none;
  }

  .toggle-messages {
    cursor: pointer;
    /* Add more styling as needed */
  }

  .link-card {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 2rem;
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
    .message-author {
      opacity: 0.6;
    }

    .message-text {
    }
  }

  .slack {
    .favicon {
      box-shadow: none;
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
    margin-top: 1rem;
    max-width: 95%;
  }
  .thread-metadata {
    display: flex;
    flex-direction: column;
    padding: 0.5rem 0;
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
