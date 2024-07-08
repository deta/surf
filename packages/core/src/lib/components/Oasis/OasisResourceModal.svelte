<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  import { HistoryEntriesManager } from '@horizon/core/src/lib/service/history'
  import WebviewWrapper, { type WebViewWrapperEvents } from '../Cards/Browser/WebviewWrapper.svelte'
  import {
    Resource,
    ResourceAnnotation,
    ResourceTag,
    useResourceManager
  } from '../../service/resources'
  import {
    ResourceTagsBuiltInKeys,
    WebViewEventReceiveNames,
    type AnnotationCommentData,
    type AnnotationRangeData,
    type DetectedWebApp,
    type ResourceDataAnnotation,
    type WebViewEventAnnotation
  } from '@horizon/types'
  import { useLogScope } from '../../utils/log'
  import { Icon } from '@horizon/icons'
  import { wait } from '@horizon/web-parser/src/utils'
  import OasisResourceDetails from './OasisResourceDetails.svelte'
  import ResourcePreviewClean from '../Resources/ResourcePreviewClean.svelte'
  import ResourceOverlay from '@horizon/drawer/src/lib/components/ResourceOverlay.svelte'

  import AnnotationItem from './AnnotationItem.svelte'
  import { useToasts } from '../../service/toast'
  import { WebParser } from '@horizon/web-parser'
  import { getPrompt, PromptIDs } from '../../service/prompts'
  import { handleInlineAI } from '../../service/ai'

  export let resource: Resource

  let webview: WebviewWrapper
  let activeAnnotation = ''

  const dispatch = createEventDispatcher<{
    close: void
    'new-tab': { url: string; active: boolean }
  }>()
  const log = useLogScope('OasisResourceModal')
  const resourceManager = useResourceManager()
  const historyEntriesManager = new HistoryEntriesManager()

  const toast = useToasts()

  $: src = resource?.metadata?.sourceURI || 'https://example.com'

  function close() {
    dispatch('close')
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      close()
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown)
  })

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown)
  })

  let loadingAnnotations = true
  let annotations: ResourceAnnotation[] = []

  const loadAnnotations = async (resourceId: string) => {
    try {
      log.debug('Loading annotations', resourceId)

      loadingAnnotations = true
      annotations = await resourceManager.getAnnotationsForResource(resourceId)

      log.debug('Annotations', annotations)

      await wait(500)

      annotations.forEach(async (annotation) => {
        log.debug('Restoring highlight', annotation)

        const data = await annotation.getParsedData()
        log.debug('Annotation data', data)

        webview.sendEvent(WebViewEventReceiveNames.RestoreAnnotation, {
          id: annotation.id,
          data: data
        })
      })
    } catch (e) {
      log.error(e)
    } finally {
      loadingAnnotations = false
    }
  }

  const handleAppDetection = async (e: CustomEvent<DetectedWebApp>) => {
    try {
      log.debug('App detected', e.detail)

      if (!resource) return

      loadAnnotations(resource.id)
    } catch (e) {
      log.error(e)
    }
  }

  const handleAnnotationSelect = (e: CustomEvent<WebViewEventAnnotation>) => {
    log.debug('Annotation selected', e.detail)
    webview.sendEvent(WebViewEventReceiveNames.ScrollToAnnotation, e.detail)
  }

  const handleAnnotationDelete = async (e: CustomEvent<string>) => {
    log.debug('Annotation delete', e.detail)

    const confirmed = window.confirm('Are you sure you want to delete the annotation?')
    if (!confirmed) return

    log.debug('Deleting annotation', e.detail)
    await resourceManager.deleteResource(e.detail)

    toast.success('Annotation deleted!')

    webview.reload()
  }

  const handleWebViewAnnotation = async (e: CustomEvent<WebViewWrapperEvents['annotate']>) => {
    if (!resource) return

    const annotationData = e.detail
    log.debug('webview highlight', annotationData)

    const url = annotationData.data.url ?? src

    const hashtags = (annotationData.data as AnnotationCommentData)?.tags ?? []
    if (hashtags.length > 0) {
      log.debug('hashtags', hashtags)
    }

    const annotationResource = await resourceManager.createResourceAnnotation(
      annotationData,
      { sourceURI: url },
      [
        // link the annotation to the page using its canonical URL so we can later find it
        ResourceTag.canonicalURL(url),

        // link the annotation to the bookmarked resource
        ResourceTag.annotates(resource.id),

        // link the annotation to the hashtags,
        ...hashtags.map((tag) => ResourceTag.hashtag(tag))
      ]
    )

    log.debug('created annotation resource', annotationResource)
    annotations = [...annotations, annotationResource]

    log.debug('highlighting text in webview')

    webview.sendEvent(WebViewEventReceiveNames.RestoreAnnotation, {
      id: annotationResource.id,
      data: annotationData
    })
  }

  const handleAnnotationRemove = async (
    e: CustomEvent<WebViewWrapperEvents['annotationRemove']>
  ) => {
    log.debug('Annotation removed', e.detail)

    const annotationId = e.detail
    annotations = annotations.filter((annotation) => annotation.id !== annotationId)

    await resourceManager.deleteResource(annotationId)

    toast.success('Annotation removed!')

    webview.reload()
  }

  const handleAnnotationUpdate = async (
    e: CustomEvent<WebViewWrapperEvents['annotationUpdate']>
  ) => {
    log.debug('Annotation updated', e.detail)

    const annotationId = e.detail.id
    const updates = e.detail.data

    const annotationResource = annotations.find((annotation) => annotation.id === annotationId)
    if (!annotationResource) {
      log.error('Annotation not found', annotationId)
      return
    }

    const annotationData = await annotationResource.getParsedData()

    if (annotationData.type !== 'comment') {
      return
    }

    const newData = {
      ...annotationData,
      data: {
        ...annotationData.data,
        ...updates
      }
    } as ResourceDataAnnotation

    log.debug('Updating annotation', annotationId, newData)

    await annotationResource.updateParsedData(newData)

    // TODO update tags in backend!

    toast.success('Annotation updated!')
  }

  const handleAnnotationClick = (e: CustomEvent<WebViewWrapperEvents['annotationClick']>) => {
    log.debug('Annotation clicked', e.detail)

    activeAnnotation = e.detail.id

    setTimeout(() => {
      activeAnnotation = ''
    }, 1000)
  }

  async function handleWebviewTransform(e: CustomEvent<WebViewWrapperEvents['transform']>) {
    log.debug('webview transformation', e.detail)

    const detectedResource = await webview.detectResource()
    log.debug('extracted resource data', detectedResource)
    if (!detectedResource) {
      log.debug('no resource detected')
      return
    }

    const transformation = await handleInlineAI(e.detail, detectedResource)

    log.debug('transformation output', transformation)

    webview.sendEvent(WebViewEventReceiveNames.TransformationOutput, {
      text: transformation
    })
  }

  const handleNewTab = (e: CustomEvent<{ url: string; active: boolean }>) => {
    dispatch('close')
    dispatch('new-tab', e.detail)
  }

  onMount(async () => {
    log.debug('Resource modal mounted', resource)

    if (resource) {
      const viewedByUserTag = (resource.tags ?? []).find(
        (tag) => tag.name === ResourceTagsBuiltInKeys.VIEWED_BY_USER
      )
      const viewedByUser = viewedByUserTag?.value === 'true'

      if (!viewedByUser) {
        log.debug('Marking resource as viewed', resource.id)

        if (!viewedByUserTag) {
          resource.tags = [
            ...(resource.tags ?? []),
            { name: ResourceTagsBuiltInKeys.VIEWED_BY_USER, value: 'true' }
          ]
          await resourceManager.createResourceTag(
            resource.id,
            ResourceTagsBuiltInKeys.VIEWED_BY_USER,
            'true'
          )
        } else {
          await resourceManager.updateResourceTag(
            resource.id,
            ResourceTagsBuiltInKeys.VIEWED_BY_USER,
            'true'
          )
        }
      }
    }
  })
