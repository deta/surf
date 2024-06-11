<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from 'svelte'
  
    import { useLogScope } from '../../../utils/log'
    import type { ResourceAnnotation } from '../../../service/resources'
    import type { AnnotationRangeData, ResourceDataAnnotation } from '../../../types'
    import type { ResourcePreviewEvents } from '../../Resources/events'
  
    export let resource: ResourceAnnotation
    export let type: string
  
    const log = useLogScope('DocumentPreview')
    const dispatch = createEventDispatcher<ResourcePreviewEvents<ResourceDataAnnotation>>()
  
    let annotation: ResourceDataAnnotation | null = null
    let content = ''
    let error = ''
    let url: URL
    
    onMount(async () => {
      try {
        annotation = await resource.getParsedData()
        dispatch('data', annotation)

        if (annotation.type === 'highlight') {
            content = (annotation.anchor.data as AnnotationRangeData).content_plain || ''
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
          src={`https://www.google.com/s2/favicons?domain=${document?.site_icon}&sz=256`}
          alt={`${document?.site_name} favicon`}
        /> -->
       {#if url}
            <img
                class="favicon"
                src={`https://www.google.com/s2/favicons?domain=${url.href}&sz=256`}
                alt={`${url.href} favicon`}
            />
       {/if}
        <div class="title">{content}</div>
        <div class="document-metadata">
            <div class="from">{url.hostname}</div>
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
  