<script lang="ts">
  import { onDestroy, onMount, getContext, createEventDispatcher } from 'svelte'

  import { useLogScope } from '@deta/utils/io'
  import type { ResourceChatThread } from '../../../../service/resources'
  import type { ResourceDataChatThread } from '../../../../types'
  import Link from '../../../Atoms/Link.svelte'
  import { formatDistanceToNow, parseISO } from 'date-fns'
  import type { ResourcePreviewEvents } from '../../../Resources/events'

  export let resource: ResourceChatThread
  export let type: string

  const log = useLogScope('MessagePreview')
  const dispatch = createEventDispatcher<ResourcePreviewEvents<ResourceDataChatThread>>()
  const viewState: any = getContext('drawer.viewState')

  let thread: ResourceDataChatThread | null = null
  let chatMessage = ''
  let error = ''
  let isSlack = false

  const MAX_TITLE_LENGTH = 300

  const truncate = (text: string, length: number) => {
    return text.length > length ? text.slice(0, length) + '...' : text
  }

  function formatRelativeDate(dateIsoString: string) {
    return formatDistanceToNow(parseISO(dateIsoString), { addSuffix: true })
  }

  onMount(async () => {
    try {
      thread = await resource.getParsedData()
      dispatch('data', thread)

      chatMessage = truncate(thread.content_plain, MAX_TITLE_LENGTH)
      isSlack = type === 'application/vnd.space.chat-thread.slack'

      dispatch('load')
    } catch (e) {
      log.error(e)
      error = 'Invalid URL'
    }
  })

  onDestroy(() => {
    resource.releaseData()
  })
</script>

<!-- <a href={thread?.url} target="_blank" class="link-card"></a> -->
<div class="link-card">
  <div class="details" class:slack={isSlack}>
    {#if error}
      <div class="title">{error}</div>
      <div class="subtitle">{thread?.url}</div>
    {:else}
      <img class="favicon" src={thread?.platform_icon} alt={`${thread?.platform_name} favicon`} />
      <div class="thread-metadata">
        <div class="from">Slack Thread</div>
        <Link class="link" url={thread?.url ?? ''} label={`Started from ${thread?.creator}`} />
      </div>
      <div class={$viewState === 'details' ? 'show-full-messages' : 'messages-preview'}>
        {#each thread?.messages.slice() || [] as message}
          <div class="message-author">
            {message.author} — {formatRelativeDate(message.date_sent)}
          </div>
          <div class="message-text">{message.content_plain}</div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .messages-preview {
    padding: 1em 0;
    max-height: 16em;
    overflow: hidden;
    transition: max-height 0.5s ease;
    -webkit-mask-image: linear-gradient(to bottom, #000 90%, transparent 100%);
  }

  .show-full-messages {
    padding: 1em 0;
    max-height: none;
  }

  .toggle-messages {
    /* Add more styling as needed */
  }

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
  }

  .details {
    display: flex;
    flex-direction: column;
    gap: 0.25em;
    width: 100%;
    flex-shrink: 1;
    flex-grow: 1;
    .message-author {
      opacity: 0.6;
    }

    .message-text {
      font-size: 1.25em;
      line-height: 1.775em;
      letter-spacing: 0.01em;
      color: #281b53;
      font-weight: 500;
      flex-shrink: 0;
      margin-bottom: 1em;
    }
  }

  .slack {
    .favicon {
      box-shadow: none;
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
  }
  .thread-metadata {
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
