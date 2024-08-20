<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'

  import { useLogScope } from '../../../../utils/log'
  import type { ResourceChatMessage } from '../../../../service/resources'
  import type { ResourceDataChatMessage } from '../../../../types'
  import Link from '../../../Atoms/Link.svelte'
  import LoadingBox from '../../../Atoms/LoadingBox.svelte'
  import type { ResourcePreviewEvents } from '../../../Resources/events'

  export let resource: ResourceChatMessage
  export let type: string

  const log = useLogScope('MessagePreview')
  const dispatch = createEventDispatcher<ResourcePreviewEvents<ResourceDataChatMessage>>()

  let message: ResourceDataChatMessage | null = null
  let chatMessage = ''
  let error = ''
  let isSlack = false
  let loading = true

  const MAX_TITLE_LENGTH = 300

  const truncate = (text: string, length: number) => {
    return text.length > length ? text.slice(0, length) + '...' : text
  }

  onMount(async () => {
    try {
      loading = true
      message = await resource.getParsedData()
      dispatch('data', message)

      chatMessage = truncate(message.content_plain, MAX_TITLE_LENGTH)
      isSlack = type === 'application/vnd.space.chat-message.slack'

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

<!-- <a href={message?.url} target="_blank" class="link-card"></a> -->
<div class="link-card">
  <div class="details" class:slack={isSlack}>
    {#if error}
      <div class="title">{error}</div>
      <div class="subtitle">{message?.url}</div>
    {:else if loading}
      <LoadingBox />
    {:else}
      <!-- <img
        class="favicon"
        src={`https://www.google.com/s2/favicons?domain=${message?.site_icon}&sz=48`}
        alt={`${message?.site_name} favicon`}
      /> -->
      <img class="favicon" src={message?.platform_icon} alt={`${message?.platform_name} favicon`} />
      <div class="title">{chatMessage}</div>
      <div class="message-metadata">
        <Link class="link" url={message?.author_url ?? ''} label={`From ${message?.author}`} />
        <div class="from">Slack Message</div>
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
    width: 100%;
    flex-shrink: 1;
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