</script>

<div class="mini-browser-wrapper">
  <div class="close-hitarea" on:click={close} aria-hidden="true">
    <span class="label">Click or ESC to close</span>
  </div>
  <div id="mini-browser" class="mini-browser">
    <div class="resource-details">
      <OasisResourceDetails {resource} on:new-tab={handleNewTab}>
        <ResourceOverlay caption="Click to open in new tab">
          <ResourcePreviewClean slot="content" {resource} />
        </ResourceOverlay>
      </OasisResourceDetails>
    </div>

    <!-- <BrowserTab
      {tab}
      {historyEntriesManager}
      bind:this={webview}
      on:appDetection={handleAppDetection}
      on:highlight={handleWebViewHighlight}
      on:annotationClick={handleAnnotationClick}
    /> -->

    <WebviewWrapper
      bind:this={webview}
      {src}
      partition="persist:horizon"
      {historyEntriesManager}
      on:detectedApp={handleAppDetection}
      on:annotate={handleWebViewAnnotation}
      on:annotationClick={handleAnnotationClick}
      on:annotationRemove={handleAnnotationRemove}
      on:annotationUpdate={handleAnnotationUpdate}
      on:transform={handleWebviewTransform}
    />

    <div class="annotations-view">
      {#if annotations.length > 0}
        <div class="annotations">
          {#each annotations as annotation (annotation.id)}
            <AnnotationItem
              resource={annotation}
              active={annotation.id === activeAnnotation}
              background={false}
              on:scrollTo={handleAnnotationSelect}
              on:delete={handleAnnotationDelete}
            />
          {/each}
        </div>
      {:else if loadingAnnotations}
        <div class="loading">
          <Icon name="spinner" />
          <p>Loading annotations…</p>
        </div>
      {:else}
        <div class="empty-annotations">
          <div class="empty-title">
            <Icon name="marker" />
            <h1>Nothing Annotated</h1>
          </div>
          <p>Select any text on the page and click the marker icon to highlight it.</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style lang="scss">
  .close-hitarea {
    position: absolute;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 5rem;
    background: linear-gradient(to bottom, #34393d, transparent);

    .label {
      transition: 240ms ease-out;
      color: #b8c7d0;
      user-select: none;
      opacity: 0;
    }

    &:hover {
      .label {
        opacity: 1;
      }
    }

    &:hover ~ .mini-browser {
      transform: translateY(2.75rem) scale(0.98);
      backdrop-filter: blur(4px);
      .label {
        opacity: 1;
      }
    }
  }

  .mini-browser {
    position: relative;
    display: flex;
    gap: 2rem;
    width: 80vw;
    height: calc(100vh - 2rem);
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    transition: 240ms ease-out;
    padding: 0 2rem 2rem 2rem;
    margin-top: 2rem;

    z-index: 100000;
  }

  .resource-details {
    position: relative;
    width: 40rem;
    border-radius: 12px;
    overflow: hidden;
    background: white;
  }

  .annotations-view {
    position: relative;
    width: 40rem;
    height: 100%;
    border-radius: 12px;
    background: white;
    padding: 1rem;
  }

  .annotations {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    overflow: auto;
    height: 100%;
  }

  .loading {
    margin: auto;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
  }

  .empty-annotations {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    opacity: 0.5;
    transition: opacity 0.2s ease;

    &:hover {
      opacity: 1;
    }

    p {
      font-size: 1rem;
      color: #666;
      text-align: center;
    }
  }

  .empty-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    h1 {
      font-size: 1.25rem;
      font-weight: 500;
    }
  }

  .mini-browser-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.4);
    z-index: 10000000;
    border-radius: 12px;
  }
</style>
