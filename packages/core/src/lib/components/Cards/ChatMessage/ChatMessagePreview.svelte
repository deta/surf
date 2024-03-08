<script lang="ts">
  import { onDestroy, onMount } from 'svelte'

  import { useLogScope } from '../../../utils/log'
  import type { ResourceMessage } from '../../../service/resources'
  import type { ResourceDataMessage } from '../../../types'
  import Link from '../../Atoms/Link.svelte'

  export let resource: ResourceMessage
  export let type: string

  const log = useLogScope('MessagePreview')

  let message: ResourceDataMessage | null = null
  let chatMessage = ''
  let subtitle = ''
  let error = ''
  let isSlack = false

  const MAX_TITLE_LENGTH = 300
  const MAX_SUBTITLE_LENGTH = 100

  const truncate = (text: string, length: number) => {
    return text.length > length ? text.slice(0, length) + '...' : text
  }

  onMount(async () => {
    try {
      message = await resource.getParsedData()

      console.log('messagedata', message)

      const url = new URL(message.url)

      const hostname = url.hostname.split('.').slice(-2, -1).join('')
      chatMessage = truncate(message.content_plain, MAX_TITLE_LENGTH)
      // subtitle = truncate(
      //   message.excerpt || message.content_plain || `${url.hostname}${url.pathname}`,
      //   MAX_SUBTITLE_LENGTH
      // )

      isSlack = type === 'application/vnd.space.chat-message.slack'
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
  <div class="details" class:slack={isSlack}>
    {#if error}
      <div class="title">{error}</div>
      <div class="subtitle">{message?.url}</div>
    {:else}
      <!-- <img
        class="favicon"
        src={`https://www.google.com/s2/favicons?domain=${message?.site_icon}&sz=256`}
        alt={`${message?.site_name} favicon`}
      /> -->
      <img class="favicon" src={message?.platform_icon} alt={`${message?.platform_name} favicon`} />
      <div class="title">{chatMessage}</div>
      <div class="message-metadata">
        <Link class="link" url={message?.author_url} label={`From ${message?.author}`} />
        <div class="from">Slack Message</div>
      </div>
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
  .message-metadata {
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
