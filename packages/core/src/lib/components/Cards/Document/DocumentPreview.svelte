<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'

  import { useLogScope } from '../../../utils/log'
  import type { ResourceDocument } from '../../../service/resources'
  import type { ResourceDataDocument } from '../../../types'
  import type { ResourcePreviewEvents } from '../../Resources/events'

  import RenderedDocument from './RenderedDocument.svelte'

  export let resource: ResourceDocument
  export let type: string

  const log = useLogScope('DocumentPreview')
  const dispatch = createEventDispatcher<ResourcePreviewEvents<ResourceDataDocument>>()

  let document: ResourceDataDocument | null = null
  let title = ''
  let error = ''
  let isNotion = false
  let isGoogleDocs = false

  const MAX_TITLE_LENGTH = 300

  const truncate = (text: string, length: number) => {
    return text.length > length ? text.slice(0, length) + '...' : text
  }

  onMount(async () => {
    try {
      document = await resource.getParsedData(true)
      dispatch('data', document)

      const url = new URL(document?.url)

      const hostname = url.hostname.split('.').slice(-2, -1).join('')
      title = truncate(
        document.title || hostname[0].toUpperCase() + hostname.slice(1),
        MAX_TITLE_LENGTH
      )

      isNotion = type === 'application/vnd.space.document.notion'
      isGoogleDocs = type === 'application/vnd.space.document.googleDocs'

      dispatch('load')
    } catch (e) {
      log.error(e)
      error = 'Invalid URL'
    }
  })

  onDestroy(() => {
    log.debug('Releasing data')
    // resource.releaseData()
  })
</script>

<div class="link-card">
  <!-- <a href={document?.url} target="_blank" class="link-card"> -->
  <div class="details" class:notion={isNotion} class:googleDocs={isGoogleDocs}>
    {#if error}
      <div class="title">{error}</div>
      <div class="subtitle">{document?.url}</div>
    {:else}
      <div class="metadata-container">
        <img
          class="favicon"
          src={`https://www.google.com/s2/favicons?domain=${document?.url}&sz=48`}
          alt={`${document?.url} favicon`}
        />

        <div class="document-metadata">
          {#if isNotion}<div class="from">Notion</div>{/if}
          {#if isGoogleDocs}<div class="from">Google Docs</div>{/if}
        </div>
      </div>

      <div class="title">{title}</div>

      {#if isNotion}
        <RenderedDocument html={document.content_html} />
      {/if}
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

  .metadata-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .googleDocs {
    .title,
    .document-metadata > .from {
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
    margin-bottom: -2rem;
    max-width: 95%;
  }
  .document-metadata {
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
