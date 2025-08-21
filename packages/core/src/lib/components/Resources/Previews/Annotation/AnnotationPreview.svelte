<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'

  import { useLogScope } from '@deta/utils/io'
  import type { ResourceAnnotation } from '../../../../service/resources'
  import type {
    AnnotationCommentData,
    AnnotationRangeData,
    ResourceDataAnnotation
  } from '../../../../types'
  import type { ResourcePreviewEvents } from '../../../Resources/events'

  export let resource: ResourceAnnotation

  const log = useLogScope('AnnotationPreview')
  const dispatch = createEventDispatcher<ResourcePreviewEvents<ResourceDataAnnotation>>()

  let annotation: ResourceDataAnnotation | null = null
  let content = ''
  let anchorText = ''
  let error = ''
  let url: URL

  onMount(async () => {
    try {
      annotation = await resource.getParsedData()
      dispatch('data', annotation)

      if (annotation.type === 'highlight') {
        content = (annotation.anchor?.data as AnnotationRangeData).content_plain || ''
      } else if (annotation.type === 'comment') {
        content = (annotation.data as AnnotationCommentData).content_plain || ''
        anchorText = (annotation.anchor?.data as AnnotationRangeData).content_plain || ''
      }

      url = new URL(resource.metadata?.sourceURI || '')

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
  <div class="details">
    {#if error}
      <div class="title">{error}</div>
    {:else if annotation}
      <!-- <img
          class="favicon"
          src={`https://www.google.com/s2/favicons?domain=${document?.site_icon}&sz=48`}
          alt={`${document?.site_name} favicon`}
        /> -->
      {#if url}
        <img
          class="favicon"
          src={`https://www.google.com/s2/favicons?domain=${url.href}&sz=48`}
          alt={`${url.href} favicon`}
        />
      {/if}
      {#if anchorText}
        <div class="anchor">{anchorText}</div>
      {/if}
      <div class="title">{content}</div>
      <div class="document-metadata">
        <div class="from">
          {annotation.type === 'comment' ? 'Comment on' : 'Highlight on'}
          {url.hostname}
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
  .document-metadata {
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

  .anchor {
    display: -webkit-box;
    -webkit-line-clamp: 15;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: 1em;
    color: #281b53;
    opacity: 0.65;
    margin-top: 1em;
    border-left: 2px solid #8076a1;
    padding-left: 0.75em;
  }
</style>
