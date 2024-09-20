<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  import { HistoryEntriesManager } from '@horizon/core/src/lib/service/history'
  import WebviewWrapper, { type WebviewWrapperEvents } from '../Webview/WebviewWrapper.svelte'
  import {
    Resource,
    ResourceAnnotation,
    ResourceTag,
    useResourceManager
  } from '../../service/resources'
  import {
    CreateAnnotationEventTrigger,
    CreateTabEventTrigger,
    DeleteAnnotationEventTrigger,
    ResourceTagsBuiltInKeys,
    WebViewEventReceiveNames,
    WebViewEventSendNames,
    type AnnotationCommentData,
    type DetectedWebApp,
    type ResourceDataAnnotation,
    type WebViewEventAnnotation,
    type WebViewSendEvents
  } from '@horizon/types'
  import {
    useLogScope,
    isModKeyAndKeyPressed,
    useDebounce,
    wait,
    copyToClipboard,
    parseStringIntoUrl,
    getFileKind,
    tooltip
  } from '@horizon/utils'
  import { Icon, IconConfirmation } from '@horizon/icons'
  import OasisResourceDetails from './OasisResourceDetails.svelte'
  import ResourceOverlay from '../Core/ResourceOverlay.svelte'

  import AnnotationItem from './AnnotationItem.svelte'
  import { useToasts } from '../../service/toast'
  import { handleInlineAI } from '../../service/ai'
  import type { BrowserTabNewTabEvent } from '../Browser/BrowserTab.svelte'
  import { useTabsManager } from '../../service/tabs'
  import Image from '../Atoms/Image.svelte'
  import { derived, writable } from 'svelte/store'
  import FilePreview from '../Resources/Previews/File/FilePreview.svelte'
  import FileIcon from '../Resources/Previews/File/FileIcon.svelte'

  export let resource: Resource
  export let active: boolean = true

  let webview: WebviewWrapper
  let activeAnnotation = ''
  let copyConfirmation: IconConfirmation

  const dispatch = createEventDispatcher<{
    close: void
  }>()
  const log = useLogScope('OasisResourceModal')
  const resourceManager = useResourceManager()
  const tabsManager = useTabsManager()
  const historyEntriesManager = new HistoryEntriesManager()
  const toast = useToasts()

  const canonicalUrl = resource?.tags?.find(
    (tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL
  )?.value
  const initialSrc = parseStringIntoUrl(canonicalUrl || resource?.metadata?.sourceURI || '')

  const url = writable(initialSrc?.href ?? '')

  const hostname = derived(url, (url) => {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname
    } catch (err) {
      return url
    }
  })

  function close() {
    dispatch('close')
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!active) {
      return
    }

    if (event.key === 'Escape') {
      close()
    } else if (isModKeyAndKeyPressed(event, 'Enter')) {
      tabsManager.openResourceAsTab(resource, {
        active: event.shiftKey,
        trigger: CreateTabEventTrigger.OasisItem
      })
    }
  }

  let loadingAnnotations = false
  let annotations: ResourceAnnotation[] = resource.annotations ?? []
  let title = resource?.metadata?.name ?? canonicalUrl ?? 'Untitled'
  let favicon = ''

  const loadAnnotations = async (resourceId: string) => {
    try {
      log.debug('Loading annotations', resourceId)

      loadingAnnotations = true
      const fetchedAnnotations = await resourceManager.getAnnotationsForResource(resourceId)
      annotations = [
        ...new Set([
          ...annotations,
          ...fetchedAnnotations.filter((a) => !annotations.find((b) => a.id === b.id))
        ])
      ]

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

  const debouncedAppDetection = useDebounce(async () => {
    await wait(500)
    log.debug('running app detection debounced')
    webview.startAppDetection()
  }, 500)

  const handleAppDetection = async (detectedApp: DetectedWebApp) => {
    try {
      log.debug('App detected', detectedApp)

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

  const handleWebviewAnnotation = async (
    annotationData: WebViewSendEvents[WebViewEventSendNames.Annotate]
  ) => {
    if (!resource) return

    log.debug('webview annotation', annotationData)

    const url = annotationData.data.url ?? initialSrc

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
    resourceManager.addAnnotationToLoadedResource(resource.id, annotationResource)
    resource.annotations = [...(resource.annotations ?? []), annotationResource]

    // remove resource silent tag
    const isSilent = (resource.tags ?? []).find(
      (tag) => tag.name === ResourceTagsBuiltInKeys.SILENT
    )
    if (isSilent) {
      log.debug('removing silent tag from resource', resource.id)
      await resourceManager.deleteResourceTag(resource.id, ResourceTagsBuiltInKeys.SILENT)
    }

    const hideInEverything = (resource.tags ?? []).find(
      (tag) => tag.name === ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING
    )
    if (hideInEverything) {
      log.debug('removing hide in everything tag from resource', resource.id)
      await resourceManager.deleteResourceTag(
        resource.id,
        ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING
      )
    }

    log.debug('highlighting text in webview')

    webview.sendEvent(WebViewEventReceiveNames.RestoreAnnotation, {
      id: annotationResource.id,
      data: annotationData
    })

    const simplifiedAnnotationType =
      (annotationData.data as AnnotationCommentData)?.content_html ||
      (annotationData.data as AnnotationCommentData)?.content_plain
        ? 'comment'
        : 'highlight'
    const annotationTrigger =
      (annotationData.data as AnnotationCommentData)?.source === 'inline_ai'
        ? CreateAnnotationEventTrigger.InlinePageAI
        : CreateAnnotationEventTrigger.PageInline
    await resourceManager.telemetry.trackCreateAnnotation(
      simplifiedAnnotationType,
      annotationTrigger
    )
  }

  const handleAnnotationRemove = async (
    annotationId: WebViewSendEvents[WebViewEventSendNames.RemoveAnnotation]
  ) => {
    log.debug('Annotation removed', annotationId)

    const annotation = annotations.find((annotation) => annotation.id === annotationId)
    if (!annotation) {
      log.error('Annotation not found', annotationId)
      toast.error('Annotation not found')
      return
    }

    const annotationData = await annotation.getParsedData()

    annotations = annotations.filter((annotation) => annotation.id !== annotationId)
    await resourceManager.deleteResource(annotationId)

    toast.success('Annotation removed!')

    webview.reload()

    const simplifiedAnnotationType =
      (annotationData.data as AnnotationCommentData)?.content_html ||
      (annotationData.data as AnnotationCommentData)?.content_plain
        ? 'comment'
        : 'highlight'
    await resourceManager.telemetry.trackDeleteAnnotation(
      simplifiedAnnotationType,
      DeleteAnnotationEventTrigger.PageSidebar
    )
  }

  const handleAnnotationUpdate = async (
    event: WebViewSendEvents[WebViewEventSendNames.UpdateAnnotation]
  ) => {
    log.debug('Annotation updated', event)

    const annotationId = event.id
    const updates = event.data

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

  const handleAnnotationClick = (
    event: WebViewSendEvents[WebViewEventSendNames.AnnotationClick]
  ) => {
    log.debug('Annotation clicked', event)

    activeAnnotation = event.id

    setTimeout(() => {
      activeAnnotation = ''
    }, 1000)
  }

  async function handleWebviewTransform(event: WebViewSendEvents[WebViewEventSendNames.Transform]) {
    log.debug('webview transformation', event)

    const detectedResource = await webview.detectResource()
    log.debug('extracted resource data', detectedResource)
    if (!detectedResource) {
      log.debug('no resource detected')
      return
    }

    const transformation = await handleInlineAI(event, detectedResource)

    log.debug('transformation output', transformation)

    webview.sendEvent(WebViewEventReceiveNames.TransformationOutput, {
      text: transformation
    })
  }

  const handleNavigate = (e: CustomEvent<string>) => {
    webview.navigate(e.detail)
  }

  const handleWebviewPageEvent = (e: CustomEvent<WebviewWrapperEvents['webview-page-event']>) => {
    const { type, data } = e.detail

    if (type === WebViewEventSendNames.DetectedApp) {
      handleAppDetection(data as DetectedWebApp)
    } else if (type === WebViewEventSendNames.Annotate) {
      handleWebviewAnnotation(data as WebViewSendEvents[WebViewEventSendNames.Annotate])
    } else if (type === WebViewEventSendNames.AnnotationClick) {
      handleAnnotationClick(data as WebViewSendEvents[WebViewEventSendNames.AnnotationClick])
    } else if (type === WebViewEventSendNames.RemoveAnnotation) {
      handleAnnotationRemove(data as WebViewSendEvents[WebViewEventSendNames.RemoveAnnotation])
    } else if (type === WebViewEventSendNames.UpdateAnnotation) {
      handleAnnotationUpdate(data as WebViewSendEvents[WebViewEventSendNames.UpdateAnnotation])
    } else if (type === WebViewEventSendNames.Transform) {
      handleWebviewTransform(data as WebViewSendEvents[WebViewEventSendNames.Transform])
    }
  }

  const handleUrlChange = (e: CustomEvent<WebviewWrapperEvents['url-change']>) => {
    log.debug('url change', e.detail)
    debouncedAppDetection()
  }

  const handleWebviewTitleChange = (e: CustomEvent<string>) => {
    log.debug('title change', e.detail)
    title = e.detail
  }

  const handleWebviewFaviconChange = (e: CustomEvent<string>) => {
    log.debug('favicon change', e.detail)
    favicon = e.detail
  }

  const handleNewTab = () => {
    tabsManager.openResourceAsTab(resource, {
      active: true,
      trigger: CreateTabEventTrigger.OasisItem
    })
    close()
  }

  const handleCopy = () => {
    copyToClipboard($url)
    copyConfirmation.showConfirmation()
  }

  const handleDownload = () => {
    // TODO
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

<svelte:window on:keydown={handleKeydown} />

<div class="mini-browser-wrapper">
  <div class="close-hitarea" on:click={close} aria-hidden="true">
    <span class="label">Click or ESC to close</span>
  </div>
  <div id="mini-browser" class="mini-browser w-[90vw] mx-auto">
    <div class="header">
      <div class="info">
        <div class="left-side">
          <div class="icon-wrapper">
            {#if initialSrc}
              {#key favicon}
                <Image src={favicon} alt={title} fallbackIcon="world" />
              {/key}
            {:else}
              <FileIcon kind={getFileKind(resource.type)} width="100%" height="100%" />
            {/if}
          </div>

          <div class="title truncate max-w-[600px]">
            {title}
          </div>
        </div>

        <div class="host">
          {$hostname}
        </div>
      </div>

      <div class="flex items-center gap-4">
        <button
          use:tooltip={{ text: 'Open in new tab' }}
          on:click={handleNewTab}
          class="flex items-center justify-center appearance-none border-none p-1 -m-1 h-min-content bg-none transition-colors text-sky-800 hover:text-sky-950 hover:bg-sky-200/80 rounded-lg cursor-pointer"
        >
          <Icon name="arrow.diagonal" />
        </button>

        {#if initialSrc}
          <button
            use:tooltip={{ text: 'Copy URL' }}
            on:click={handleCopy}
            class="flex items-center justify-center appearance-none border-none p-1 -m-1 h-min-content bg-none transition-colors text-sky-800 hover:text-sky-950 hover:bg-sky-200/80 rounded-lg cursor-pointer"
          >
            <IconConfirmation bind:this={copyConfirmation} name="copy" />
          </button>
          <!-- {:else}
        <button on:click={handleDownload} class="flex items-center justify-center appearance-none border-none p-1 -m-1 h-min-content bg-none transition-colors text-sky-800 hover:text-sky-950 hover:bg-sky-200/80 rounded-lg cursor-pointer">
          <IconConfirmation bind:this={copyConfirmation} name="download" />
        </button> -->
        {/if}

        <button
          use:tooltip={{ text: 'Close' }}
          on:click={close}
          class="flex items-center justify-center appearance-none border-none p-1 -m-1 h-min-content bg-none transition-colors text-sky-800 hover:text-sky-950 hover:bg-sky-200/80 rounded-lg cursor-pointer"
        >
          <Icon name="close" />
        </button>
      </div>
    </div>

    <div class="mini-webview-wrapper">
      {#if initialSrc}
        <WebviewWrapper
          id="mini-browser-webview"
          src={initialSrc.href}
          partition="persist:horizon"
          {url}
          {historyEntriesManager}
          bind:this={webview}
          on:webview-page-event={handleWebviewPageEvent}
          on:url-change={handleUrlChange}
          on:title-change={handleWebviewTitleChange}
          on:favicon-change={handleWebviewFaviconChange}
          on:did-finish-load={debouncedAppDetection}
          on:navigation
        />
      {:else}
        <FilePreview {resource} preview={false} />
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
    height: 2rem;
    background: linear-gradient(to bottom, #34393d, transparent);

    .label {
      transition: 240ms ease-out;
      color: #d4dce0;
      user-select: none;
      opacity: 0;
    }

    &:hover {
      .label {
        opacity: 1;
        padding-top: 2.5rem;
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
    flex-direction: column;
    height: calc(100% - 3rem);
    width: 100%;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    transition: 240ms ease-out;
    padding: 0 3rem 3rem 3rem;
    margin-top: 3rem;

    z-index: 100000;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    background: white;
    border-radius: 12px;
    border-bottom-right-radius: 0;
    border-bottom-left-radius: 0;
    border-bottom: 1px solid #e0e0e0;

    .info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .left-side {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .title {
      font-size: 1rem;
      font-weight: 500;
      opacity: 0.75;
      transition: opacity 0.2s ease;

      &:hover {
        opacity: 1;
      }
    }

    .host {
      font-size: 1rem;
      opacity: 0.5;
      transition: opacity 0.2s ease;

      &:hover {
        opacity: 0.75;
      }
    }
  }

  .icon-wrapper {
    width: 16px;
    height: 16px;
    display: block;
    user-select: none;
    flex-shrink: 0;
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
  }

  .mini-webview-wrapper {
    height: 100%;
    width: 100%;
    border-radius: 12px;
    border-top-right-radius: 0;
    border-top-left-radius: 0;
    overflow: hidden;
    background: black;
  }
</style>
