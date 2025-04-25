<script lang="ts" context="module">
  export type BrowserTabNewTabEvent = {
    url: string
    active: boolean
    trigger?: CreateTabEventTrigger
  }

  export type BrowserTabEvents = {
    // components own events
    navigation: WebviewNavigationEvent
    keydown: WebViewEventKeyDown
    'update-tab': Partial<TabPage>
    'open-resource': string
    'reload-annotations': boolean

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
    'open-mini-browser': string
  }

  export type BookmarkPageOpts = {
    freshWebview?: boolean
    silent?: boolean
    createdForChat?: boolean
  }
</script>

<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { writable, type Writable } from 'svelte/store'
  import type { HistoryEntriesManager } from '../../service/history'
  import type { AIChatMessageSource, PageMagic, TabPage } from '../../types/browser.types'
  import {
    useLogScope,
    useDebounce,
    wait,
    generateID,
    truncate,
    parseUrlIntoCanonical,
    useTimeout,
    compareURLs,
    checkIfYoutubeUrl
  } from '@horizon/utils'
  import { WebParser, type DetectedResource, type DetectedWebApp } from '@horizon/web-parser'
  import {
    CreateAnnotationEventTrigger,
    CreateTabEventTrigger,
    DeleteAnnotationEventTrigger,
    EventContext,
    OpenInMiniBrowserEventFrom,
    ResourceTagsBuiltInKeys,
    ResourceTypes,
    SaveToOasisEventTrigger,
    WebViewEventReceiveNames,
    WebViewEventSendNames,
    type AnnotationCommentData,
    type Download,
    type ResourceDataAnnotation,
    type ResourceDataLink,
    type ResourceDataPDF,
    type WebViewEventKeyDown,
    type WebViewReceiveEvents,
    type WebViewSendEvents
  } from '@horizon/types'
  import WebviewWrapper, { type WebviewWrapperEvents } from '../Webview/WebviewWrapper.svelte'
  import type { WebviewEvents, WebviewNavigationEvent } from '../Webview/Webview.svelte'
  import {
    Resource,
    ResourceAnnotation,
    ResourceJSON,
    ResourceTag,
    useResourceManager
  } from '../../service/resources'
  import { useToasts } from '../../service/toast'
  import { inlineTextReplaceCode, inlineTextReplaceStylingCode } from '../../constants/inline'
  import { handleInlineAI } from '@horizon/core/src/lib/service/ai/helpers'
  import { useConfig } from '../../service/config'
  import { useTabsManager } from '../../service/tabs'
  import {
    useMiniBrowserService,
    type MiniBrowserSelected
  } from '@horizon/core/src/lib/service/miniBrowser'
  import MiniBrowser from '../MiniBrowser/MiniBrowser.svelte'
  import { useAI } from '@horizon/core/src/lib/service/ai/ai'
  import { useOasis } from '@horizon/core/src/lib/service/oasis'
  import { SpaceEntryOrigin } from '@horizon/core/src/lib/types'
  import type { SavingItem } from '@horizon/core/src/lib/service/saving'

  export let tab: TabPage
  export let downloadIntercepters: Writable<Map<string, (data: Download) => void>>
  export let historyEntriesManager: HistoryEntriesManager
  export let webview: WebviewWrapper
  export let id: string = `webview-${tab.id}`
  export let active: boolean = false
  export let isLoading = writable(false)
  export let disableMiniBrowser = false
  export let insideMiniBrowser = false
  export let initialSrc =
    tab.currentLocation ??
    historyEntriesManager.getEntry(tab.historyStackIds[tab.currentHistoryIndex])?.url ??
    tab.initialLocation ??
    'about:blank'

  export let url = writable<string>(initialSrc)
  export let webContentsId = writable<number | null>(null)

  const log = useLogScope('BrowserTab')

  const dispatch = createEventDispatcher<BrowserTabEvents>()
  const resourceManager = useResourceManager()
  const toasts = useToasts()
  const config = useConfig()
  const tabs = useTabsManager()
  const oasis = useOasis()
  const ai = useAI()
  const miniBrowserService = useMiniBrowserService()
  const scopedMiniBrowser = miniBrowserService.createScopedBrowser(`tab-${tab.id}`)

  const activeTabId = tabs.activeTabId
  const showNewTabOverlay = tabs.showNewTabOverlay
  const userConfigSettings = config.settings
  const showChatSidebar = ai.showChatSidebar

  const isMediaPlaying = writable(false)

  export const goBack = () => webview.goBack()
  export const goForward = () => webview.goForward()
  export const focus = () => webview.focus()
  export const reload = () => webview.reload()
  export const forceReload = () => webview.forceReload()
  export const navigate = (url: string) => webview.navigate(url)
  export const openDevTools = () => webview.openDevTools()
  export const capturePage = (rect?: Electron.Rectangle) => webview.capturePage(rect)
  export const detectResource = (timeoutNum?: number) => webview.detectResource(timeoutNum)
  export const executeJavaScript = (code: string, userGesture?: boolean) =>
    webview.executeJavaScript(code, userGesture)
  export const zoomIn = () => webview.zoomIn()
  export const zoomOut = () => webview.zoomOut()
  export const resetZoom = () => webview.resetZoom()
  export const downloadURL = (url: string, options?: Electron.DownloadURLOptions) =>
    webview.downloadURL(url, options)
  export const sendWebviewEvent = <T extends keyof WebViewReceiveEvents>(
    name: T,
    data?: WebViewReceiveEvents[T]
  ): void => webview.sendEvent(name, data)
  export const canGoBack = webview?.canGoBack
  export const canGoForward = webview?.canGoForward
  export const getInitialSrc = () => initialSrc
  export const getMediaPlaybackState = () => isMediaPlaying
  export const requestEnterPip = () => webview?.requestEnterPip()
  export const requestExitPip = () => webview?.requestExitPip()
  export const isUsingPictureInPicture = () => webview?.isUsingPictureInPicture()

  let app: DetectedWebApp | null = null

  const historyStackIds = writable<string[]>(tab.historyStackIds)
  const currentHistoryIndex = writable(tab.currentHistoryIndex)
  const appDetectionRunning = writable(false)

  const appDetectionCallbacks = new Map<string, (app: DetectedWebApp) => void>()
  const bookmarkingPromises = new Map<string, Promise<Resource>>()
  const updatingResourcePromises = new Map<string, Promise<Resource>>()

  $: if (tab.id === $activeTabId && $webContentsId !== null) {
    window.api.setActiveTab($webContentsId)
  }

  const debouncedAppDetection = useDebounce(async () => {
    await wait(500)
    log.debug('running app detection debounced')
    webview?.startAppDetection()
  }, 500)

  const debouncedTabUpdate = useDebounce(() => {
    // log.debug('running tab persist debounced', tab)
    dispatch('update-tab', tab)
  }, 500)

  const debouncedUrlUpdate = useDebounce(() => {
    tabs.emit('url-changed', tab, $url)
  }, 200)

  const handleUrlChange = async (e: CustomEvent<string>) => {
    // await wait(500)
    // log.debug('running app detection on', e.detail)

    const urlChanged =
      parseUrlIntoCanonical(e.detail) !==
      parseUrlIntoCanonical(tab.currentLocation ?? tab.initialLocation)

    tab = {
      ...tab,
      currentLocation: e.detail
    }

    debouncedTabUpdate()
    debouncedUrlUpdate()

    // We only want to run app detection if the URL has actually changed i.e. the user navigated to a new page
    if (urlChanged) {
      debouncedAppDetection()
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

  async function extractResource(
    url: string,
    freshWebview = false
  ): Promise<DetectedResource | null> {
    log.debug('extracting resource data from', url, freshWebview ? 'using fresh webview' : '')

    let detectedResource: DetectedResource | null = null

    if (freshWebview) {
      const webParser = new WebParser(url)
      detectedResource = await webParser.extractResourceUsingWebview(document)
    } else {
      detectedResource = await webview.detectResource()
    }

    if (!detectedResource) {
      log.debug('no resource detected')
      return null
    }

    return detectedResource
  }

  async function createBookmarkResource(
    url: string,
    tab: TabPage,
    opts?: BookmarkPageOpts
  ): Promise<Resource> {
    log.debug('bookmarking', url, opts)

    const defaultOpts: BookmarkPageOpts = {
      silent: false,
      createdForChat: false,
      freshWebview: false
    }

    const { silent, createdForChat, freshWebview } = Object.assign({}, defaultOpts, opts)

    let bookmarkingPromise = bookmarkingPromises.get(url)
    if (bookmarkingPromise !== undefined) {
      log.debug('already bookmarking page, piggybacking on existing promise')

      /* 
        Because a page might already be bookmarked when the page gets loaded we have to make sure
        we are not bookmarking it twice if the user manually saves it quickly after the page loads
        or hits the bookmark button multiple times.

        Since the initial bookmarking call might create a silent resource we need to make sure that
        we are updating the resource with the correct options if the user manually saves it.

        This is a bit of a hacky solution but it works for now. 
      */
      return new Promise(async (resolve, reject) => {
        try {
          const resource = await bookmarkingPromise!

          // make sure the previous promise was using the same options, if not overwrite it with the new ones
          const hasSilentTag = (resource.tags ?? []).find(
            (tag) => tag.name === ResourceTagsBuiltInKeys.SILENT
          )

          if (hasSilentTag && !silent) {
            await resourceManager.deleteResourceTag(resource.id, ResourceTagsBuiltInKeys.SILENT)
          } else if (!hasSilentTag && silent) {
            await resourceManager.updateResourceTag(
              resource.id,
              ResourceTagsBuiltInKeys.SILENT,
              'true'
            )
          }

          const hasCreatedForChatTag = (resource.tags ?? []).find(
            (tag) => tag.name === ResourceTagsBuiltInKeys.CREATED_FOR_CHAT
          )

          if (hasCreatedForChatTag && !createdForChat) {
            await resourceManager.deleteResourceTag(
              resource.id,
              ResourceTagsBuiltInKeys.CREATED_FOR_CHAT
            )
          } else if (!hasCreatedForChatTag && createdForChat) {
            await resourceManager.updateResourceTag(
              resource.id,
              ResourceTagsBuiltInKeys.CREATED_FOR_CHAT,
              'true'
            )
          }

          resolve(resource)
        } catch (e) {
          reject(null)
        }
      })
    }

    bookmarkingPromise = new Promise(async (resolve, reject) => {
      const detectedResource = await extractResource(url, freshWebview)
      const resourceTags = [
        ResourceTag.canonicalURL(url),
        ResourceTag.viewedByUser(true),
        ...(silent ? [ResourceTag.silent()] : []),
        ...(createdForChat ? [ResourceTag.createdForChat()] : [])
      ]

      if (!detectedResource) {
        const resource = await resourceManager.createResourceLink(
          {
            title: tab.title ?? '',
            url: url
          } as ResourceDataLink,
          {
            name: tab.title ?? '',
            sourceURI: url,
            alt: ''
          },
          resourceTags
        )

        resolve(resource)
        return
      }

      const isPDFPage = detectedResource.type === ResourceTypes.PDF
      let filename = null
      try {
        if (isPDFPage) {
          const resourceData = detectedResource.data as ResourceDataPDF
          const url = resourceData.url
          const pdfDownloadURL = resourceData?.downloadURL ?? url

          log.debug('downloading PDF', pdfDownloadURL)
          const downloadData = await new Promise<Download | null>((resolveDownload) => {
            const timeout = setTimeout(() => {
              downloadIntercepters.update((intercepters) => {
                intercepters.delete(pdfDownloadURL)
                return intercepters
              })
              resolveDownload(null)
            }, 1000 * 60)

            downloadIntercepters.update((intercepters) => {
              intercepters.set(pdfDownloadURL, (data) => {
                clearTimeout(timeout)
                downloadIntercepters.update((intercepters) => {
                  intercepters.delete(pdfDownloadURL)
                  return intercepters
                })
                resolveDownload(data)
              })
              return intercepters
            })

            downloadURL(pdfDownloadURL)
          })

          log.debug('download data', downloadData, downloadData.resourceId)

          if (downloadData && downloadData.resourceId) {
            filename = downloadData.filename
            const resource = (await resourceManager.getResource(downloadData.resourceId))!

            if (url !== pdfDownloadURL) {
              await resourceManager.updateResourceTag(
                resource.id,
                ResourceTagsBuiltInKeys.CANONICAL_URL,
                url
              )
            }
            const hasSilentTag = (resource.tags ?? []).find(
              (tag) => tag.name === ResourceTagsBuiltInKeys.SILENT
            )
            if (hasSilentTag && !silent)
              await resourceManager.deleteResourceTag(resource.id, ResourceTagsBuiltInKeys.SILENT)

            const hasCreatedForChatTag = (resource.tags ?? []).find(
              (tag) => tag.name === ResourceTagsBuiltInKeys.CREATED_FOR_CHAT
            )
            if (hasCreatedForChatTag && !createdForChat)
              await resourceManager.deleteResourceTag(
                resource.id,
                ResourceTagsBuiltInKeys.CREATED_FOR_CHAT
              )

            if ($userConfigSettings.cleanup_filenames) {
              const filename = tab.title || downloadData.filename
              log.debug('cleaning up filename', filename, url)
              const completion = await ai.cleanupTitle(filename, url)
              if (!completion.error && completion.output) {
                log.debug('cleaned up filename', filename, completion.output)
                await resourceManager.updateResourceMetadata(resource.id, {
                  name: completion.output,
                  sourceURI: url !== pdfDownloadURL ? url : undefined
                })
              }
            } else {
              await resourceManager.updateResourceMetadata(resource.id, {
                name: tab.title,
                sourceURI: url !== pdfDownloadURL ? url : undefined
              })
            }

            resolve(resource)
            return
          } else {
            log.error('Failed to download PDF')
            reject(null)
            return
          }
        }

        const title = filename ?? detectedResource.data?.title ?? tab.title ?? ''
        const resource = await resourceManager.createDetectedResource(
          detectedResource,
          {
            name: title,
            sourceURI: url,
            alt: ''
          },
          resourceTags
        )

        resolve(resource)
      } catch (error) {
        log.error('Error creating bookmark resource:', error)
        reject(null)
      }
    })

    bookmarkingPromises.set(url, bookmarkingPromise)
    bookmarkingPromise.then(() => {
      bookmarkingPromises.delete(url)
    })

    return bookmarkingPromise
  }

  export async function refreshResourceWithPage(
    resource: Resource,
    url: string,
    freshWebview = false
  ): Promise<Resource> {
    let updatingPromise = updatingResourcePromises.get(url)
    if (updatingPromise !== undefined) {
      log.debug('already updating resource, piggybacking on existing promise')
      return new Promise(async (resolve, reject) => {
        try {
          const resource = await updatingPromise!
          resolve(resource)
        } catch (e) {
          reject(null)
        }
      })
    }

    updatingPromise = new Promise(async (resolve, reject) => {
      try {
        if (app?.resourceType === 'application/pdf') {
          resolve(resource)
          return
        }
        resource.updateExtractionState('running')

        // Run resource detection on a fresh webview to get the latest data
        const detectedResource = await extractResource(url, freshWebview)

        log.debug('extracted resource data', detectedResource)

        if (detectedResource) {
          log.debug('updating resource with fresh data', detectedResource.data)
          await resourceManager.updateResourceParsedData(resource.id, detectedResource.data)
          await resourceManager.updateResourceMetadata(resource.id, {
            name: (detectedResource.data as any).title || tab.title || '',
            sourceURI: url
          })
        }

        resource.updateExtractionState('idle')

        resolve(resource)
      } catch (e) {
        log.error('error refreshing resource', e)
        resource.updateExtractionState('idle') // TODO: support error state
        reject(null)
      }
    })

    updatingResourcePromises.set(url, updatingPromise)
    updatingPromise.then(() => {
      updatingResourcePromises.delete(url)
    })

    return updatingPromise
  }

  export async function bookmarkPage(opts?: BookmarkPageOpts) {
    const defaultOpts: BookmarkPageOpts = {
      silent: false,
      createdForChat: false,
      freshWebview: false
    }

    const { silent, createdForChat, freshWebview } = Object.assign({}, defaultOpts, opts)

    const rawUrl =
      tab.currentLocation ??
      historyEntriesManager.getEntry(tab.historyStackIds[tab.currentHistoryIndex])?.url ??
      tab.initialLocation

    let url = parseUrlIntoCanonical(rawUrl) ?? rawUrl

    const surfResourceId = url.match(/^surf:\/\/resource\/([^\/]+)/)?.[1]
    if (surfResourceId) {
      return await resourceManager.getResource(surfResourceId)
    }

    let saveItem: SavingItem | undefined
    if (!silent) {
      log.debug('adding pending save item')
      saveItem = oasis.addPendingSaveTab(tab)
    }

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

    if (tab.resourceBookmark) {
      const fetchedResource = await resourceManager.getResource(tab.resourceBookmark)
      if (fetchedResource) {
        const isDeleted =
          (fetchedResource?.tags ?? []).find((tag) => tag.name === ResourceTagsBuiltInKeys.DELETED)
            ?.value === 'true'

        const fetchedCanonical = (fetchedResource?.tags ?? []).find(
          (tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL
        )

        if (!isDeleted && compareURLs(fetchedCanonical?.value || '', url)) {
          log.debug('already bookmarked', url, fetchedResource.id)

          if (!silent) {
            tab.resourceBookmarkedManually = true
            await resourceManager.markResourceAsSavedByUser(fetchedResource.id)

            saveItem?.addResource(fetchedResource)
          }

          // Make sure the resource is up to date with at least the latest title and sourceURI
          // Updating the resource also makes sure that the resource is visible at the top of the Everything view
          await resourceManager.updateResourceMetadata(fetchedResource.id, {
            name: tab.title ?? '',
            sourceURI: url
          })

          tab.resourceBookmark = fetchedResource.id
          dispatch('update-tab', {
            resourceBookmark: fetchedResource.id,
            resourceBookmarkedManually: tab.resourceBookmarkedManually
          })

          if (freshWebview) {
            log.debug('updating resource with fresh data', fetchedResource.id)
            refreshResourceWithPage(fetchedResource, url, true)
              .then((resource) => {
                log.debug('refreshed resource', resource)
              })
              .catch((e) => {
                toasts.error('Failed to refresh resource')
                fetchedResource.updateExtractionState('idle') // TODO: support error state
              })
          }

          return fetchedResource
        }
      }
    }

    log.debug('bookmarking', url)
    const resource = await createBookmarkResource(url, tab, {
      silent,
      createdForChat,
      freshWebview
    })

    log.debug('adding resource to save item', resource, saveItem)
    saveItem?.addResource(resource)

    // if (resource.type === ResourceTypes.PDF) {
    //   window.api.openResourceLocally({
    //     id: resource.id,
    //     metadata: resource.metadata,
    //     type: resource.type,
    //     path: resource.path,
    //     deleted: resource.deleted,
    //     createdAt: resource.createdAt,
    //     updatedAt: resource.updatedAt
    //   })
    // }

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

  export const createResourceForChat = async (opts?: BookmarkPageOpts) => {
    return bookmarkPage({ silent: true, createdForChat: true, ...opts })
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

  export const highlightWebviewText = async (
    answerText: string,
    source: AIChatMessageSource | null
  ) => {
    const pdfPage = source?.metadata?.page ?? null
    const toast = pdfPage === null ? toasts.loading('Highlighting Citation…') : undefined

    try {
      log.debug('highlighting text', answerText, source)

      const detectedResource = await detectResource()
      if (!detectedResource) {
        log.error('no resource detected')
        toast?.error('Failed to parse content to highlight citation')
        return
      }

      if (detectedResource.type === ResourceTypes.PDF) {
        if (pdfPage === null) {
          log.error("page attribute isn't present")
          toast?.error('Failed to find source text in the page for citation')
          return
        }
        sendWebviewEvent(WebViewEventReceiveNames.GoToPDFPage, {
          page: pdfPage,
          targetText: source!.content
        })
        return
      }

      const content = WebParser.getResourceContent(detectedResource.type, detectedResource.data)
      if (!content || !content.html) {
        log.debug('no content found from web parser')
        toast?.error('Failed to parse content to highlight citation')
        return
      }

      const textElements = getTextElementsFromHtml(content.html)
      if (!textElements) {
        log.debug('no text elements found')
        toast?.error('Failed to find source text in the page for citation')
        return
      }

      log.debug('text elements length', textElements.length)

      // will throw an error if the request takes longer than 20 seconds
      const timedGetAIDocsSimilarity = useTimeout(() => {
        return resourceManager.sffs.getAIDocsSimilarity(answerText, textElements, 0.5)
      }, 20000)

      const docsSimilarity = await timedGetAIDocsSimilarity()
      if (!docsSimilarity || docsSimilarity.length === 0) {
        log.debug('no docs similarity found')
        toast?.error('Failed to find source text in the page for citation')
        return
      }

      log.debug('docs similarity', docsSimilarity)

      docsSimilarity.sort((a, b) => a.similarity - b.similarity)
      const texts = []
      for (const docSimilarity of docsSimilarity) {
        const doc = textElements[docSimilarity.index]
        log.debug('doc', doc)
        if (doc && doc.includes(' ')) {
          texts.push(doc)
        }
      }

      sendWebviewEvent(WebViewEventReceiveNames.HighlightText, {
        texts: texts
      })

      toast?.success('Citation Highlighted!')
    } catch (e) {
      log.error('error highlighting text', e)
      toast?.error('Failed to highlight citation')
    }
  }

  const getTextElementsFromHtml = (html: string): string[] => {
    let textElements: string[] = []
    const body = new DOMParser().parseFromString(html, 'text/html').body
    body.querySelectorAll('p').forEach((p) => {
      textElements.push(p.textContent?.trim() ?? '')
    })
    return textElements
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

    const transformation = await handleInlineAI(ai, e, detectedResource)
    log.debug('transformation output', transformation)

    webview.sendEvent(WebViewEventReceiveNames.TransformationOutput, {
      text: transformation ?? 'Failed to generate output'
    })

    await resourceManager.telemetry.trackAskInlineAI({
      isFollowUp: e.isFollowUp ?? false,
      baseMedia: 'text'
    })
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
      const resource = await resourceManager.createResourceNote(
        event.text,
        {
          name: tab.title ?? '',
          sourceURI: event.url,
          alt: ''
        },
        undefined,
        EventContext.Webpage
      )
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

    if ('source' in annotationData.data && annotationData.data.source === 'inline_ai') {
      log.debug('Saving chat response')

      let content: string = ''
      const element = document.getElementById(`chat-message`)
      if (element) {
        content = element.innerHTML
      }

      const resource = await resourceManager.createResourceNote(
        annotationData.data.content_plain,
        {
          name: truncate(annotationData.data.content_plain, 20)
        },
        undefined,
        EventContext.Inline
      )

      if (tabs.activeScopeIdValue && $userConfigSettings.save_to_active_context) {
        await oasis.addResourcesToSpace(
          tabs.activeScopeIdValue,
          [resource.id],
          SpaceEntryOrigin.ManuallyAdded
        )
      }

      log.debug('Saved response', resource)

      toasts.success('Saved to My Stuff!')

      await resourceManager.telemetry.trackSaveToOasis(
        ResourceTypes.DOCUMENT_SPACE_NOTE,
        SaveToOasisEventTrigger.Click,
        false,
        EventContext.Inline,
        'text'
      )

      return
    }

    const bookmarkedResourceId = tab.resourceBookmark
    let bookmarkedResource = bookmarkedResourceId
      ? await resourceManager.getResource(bookmarkedResourceId)
      : null

    if (!bookmarkedResource) {
      log.debug('no bookmarked resource')

      const resource = await bookmarkPage({ silent: true })
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

    if (tabs.activeScopeIdValue && $userConfigSettings.save_to_active_context) {
      await oasis.addResourcesToSpace(
        tabs.activeScopeIdValue,
        [annotationResource.id],
        SpaceEntryOrigin.ManuallyAdded
      )

      if (bookmarkedResource) {
        await oasis.addResourcesToSpace(
          tabs.activeScopeIdValue,
          [bookmarkedResource.id],
          SpaceEntryOrigin.ManuallyAdded
        )
      }
    }

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

  const handleWebviewCopy = async () => {
    log.debug('webview copy')
    toasts.success('Copied to clipboard!')
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
          resource.type !== ResourceTypes.HISTORY_ENTRY &&
          !(resource.tags ?? []).some(
            (tag) =>
              tag.name === ResourceTagsBuiltInKeys.SAVED_WITH_ACTION && tag.value === 'generated'
          ) &&
          !(
            (resource.tags ?? []).find(
              (tag) =>
                tag.name === ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING && tag.value === 'true'
            ) &&
            (resource.tags ?? []).find(
              (tag) => tag.name === ResourceTagsBuiltInKeys.CREATED_FOR_CHAT && tag.value === 'true'
            )
          )
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

      const detectedResourceType = detectedApp.resourceType
      log.debug('bookmarked resource found', bookmarkedResource, tab)

      if (bookmarkedResource) {
        if (detectedResourceType === ResourceTypes.DOCUMENT_NOTION) {
          log.debug('updating bookmarked resource with fresh content', bookmarkedResource.id)
          await refreshResourceWithPage(bookmarkedResource, url, false)
        }
      } else {
        // Note: we now let the context manager take care of creating resources when it needs them, keeping this around if we ever need it again.
        // log.debug('creating new silent resource', url)
        // bookmarkedResource = await createBookmarkResource(url, tab, {
        //   silent: true,
        //   createdForChat: true,
        //   freshWebview: false
        // })
      }

      // Check if the detected resource is different from the one we previously bookmarked
      // If it is and it is silent, delete it as it is no longer needed
      if (tab.chatResourceBookmark && tab.chatResourceBookmark !== bookmarkedResource?.id) {
        const resource = await resourceManager.getResource(tab.chatResourceBookmark)
        if (resource) {
          const isSilent =
            (resource.tags ?? []).find((tag) => tag.name === ResourceTagsBuiltInKeys.SILENT)
              ?.value === 'true'

          // For PDFs we don't want to delete the resource as embedding it is expensive and we might need it later
          if (isSilent && resource.type !== 'application/pdf') {
            log.debug(
              'deleting chat resource bookmark as the tab has been updated',
              tab.chatResourceBookmark
            )
            await resourceManager.deleteResource(resource.id)
          }
        } else {
          log.error('resource not found', tab.chatResourceBookmark)
          tab.chatResourceBookmark = null
        }
      }

      if (bookmarkedResource) {
        const isSilent = (bookmarkedResource.tags ?? []).find(
          (tag) => tag.name === ResourceTagsBuiltInKeys.SILENT
        )

        const isHideInEverything = (bookmarkedResource.tags ?? []).find(
          (tag) => tag.name === ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING
        )

        const isFromSpaceSource = (bookmarkedResource.tags ?? []).find(
          (tag) => tag.name === ResourceTagsBuiltInKeys.SPACE_SOURCE
        )

        const isFromLiveSpace = isHideInEverything && isFromSpaceSource
        const manuallySaved = !isSilent && !isFromLiveSpace

        tab.resourceBookmark = bookmarkedResource.id
        tab.chatResourceBookmark = bookmarkedResource.id
        dispatch('update-tab', {
          resourceBookmark: bookmarkedResource.id,
          chatResourceBookmark: bookmarkedResource.id,
          resourceBookmarkedManually: manuallySaved
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

  const handleWebviewNewWindow = async (e: CustomEvent<WebviewEvents['new-window']>) => {
    const disposition = e.detail.disposition
    if (disposition === 'new-window') {
      if (disableMiniBrowser) {
        dispatch('open-mini-browser', e.detail.url)
        return
      }

      scopedMiniBrowser.openWebpage(e.detail.url, { from: OpenInMiniBrowserEventFrom.WebPage })
      return
    }

    tabs.addPageTab(e.detail.url, {
      active: disposition === 'foreground-tab',
      trigger: CreateTabEventTrigger.Page
    })
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
    } else if (type === WebViewEventSendNames.Copy) {
      handleWebviewCopy()
    }
  }

  const handleWebviewMediaPlaybackChanged = (e: CustomEvent<boolean>) => {
    webview.isCurrentlyAudible().then((v) => {
      if (e.detail && !v) return
      isMediaPlaying.set(e.detail)
    })
  }

  onMount(() => {
    if (!webview) return

    historyStackIds.set(tab.historyStackIds)
    currentHistoryIndex.set(tab.currentHistoryIndex)
  })
</script>

<MiniBrowser service={scopedMiniBrowser} {active} on:seekToTimestamp on:highlightWebviewText />

<WebviewWrapper
  {id}
  style={!active || ($showNewTabOverlay === 2 && !insideMiniBrowser)
    ? 'pointer-events: none !important;'
    : ''}
  src={initialSrc}
  partition="persist:horizon"
  {historyEntriesManager}
  {url}
  {historyStackIds}
  {currentHistoryIndex}
  {isLoading}
  {webContentsId}
  acceptsDrags={active}
  bind:this={webview}
  on:webview-page-event={handleWebviewPageEvent}
  on:url-change={handleUrlChange}
  on:title-change={handleWebviewTitleChange}
  on:favicon-change={handleWebviewFaviconChange}
  on:history-change={handleHistoryChange}
  on:did-finish-load={debouncedAppDetection}
  on:new-window={handleWebviewNewWindow}
  on:navigation
  on:media-playback-changed={handleWebviewMediaPlaybackChanged}
/>
