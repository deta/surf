<script lang="ts" context="module">
  export type BrowserTabNewTabEvent = {
    url: string
    active: boolean
    trigger?: CreateTabEventTrigger
  }

  export type BrowserTabEvents = {
    // components own events
    'new-tab': BrowserTabNewTabEvent
    navigation: WebviewNavigationEvent
    keydown: WebViewEventKeyDown
    'update-tab': Partial<TabPage>
    'open-resource': string
    'reload-annotations': boolean
    'update-page-magic': PageMagic

    // forwarded webview events
    'app-detection': DetectedWebApp
    bookmark: WebViewSendEvents[WebViewEventSendNames.Bookmark]
    transform: WebViewSendEvents[WebViewEventSendNames.Transform]
    'inline-text-replace': WebViewSendEvents[WebViewEventSendNames.InlineTextReplace]
    annotate: WebViewSendEvents[WebViewEventSendNames.Annotate]
    'annotation-click': WebViewSendEvents[WebViewEventSendNames.AnnotationClick]
    'annotation-remove': WebViewSendEvents[WebViewEventSendNames.RemoveAnnotation]
    'annotation-update': WebViewSendEvents[WebViewEventSendNames.UpdateAnnotation]
    'add-to-chat': WebViewSendEvents[WebViewEventSendNames.AddToChat]
  }
</script>

<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { writable } from 'svelte/store'
  import type { HistoryEntriesManager } from '../../service/history'
  import type { PageMagic, TabPage } from '../../types/browser.types'
  import { useLogScope, useDebounce, isGoogleSignInUrl, wait, generateID } from '@horizon/utils'
  import type { DetectedWebApp } from '@horizon/web-parser'
  import {
    CreateAnnotationEventTrigger,
    CreateTabEventTrigger,
    DeleteAnnotationEventTrigger,
    ResourceTagsBuiltInKeys,
    ResourceTypes,
    WebViewEventReceiveNames,
    WebViewEventSendNames,
    type AnnotationCommentData,
    type ResourceDataAnnotation,
    type ResourceDataLink,
    type WebViewEventKeyDown,
    type WebViewReceiveEvents,
    type WebViewSendEvents
  } from '@horizon/types'
  import WebviewWrapper, { type WebviewWrapperEvents } from '../Webview/WebviewWrapper.svelte'
  import type { WebviewNavigationEvent } from '../Webview/Webview.svelte'
  import { ResourceAnnotation, ResourceTag, useResourceManager } from '../../service/resources'
  import { useToasts } from '../../service/toast'
  import { inlineTextReplaceCode, inlineTextReplaceStylingCode } from '../../constants/inline'
  import { handleInlineAI } from '../../service/ai'
  import { useConfig } from '../../service/config'

  const log = useLogScope('BrowserTab')
  const dispatch = createEventDispatcher<BrowserTabEvents>()
  const resourceManager = useResourceManager()
  const toasts = useToasts()
  const config = useConfig()

  const userConfigSettings = config.settings

  export let tab: TabPage
  export let historyEntriesManager: HistoryEntriesManager
  export let webview: WebviewWrapper
  export let pageMagic: PageMagic | undefined = undefined

  export const goBack = () => webview.goBack()
  export const goForward = () => webview.goForward()
  export const focus = () => webview.focus()
  export const reload = () => webview.reload()
  export const forceReload = () => webview.forceReload()
  export const navigate = (url: string) => webview.navigate(url)
  export const openDevTools = () => webview.openDevTools()
  export const detectResource = (timeoutNum?: number) => webview.detectResource(timeoutNum)
  export const executeJavaScript = (code: string, userGesture?: boolean) =>
    webview.executeJavaScript(code, userGesture)
  export const zoomIn = () => webview.zoomIn()
  export const zoomOut = () => webview.zoomOut()
  export const resetZoom = () => webview.resetZoom()
  export const sendWebviewEvent = <T extends keyof WebViewReceiveEvents>(
    name: T,
    data?: WebViewReceiveEvents[T]
  ): void => webview.sendEvent(name, data)
  export const canGoBack = webview?.canGoBack
  export const canGoForward = webview?.canGoForward

  let initialSrc =
    tab.currentLocation ??
    historyEntriesManager.getEntry(tab.historyStackIds[tab.currentHistoryIndex])?.url ??
    tab.initialLocation ??
    'about:blank'
  let app: DetectedWebApp | null = null

  const url = writable<string>(initialSrc)
  const historyStackIds = writable<string[]>(tab.historyStackIds)
  const currentHistoryIndex = writable(tab.currentHistoryIndex)
  const appDetectionRunning = writable(false)

  const appDetectionCallbacks = new Map<string, (app: DetectedWebApp) => void>()

  $: autoSaveResources = $userConfigSettings.auto_save_resources

  const debouncedAppDetection = useDebounce(async () => {
    await wait(500)
    log.debug('running app detection debounced')
    webview?.startAppDetection()
  }, 500)

  const debouncedTabUpdate = useDebounce(() => {
    // log.debug('running tab persist debounced', tab)
    dispatch('update-tab', tab)
  }, 500)

  const handleUrlChange = async (e: CustomEvent<string>) => {
    // await wait(500)
    // log.debug('running app detection on', e.detail)

    tab = {
      ...tab,
      currentLocation: e.detail
    }

    debouncedTabUpdate()
    debouncedAppDetection()

    let url = e.detail
    if (isGoogleSignInUrl(url ?? '')) {
      const navigatedUrl = await window.api.handleGoogleSignIn(url)
      if (navigatedUrl) webview.navigate(navigatedUrl)
    }
  }

  const handleWebviewTitleChange = (e: CustomEvent<string>) => {
    // log.debug('title changed for', $url, e.detail)
    tab = {
      ...tab,
      title: e.detail
    }

    debouncedTabUpdate()
    // dispatch('update-tab', { title: e.detail })
  }

  const handleWebviewFaviconChange = (e: CustomEvent<string>) => {
    tab = {
      ...tab,
      icon: e.detail
    }

    debouncedTabUpdate()
    // dispatch('update-tab', { icon: e.detail })
  }

  const handleHistoryChange = (e: CustomEvent<{ stack: string[]; index: number }>) => {
    // log.debug('history changed for', $url, e.detail.index, e.detail.stack)

    const changes = {
      historyStackIds: e.detail.stack,
      currentHistoryIndex: e.detail.index
    }

    tab = {
      ...tab,
      ...changes
    }

    debouncedTabUpdate()
    // dispatch('update-tab', changes)
  }

  async function createBookmarkResource(url: string, tab: TabPage, silent: boolean = false) {
    log.debug('bookmarking', url)

    const detectedResource = await webview.detectResource()
    log.debug('extracted resource data', detectedResource)

    if (!detectedResource) {
      // create basic link resource
      const linkData = {
        title: tab.title ?? '',
        url: url
      } as ResourceDataLink
      const resource = await resourceManager.createResourceLink(
        linkData,
        { name: tab.title ?? '', sourceURI: url, alt: '' },
        [
          ResourceTag.canonicalURL(url),
          ResourceTag.viewedByUser(true),
          ...(silent ? [ResourceTag.silent()] : [])
        ]
      )

      log.debug('created resource', resource)

      return resource
    }

    const title = (detectedResource.data as any)?.title ?? tab.title ?? ''

    const resource = await resourceManager.createDetectedResource(
      detectedResource,
      { name: title, sourceURI: url, alt: '' },
      [
        ResourceTag.canonicalURL(url),
        ResourceTag.viewedByUser(true),
        ...(silent ? [ResourceTag.silent()] : [])
      ]
    )

    log.debug('created resource', resource)

    return resource
  }

  export async function bookmarkPage(silent = false) {
    let url =
      tab.currentLocation ??
      historyEntriesManager.getEntry(tab.historyStackIds[tab.currentHistoryIndex])?.url ??
      tab.initialLocation

    // strip &t from url suffix
    let youtubeHostnames = [
      'youtube.com',
      'youtu.be',
      'youtube.de',
      'www.youtube.com',
      'www.youtu.be',
      'www.youtube.de'
    ]
    if (youtubeHostnames.includes(new URL(url).host)) {
      url = url.replace(/&t.*/g, '')
    }

    if (tab.chatResourceBookmark) {
      const fetchedResource = await resourceManager.getResource(tab.chatResourceBookmark)
      if (fetchedResource) {
        const fetchedCanonical = (fetchedResource?.tags ?? []).find(
          (tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL
        )

        if (fetchedCanonical?.value === url) {
          log.debug('already bookmarked', url, fetchedResource.id)

          if (!silent) {
            tab.resourceBookmarkedManually = true
            await resourceManager.deleteResourceTag(
              fetchedResource.id,
              ResourceTagsBuiltInKeys.SILENT
            )
          }

          tab.resourceBookmark = fetchedResource.id
          dispatch('update-tab', {
            resourceBookmark: fetchedResource.id,
            resourceBookmarkedManually: tab.resourceBookmarkedManually
          })

          return fetchedResource
        }
      }
    }

    log.debug('bookmarking', url)
    const resource = await createBookmarkResource(url, tab, silent)

    tab.resourceBookmark = resource.id
    tab.chatResourceBookmark = resource.id

    if (!silent) {
      tab.resourceBookmarkedManually = true
    }

    dispatch('update-tab', {
      resourceBookmark: resource.id,
      chatResourceBookmark: resource.id,
      resourceBookmarkedManually: tab.resourceBookmarkedManually
    })

    return resource
  }

  export const handleTrackpadScrollStart = () => webview?.handleTrackpadScrollStart()
  export const handleTrackpadScrollStop = () => webview?.handleTrackpadScrollStop()

  export const waitForAppDetection = async (timeoutAfter = 3000) => {
    let timeout: ReturnType<typeof setTimeout>

    const id = generateID()

    const cleanup = () => {
      clearTimeout(timeout)
      appDetectionCallbacks.delete(id)
    }

    return new Promise<DetectedWebApp | null>((resolve) => {
      timeout = setTimeout(() => {
        log.warn('waiting for app detection timed out')
        cleanup()
        resolve(null)
      }, timeoutAfter)

      appDetectionCallbacks.set(id, (app) => {
        cleanup()
        resolve(app)
      })
    })
  }

  const handleWebviewAnnotationClick = async (
    e: WebViewSendEvents[WebViewEventSendNames.AnnotationClick]
  ) => {
    const annotationId = e.id

    log.debug('webview annotation click', annotationId)

    if (tab && tab.resourceBookmark) {
      dispatch('open-resource', tab.resourceBookmark)
    }
  }

  const handleWebviewAnnotationRemove = async (
    annotationId: WebViewSendEvents[WebViewEventSendNames.RemoveAnnotation]
  ) => {
    log.debug('webview annotation remove', annotationId)

    const annotationResource = (await resourceManager.getResource(
      annotationId
    )) as ResourceAnnotation
    if (!annotationResource) {
      log.debug('annotation resource not found', annotationId)
      toasts.error('Annotation not found!')
      return
    }

    const annotationData = await annotationResource.getParsedData()

    await resourceManager.deleteResource(annotationId)

    toasts.success('Annotation deleted!')

    dispatch('reload-annotations', false)
    webview.reload()

    const simplifiedAnnotationType =
      (annotationData.data as AnnotationCommentData)?.content_html ||
      (annotationData.data as AnnotationCommentData)?.content_plain
        ? 'comment'
        : 'highlight'
    await resourceManager.telemetry.trackDeleteAnnotation(
      simplifiedAnnotationType,
      DeleteAnnotationEventTrigger.PageInline
    )
  }

  const handleWebviewAnnotationUpdate = async (
    e: WebViewSendEvents[WebViewEventSendNames.UpdateAnnotation]
  ) => {
    const { id, data } = e

    log.debug('webview annotation update', id)

    const annotationResource = (await resourceManager.getResource(id)) as ResourceAnnotation
    const annotationData = await annotationResource.getParsedData()

    if (annotationData.type !== 'comment') {
      return
    }

    const newData = {
      ...annotationData,
      data: {
        ...annotationData.data,
        ...data
      }
    } as ResourceDataAnnotation

    log.debug('updating annotation data', newData)
    await annotationResource.updateParsedData(newData)

    dispatch('reload-annotations', true)
  }

  const handleWebviewInlineTextReplace = async (
    e: WebViewSendEvents[WebViewEventSendNames.InlineTextReplace]
  ) => {
    log.debug('webview inline text replace', e)
    const { target, content } = e

    // add mark styles to the page
    await webview.executeJavaScript(inlineTextReplaceStylingCode())

    log.debug('executing code')
    const code = inlineTextReplaceCode(target, content)
    await webview.executeJavaScript(code)
  }

  async function handleWebviewTransform(e: WebViewSendEvents[WebViewEventSendNames.Transform]) {
    log.debug('webview transformation', e)

    const detectedResource = await webview.detectResource()
    log.debug('extracted resource data', detectedResource)
    if (!detectedResource) {
      log.debug('no resource detected')
      return
    }

    const transformation = await handleInlineAI(e, detectedResource)
    log.debug('transformation output', transformation)

    webview.sendEvent(WebViewEventReceiveNames.TransformationOutput, {
      text: transformation ?? ''
    })

    await resourceManager.telemetry.trackUseInlineAI(e.type, e.includePageContext)
  }

  async function handleWebviewBookmark(event: WebViewSendEvents[WebViewEventSendNames.Bookmark]) {
    log.debug('webview bookmark', event)

    if (!tab.resourceBookmark) {
      const resource = await resourceManager.createResourceLink(
        { url: event.url },
        { name: tab?.title ?? '', sourceURI: event.url, alt: '' }
      )

      log.debug('created resource', resource)

      tab.resourceBookmark = resource.id

      dispatch('update-tab', { resourceBookmark: resource.id })
    }

    if (event.text) {
      log.debug('creating note for bookmark', event.text)
      const resource = await resourceManager.createResourceNote(event.text, {
        name: tab.title ?? '',
        sourceURI: event.url,
        alt: ''
      })
      log.debug('created resource', resource)
    }
  }

  const handleWebviewAddToChat = async (e: WebViewSendEvents[WebViewEventSendNames.AddToChat]) => {
    log.debug('webview add to chat', e)

    dispatch('add-to-chat', e)
  }

  const handleWebviewAnnotation = async (
    annotationData: WebViewSendEvents[WebViewEventSendNames.Annotate]
  ) => {
    log.debug('webview annotation', annotationData)

    const bookmarkedResourceId = tab.resourceBookmark
    let bookmarkedResource = bookmarkedResourceId
      ? await resourceManager.getResource(bookmarkedResourceId)
      : null

    if (!bookmarkedResource) {
      log.debug('no bookmarked resource')

      const resource = await bookmarkPage(true)
      bookmarkedResource = resource
    }

    const url =
      annotationData?.data?.url ??
      tab.currentLocation ??
      historyEntriesManager.getEntry(tab.historyStackIds[tab.currentHistoryIndex])?.url ??
      tab.initialLocation

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
        ResourceTag.annotates(bookmarkedResource.id),

        // add tags as hashtags
        ...hashtags.map((tag) => ResourceTag.hashtag(tag))
      ]
    )

    log.debug('created annotation resource', annotationResource)

    // Update bookmarked resource if its loaded with annotation
    resourceManager.addAnnotationToLoadedResource(bookmarkedResource.id, annotationResource)

    // update bookmarked resource tags to make the resource visible in Everything
    const isSilent = (bookmarkedResource.tags ?? []).find(
      (tag) => tag.name === ResourceTagsBuiltInKeys.SILENT
    )
    if (isSilent) {
      await resourceManager.deleteResourceTag(bookmarkedResource.id, ResourceTagsBuiltInKeys.SILENT)
    }

    const hideInEverything = (bookmarkedResource.tags ?? []).find(
      (tag) => tag.name === ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING
    )
    if (hideInEverything) {
      await resourceManager.deleteResourceTag(
        bookmarkedResource.id,
        ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING
      )
    }

    log.debug('highlighting text in webview')
    webview.sendEvent(WebViewEventReceiveNames.RestoreAnnotation, {
      id: annotationResource.id,
      data: annotationData
    })

    dispatch('reload-annotations', false)

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

  async function handleWebviewAppDetection(detectedApp: DetectedWebApp) {
    let url = ''
    try {
      log.debug('webview app detection event received', detectedApp)
      if (tab.type !== 'page') return

      tab.currentDetectedApp = detectedApp
      dispatch('update-tab', { currentDetectedApp: detectedApp })

      // run all app detection callbacks
      const detectionCallbacks = Array.from(appDetectionCallbacks.values())
      detectionCallbacks.forEach((callback) => callback(detectedApp))

      if ($appDetectionRunning) {
        log.debug('app detection already running')
        return
      } else {
        appDetectionRunning.set(true)
      }

      const sameAppDetected =
        app &&
        app.appId === detectedApp.appId &&
        app.resourceType === detectedApp.resourceType &&
        app.appResourceIdentifier === detectedApp.appResourceIdentifier

      if (!app) {
        log.debug('first app detection')
      } else if (sameAppDetected) {
        log.debug('no change in app or resource', detectedApp)
      }

      app = detectedApp
      url = detectedApp.canonicalUrl ?? tab.initialLocation

      log.debug('detecting app for url', url)

      const matchingResources = await resourceManager.getResourcesFromSourceURL(url)
      let bookmarkedResource = matchingResources.find(
        (resource) =>
          resource.type !== ResourceTypes.ANNOTATION &&
          resource.type !== ResourceTypes.HISTORY_ENTRY
      )

      const annotationResources = matchingResources.filter(
        (resource) => resource.type === ResourceTypes.ANNOTATION
      ) as ResourceAnnotation[]

      if (annotationResources.length > 0) {
        await wait(500)
        log.debug('applying annotations', annotationResources)
        annotationResources.forEach(async (annotationResource) => {
          const annotation = await annotationResource.getParsedData()
          webview.sendEvent(WebViewEventReceiveNames.RestoreAnnotation, {
            id: annotationResource.id,
            data: annotation
          })
        })
      }

      log.debug('bookmarked resource found', bookmarkedResource)
      if (!bookmarkedResource) {
        if (autoSaveResources) {
          log.debug('creating new silent resource', url)
          bookmarkedResource = await createBookmarkResource(url, tab, true)
        } else if (pageMagic?.showSidebar) {
          log.debug(
            'creating new silent resource even if auto saved is disabled because chat is open',
            url
          )
          bookmarkedResource = await createBookmarkResource(url, tab, true)
        } else {
          log.debug('auto save resources disabled')
        }
      }

      if (bookmarkedResource) {
        const isSilent = (bookmarkedResource.tags ?? []).find(
          (tag) => tag.name === ResourceTagsBuiltInKeys.SILENT
        )

        tab.resourceBookmark = bookmarkedResource.id
        tab.chatResourceBookmark = bookmarkedResource.id
        dispatch('update-tab', {
          resourceBookmark: bookmarkedResource.id,
          chatResourceBookmark: bookmarkedResource.id,
          resourceBookmarkedManually: !isSilent
        })
      } else {
        log.debug('no bookmarked resource found')
        tab.resourceBookmark = null
        tab.chatResourceBookmark = null
        dispatch('update-tab', {
          resourceBookmark: null,
          chatResourceBookmark: null,
          resourceBookmarkedManually: false
        })
      }

      if (sameAppDetected) {
        log.debug('skipping rest of app detection as it has not changed')
        return
      }
    } catch (e) {
      log.error('error handling webview app detection', e)
    } finally {
      appDetectionRunning.set(false)
    }
  }

  const handleWebviewPageEvent = (
    event: CustomEvent<WebviewWrapperEvents['webview-page-event']>
  ) => {
    const { type, data } = event.detail

    if (type === WebViewEventSendNames.KeyDown) {
      dispatch('keydown', data as WebViewSendEvents[WebViewEventSendNames.KeyDown])
    } else if (type === WebViewEventSendNames.DetectedApp) {
      handleWebviewAppDetection(data as DetectedWebApp)
    } else if (type === WebViewEventSendNames.Bookmark) {
      handleWebviewBookmark(data as WebViewSendEvents[WebViewEventSendNames.Bookmark])
    } else if (type === WebViewEventSendNames.Transform) {
      handleWebviewTransform(data as WebViewSendEvents[WebViewEventSendNames.Transform])
    } else if (type === WebViewEventSendNames.InlineTextReplace) {
      handleWebviewInlineTextReplace(
        data as WebViewSendEvents[WebViewEventSendNames.InlineTextReplace]
      )
    } else if (type === WebViewEventSendNames.Annotate) {
      handleWebviewAnnotation(data as WebViewSendEvents[WebViewEventSendNames.Annotate])
    } else if (type === WebViewEventSendNames.AnnotationClick) {
      handleWebviewAnnotationClick(data as WebViewSendEvents[WebViewEventSendNames.AnnotationClick])
    } else if (type === WebViewEventSendNames.RemoveAnnotation) {
      handleWebviewAnnotationRemove(
        data as WebViewSendEvents[WebViewEventSendNames.RemoveAnnotation]
      )
    } else if (type === WebViewEventSendNames.UpdateAnnotation) {
      handleWebviewAnnotationUpdate(
        data as WebViewSendEvents[WebViewEventSendNames.UpdateAnnotation]
      )
    } else if (type === WebViewEventSendNames.AddToChat) {
      handleWebviewAddToChat(data as WebViewSendEvents[WebViewEventSendNames.AddToChat])
    }
  }

  onMount(() => {
    if (!webview) return

    historyStackIds.set(tab.historyStackIds)
    currentHistoryIndex.set(tab.currentHistoryIndex)
  })
</script>

<WebviewWrapper
  id="webview-{tab.id}"
  src={initialSrc}
  partition="persist:horizon"
  {historyEntriesManager}
  {url}
  {historyStackIds}
  {currentHistoryIndex}
  bind:this={webview}
  on:webview-page-event={handleWebviewPageEvent}
  on:url-change={handleUrlChange}
  on:title-change={handleWebviewTitleChange}
  on:favicon-change={handleWebviewFaviconChange}
  on:history-change={handleHistoryChange}
  on:did-finish-load={debouncedAppDetection}
  on:new-tab
  on:navigation
/>
