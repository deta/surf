import { ipcRenderer } from 'electron'
import type {
  WebAppExtractor,
  DetectedResource,
  WebAppExtractorActions,
  WebServiceActionInputs
} from '@deta/web-parser'
import { WebParser } from '@deta/web-parser'
import type { DetectedWebApp, ResourceDataPDF } from '@deta/types'
import { DragTypeNames } from '@deta/types'
import {
  WebViewReceiveEvents,
  WebViewSendEvents,
  WebViewEventReceiveNames,
  WebViewEventSendNames,
  ResourceTypes,
  WebViewGestureRequiredEventNames
} from '@deta/types'

// import CommentIndicator from './components/CommentIndicator.svelte'
import { type ResourceArticle, type Resource } from '@deta/services/resources'
import { isInternalViewerURL, normalizeURL } from '@deta/utils/formatting'
import { htmlToMarkdown } from '@deta/utils/formatting'
import { setupChromeWebStoreApi } from './helpers/chrome-web-store'

const PDFViewerEntryPoint =
  process.argv.find((arg) => arg.startsWith('--pdf-viewer-entry-point='))?.split('=')[1] || ''

let appParser: WebAppExtractor | null = null

// disable console logs in production
if (!import.meta.env.DEV) {
  console.debug = console.log = console.warn = console.error = () => {}
}

interface PDFInfo {
  path: URL
  pathOverride?: URL
  isPDFPage: true
}

interface WebAppInfo {
  isPDFPage: false
  parser: WebAppExtractor
}

type AppDetectionResult = PDFInfo | WebAppInfo

function pdfViewerCheck(): PDFInfo | { isPDFPage: false } {
  const url = new URL(window.location.href)
  if (!isInternalViewerURL(url.href, PDFViewerEntryPoint)) {
    return { isPDFPage: false as const }
  }

  const params = new URLSearchParams(url.search)
  const path = params.get('path')
  if (!path) throw new Error('Missing path param')

  return {
    path: new URL(decodeURIComponent(path)),
    pathOverride: params.get('pathOverride')
      ? new URL(decodeURIComponent(params.get('pathOverride')!))
      : undefined,
    isPDFPage: true as const
  }
}

function runAppDetection(): AppDetectionResult | undefined {
  const webParser = new WebParser(window.location.href)
  const pdfCheck = pdfViewerCheck()

  console.debug('Running app detection on', window.location.href)

  if (pdfCheck.isPDFPage) {
    const appInfo: DetectedWebApp = {
      appId: pdfCheck.path.hostname,
      appName: pdfCheck.path.hostname,
      hostname: pdfCheck.path.hostname,
      canonicalUrl: pdfCheck.path.href,
      downloadUrl: pdfCheck.pathOverride?.href,
      resourceType: 'application/pdf',
      appResourceIdentifier: window.location.pathname,
      resourceNeedsPicking: false
    }

    console.debug('App detected:', appInfo)
    sendPageEvent(WebViewEventSendNames.DetectedApp, appInfo)
    return pdfCheck
  }

  const isSupported = webParser.isSupportedApp()
  console.debug('Is supported app', isSupported)

  if (isSupported) {
    appParser = webParser.createAppParser()
  } else {
    console.warn('No supported app found, using fallback parser')
    appParser = webParser.useFallbackParser(document)
  }

  if (!appParser) {
    console.error('No app parser found for', window.location.href)
    return undefined
  }

  const appInfo = appParser.getInfo()
  const rssFeedUrl = appParser.getRSSFeedUrl(document)
  if (rssFeedUrl) {
    appInfo.rssFeedUrl = rssFeedUrl
  }

  console.debug('App detected:', appInfo)
  sendPageEvent(WebViewEventSendNames.DetectedApp, appInfo)

  return { isPDFPage: false as const, parser: appParser }
}

function runResourceDetection(): void {
  const result = runAppDetection()
  if (!result) {
    console.error('No app parser found for', window.location.href)
    return
  }

  console.log('Running resource detection for', result)

  if (result.isPDFPage) {
    sendPageEvent(WebViewEventSendNames.DetectedResource, {
      type: ResourceTypes.PDF,
      data: {
        url: result.path.href,
        downloadURL: result.pathOverride?.href
      } as ResourceDataPDF
    } as DetectedResource)
    return
  }

  result.parser.extractResourceFromDocument(document).then((resource) => {
    console.debug('Resource', resource)
    console.debug('Sending detected-resource event')
    sendPageEvent(WebViewEventSendNames.DetectedResource, resource)
  })
}

function runServiceAction(id: string, inputs: WebServiceActionInputs) {
  const appParser = runAppDetection() as WebAppExtractorActions | undefined
  if (appParser) {
    console.debug('Running action', id, 'with input', inputs)
    appParser.runAction(document, id, inputs).then((resource) => {
      console.debug('Resource', resource)
      console.debug('Sending action-output event')
      sendPageEvent(WebViewEventSendNames.ActionOutput, { id, output: resource })
    })
  }
}

function handleHighlightText(data: WebViewReceiveEvents[WebViewEventReceiveNames.HighlightText]) {
  console.debug('highlight webview text:', data)
  const texts = data.texts
  if (!texts || texts.length === 0) {
    return
  }

  const style = document.createElement('style')
  style.innerHTML = `
            .citation-highlight {
              background-color: #E4D3FD;
              color: #2F2F59;
            }
        `
  document.head.appendChild(style)

  // reset highlights
  const highlights = document.querySelectorAll('.citation-highlight') as NodeListOf<HTMLElement>
  console.debug('Removing existing highlights', highlights)
  highlights.forEach((highlight) => {
    highlight.classList.remove('citation-highlight')
    highlight.classList.remove('citation-to-scroll')
    highlight.style.backgroundColor = 'initial'
  })

  const paragraphs = document.querySelectorAll('p')
  for (const [i, text] of texts.entries()) {
    paragraphs.forEach((p) => {
      const content = p.textContent?.trim() ?? ''
      if (text === content) {
        // highlight the paragraph
        p.classList.add('citation-highlight')
        // the first paragraph is the most relevant
        if (i == 0) {
          p.classList.add('citation-to-scroll')
        }

        // adjust the hightlight strength based on the position of the text in the array (first is strongest)
        const strength = 1 - i / texts.length
        p.style.backgroundColor = `rgba(228, 211, 253, ${strength})`
      }
    })
  }

  const toScroll = document.querySelectorAll('.citation-to-scroll')
  if (!toScroll || toScroll.length === 0) {
    console.error('No element found to scroll')
    return
  }
  toScroll[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
}

function handleSeekToTimestamp(
  data: WebViewReceiveEvents[WebViewEventReceiveNames.SeekToTimestamp]
) {
  console.debug('Seeking to timestamp', data)
  const timestamp = data.timestamp
  const video = document.querySelector('video')
  if (!video) {
    console.error('No video element found')
    return
  }
  video.currentTime = timestamp
  video.play()
}

function handleGoToPDFPage(data: WebViewReceiveEvents[WebViewEventReceiveNames.GoToPDFPage]) {
  window.dispatchEvent(
    new CustomEvent('pdf-renderer-event', {
      detail: {
        type: WebViewEventReceiveNames.GoToPDFPage,
        data: {
          page: data.page,
          targetText: data.targetText
        }
      }
    })
  )
}

async function handleReuqestEnterPictureInPicture() {
  try {
    const videoEl = Array.from(document.getElementsByTagName('video'))
      .filter((e) => !e.paused && !e.muted)
      .at(0)
    if (!videoEl) {
      console.warn("Didn't find valid video for PiP!")
      return
    }

    await videoEl.requestPictureInPicture()

    // NOTE: These currently don't work properly in Electron/Chromium. Will impl as soon as they work.
    /*videoEl.addEventListener('enterpictureinpicture', (e: PictureInPictureEvent) => {})
    videoEl.addEventListener('leavepictureinpicture', async (e: PictureInPictureEvent) => {
      await document.exitPictureInPicture()
      // Video left Picture-in-Picture.
      // User may have played a Picture-in-Picture video from a different page.
      // const was_playing = !vid.paused;
      setTimeout(() => {
        if (!videoEl.paused) {
          console.log('came Back to Tab')
        } else if (videoEl) {
          console.log('clicked the close button')
        } else {
          console.log('was already paused, no way to know')
        }
      }, 0)
    })
    navigator.mediaSession.setActionHandler('play', function () {})
    navigator.mediaSession.setActionHandler('pause', function () {})*/
  } catch (e) {
    console.error('Could not use pip: ', e)
  }
}
async function handleReuqestExitPictureInPicture() {
  if (!document.pictureInPictureElement) return
  try {
    await document.exitPictureInPicture()
  } catch (e) {
    console.error('Could not exit pip: ', e)
  }
}

window.addEventListener('DOMContentLoaded', async (_) => {
  // When a text is selected and the user starts typing again, disable the handle again
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    const div = document.getElementById('horizonTextDragHandle')

    // Ignore typing in the drag handle
    if (e.target === div || div?.contains(e.target as Node)) return

    if (e.key.length === 1) {
      div?.parentNode?.removeChild(div)
    }
  })

  window.addEventListener('mousedown', (e: MouseEvent) => {
    // mouseDownX = e.clientX // Store the X-coordinate on mousedown

    const target = e.target as HTMLElement
    console.debug('mousedown', target, target.id, target.tagName)
  })

  document.addEventListener('dragend', () => {
    const div = document.getElementById('horizonTextDragHandle')
    div?.parentNode?.removeChild(div)
    window.getSelection()?.removeAllRanges()
  })

  document.addEventListener('dragstart', (event: DragEvent) => {
    event.dataTransfer?.setData('text/space-source', window.location.href)
  })
})

window.addEventListener('click', (event: MouseEvent) => {
  sendPageEvent(WebViewEventSendNames.MouseClick, {
    button: event.button,
    clientX: event.clientX,
    clientY: event.clientY
  })
})

window.addEventListener('keyup', (event: KeyboardEvent) => {
  sendPageEvent(WebViewEventSendNames.KeyUp, { key: event.key })
})

window.addEventListener('keydown', async (event: KeyboardEvent) => {
  // Ignore synthetic events that are not user generated
  if (!event.isTrusted) {
    return
  }

  if (event.altKey && event.code === 'KeyP') {
    if (!document.pictureInPictureElement) handleReuqestEnterPictureInPicture()
    else handleReuqestExitPictureInPicture()
  }

  if ((event.key === '+' || event.key === '-') && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
  }

  if (
    (event.ctrlKey || event.metaKey) &&
    (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
  ) {
    const inputFocused =
      document.activeElement?.tagName === 'INPUT' ||
      document.activeElement?.tagName === 'TEXTAREA' ||
      (document.activeElement as HTMLElement)?.isContentEditable
    if (inputFocused) {
      return
    }
  }

  sendPageEvent(WebViewEventSendNames.KeyDown, {
    key: event.key,
    code: event.code,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey
  })
})

window.addEventListener('wheel', (event: WheelEvent) => {
  sendPageEvent(WebViewEventSendNames.Wheel, {
    deltaX: event.deltaX,
    deltaY: event.deltaY,
    deltaZ: event.deltaZ,
    deltaMode: event.deltaMode,
    clientX: event.clientX,
    clientY: event.clientY,
    pageX: event.pageX,
    pageY: event.pageY,
    screenX: event.screenX,
    screenY: event.screenY
  })
})

const createDragEventCopy = (e: DragEvent) => ({
  ...e, // this exists to make TypeScript happy
  clientX: e.clientX,
  clientY: e.clientY,
  pageX: e.pageX,
  pageY: e.pageY,
  screenX: e.screenX,
  screenY: e.screenY,
  altKey: e.altKey,
  ctrlKey: e.ctrlKey,
  metaKey: e.metaKey,
  shiftKey: e.shiftKey
})

interface DragMetadata {
  token: string
  resource: Resource
}

let dragDepth = 0
let isDropping = false
let _dragMetadatas: { [resourceId: string]: DragMetadata } = {}

ipcRenderer.on('set-drag-metadata', (_, data: string) => {
  try {
    const metadata = JSON.parse(data) as DragMetadata
    _dragMetadatas[metadata.resource.id] = metadata
  } catch (error) {
    console.error('error parsing drag metadata:', error)
  }
})

const getDragMetadata = async (resourceId: string): Promise<DragMetadata | null> => {
  for (let i = 0; i < 5; i++) {
    if (resourceId in _dragMetadatas) {
      const metadata = _dragMetadatas[resourceId]
      delete _dragMetadatas[resourceId]
      return metadata
    }
    if (i < 4) await new Promise((resolve) => setTimeout(resolve, 5))
  }
  return null
}

window.addEventListener(
  'dragover',
  (e: DragEvent) => {
    e.preventDefault()
    sendPageEvent(WebViewEventSendNames.DragOver, createDragEventCopy(e))
  },
  { capture: true }
)
window.addEventListener(
  'drag',
  (event: DragEvent) => {
    sendPageEvent(WebViewEventSendNames.Drag, createDragEventCopy(event))
  },
  { capture: true }
)

window.addEventListener(
  'dragenter',
  (e: DragEvent) => {
    dragDepth++
    if (dragDepth > 1) return
    sendPageEvent(WebViewEventSendNames.DragEnter, createDragEventCopy(e))
  },
  { passive: true, capture: true }
)

window.addEventListener(
  'dragleave',
  (e: DragEvent) => {
    dragDepth--
    if (dragDepth > 0) return
    dragDepth = 0
    sendPageEvent(WebViewEventSendNames.DragLeave, createDragEventCopy(e))
  },
  { passive: true, capture: true }
)

window.addEventListener('drop', handleDrop, { capture: true })

async function handleDrop(e: DragEvent) {
  if (isDropping) return
  isDropping = true

  try {
    e.preventDefault()
    e.stopImmediatePropagation()
    e.dataTransfer!.effectAllowed = 'all'
    e.dataTransfer!.dropEffect = 'move'

    sendPageEvent(WebViewEventSendNames.Drop, {
      ...createDragEventCopy(e),
      dataTransfer: e.dataTransfer
    })

    const resourceId = e.dataTransfer?.getData(DragTypeNames.SURF_RESOURCE_ID)
    if (resourceId) {
      const metadata = await getDragMetadata(resourceId)
      if (!metadata) return

      const { token, resource } = metadata
      const newDataTransfer = await createNewDataTransfer(token, resource)

      for (const item of (newDataTransfer ?? e.dataTransfer)?.items ?? []) {
        if (item.kind === 'file') {
          const f = item.getAsFile()!
          console.log(`[drop] new DT file of type ${item.type}`, f.name, f.type, f.path)
          //console.log('contents', await item.getAsFile()?.text())
        } else {
          item.getAsString((data) => {
            console.log(`[drop] new DT string:`, data)
          })
        }
      }

      e.target!.dispatchEvent(
        new DragEvent('drop', {
          dataTransfer: newDataTransfer ?? e.dataTransfer,
          bubbles: true,
          cancelable: true,
          clientX: e.clientX,
          clientY: e.clientY,
          screenX: e.screenX,
          screenY: e.screenY,
          pageX: e.pageX,
          pageY: e.pageY
        })
      )

      // TODO: Expand / Improve for specific apps using existing app detection logic
      if (
        normalizeURL(location.hostname) === 'notion.so' &&
        newDataTransfer?.getData('text/html')
      ) {
        const contentHtml = newDataTransfer!.getData('text/html')
        const contentMarkdown = await htmlToMarkdown(contentHtml)

        await navigator.clipboard.writeText(contentMarkdown)
        const pasteEvent = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: new DataTransfer()
        })
        pasteEvent.clipboardData?.setData('text/plain', contentMarkdown)
        ;(document.activeElement ?? document.body).dispatchEvent(pasteEvent)
      }
    } else {
      e.target!.dispatchEvent(
        new DragEvent('drop', {
          dataTransfer: e.dataTransfer,
          bubbles: true,
          cancelable: true,
          clientX: e.clientX,
          clientY: e.clientY,
          screenX: e.screenX,
          screenY: e.screenY,
          pageX: e.pageX,
          pageY: e.pageY
        })
      )
    }
  } catch (error) {
    console.error('error handling drop:', error)
  } finally {
    isDropping = false
    dragDepth = 0
  }
}

async function createNewDataTransfer(
  token: string,
  resource: Resource
): Promise<DataTransfer | null> {
  console.time('[drop] fetching data')
  try {
    const buffer = await ipcRenderer.invoke('webview-read-resource-data', {
      token,
      resourceId: resource.id
    })
    console.timeEnd('[drop] fetching data')

    if (!buffer) return null
    const file = new File([buffer], resource.metadata?.name || 'file', {
      type: resource.type || 'application/octet-stream'
    })
    console.log('[drop] created file: ', file.name, file.type, file)

    const newDataTransfer = new DataTransfer()

    if (
      resource.type === ResourceTypes.ARTICLE ||
      resource.type === ResourceTypes.LINK ||
      resource.type.startsWith(ResourceTypes.POST) ||
      resource.type.startsWith(ResourceTypes.DOCUMENT)
    ) {
      newDataTransfer.setData('text/uri-list', (resource as ResourceArticle).metadata?.sourceURI)

      if (resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE) {
        let contentHtml = Buffer.from(buffer).toString()
        newDataTransfer.setData('text/html', contentHtml)

        // Convert to plain text
        // var html = '<p>Some HTML</p>'
        // var div = document.createElement('div')
        // div.innerHTML = html
        // var contentPlain = div.textContent || div.innerText || ''
        const contentPlain = contentHtml.replace(/<[^>]+>/g, '')

        newDataTransfer.setData('text/plain', contentPlain)
      }
    } else {
      newDataTransfer.items.add(file)
    }
    // TODO: (dnd): Continue transforms for specific types
    /*else if (resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE) {
      (resource as ResourceDocument).
    }*/

    return newDataTransfer
  } catch (error) {
    console.error('error fetching file:', error)
    return null
  }
}

const handleDragEnterLeave = (eventType: 'dragenter' | 'dragleave') => {
  let isHandling = false
  return (e: DragEvent) => {
    if (isHandling) return
    isHandling = true
    e.preventDefault()
    e.stopImmediatePropagation()

    // TODO: (dnd): Rn we always attach a file so that the handler work correctly, this is weird tho if the drag itself has no data attached.
    const dummyFile = new File([new ArrayBuffer(1)], 'dummy', { type: 'application/octet-stream' })
    const newDataTransfer = new DataTransfer()
    newDataTransfer.items.add(dummyFile)

    e.target?.dispatchEvent(
      new DragEvent(eventType, {
        ...e,
        dataTransfer: newDataTransfer,
        relatedTarget: e.relatedTarget,
        bubbles: true,
        cancelable: true,
        clientX: e.clientX,
        clientY: e.clientY,
        screenX: e.screenX,
        screenY: e.screenY,
        pageX: e.pageX,
        pageY: e.pageY
      })
    )
    isHandling = false
  }
}

window.addEventListener('dragenter', handleDragEnterLeave('dragenter'), { capture: true })
window.addEventListener('dragleave', handleDragEnterLeave('dragleave'), { capture: true })

window.addEventListener('focus', (_event: FocusEvent) => {
  sendPageEvent(WebViewEventSendNames.Focus)
})

function sendPageEvent<T extends keyof WebViewSendEvents>(
  name: T,
  data?: WebViewSendEvents[T]
): void {
  console.debug('Sending page event', name, data)
  ipcRenderer.send('webview-page-event', name, data)
  ipcRenderer.sendToHost('webview-page-event', name, data)
}

ipcRenderer.on('webview-event', (_event, payload) => {
  const { type, data } = payload
  console.log('Received webview event', type, data)
  if (type === WebViewEventReceiveNames.GetSelection) {
    const selection = window.getSelection()
    const text = selection?.toString().trim()

    sendPageEvent(WebViewEventSendNames.Selection, text)
  } else if (type === WebViewEventReceiveNames.GetResource) {
    runResourceDetection()
  } else if (type === WebViewEventReceiveNames.GetApp) {
    runAppDetection()
  } else if (type === WebViewEventReceiveNames.RunAction) {
    runServiceAction(data.id, data.inputs)
  } else if (type === WebViewEventReceiveNames.HighlightText) {
    handleHighlightText(data)
  } else if (type == WebViewEventReceiveNames.SeekToTimestamp) {
    handleSeekToTimestamp(data)
  } else if (type === WebViewEventReceiveNames.GoToPDFPage) {
    handleGoToPDFPage(data)
  } else if (type === WebViewEventReceiveNames.RequestExitPIP) {
    handleReuqestExitPictureInPicture()
  } else if (type === WebViewEventReceiveNames.RequestPIPState) {
    sendPageEvent(WebViewEventSendNames.PIPState, {
      pip: document.pictureInPictureElement !== null
    })
  }
})
// Handle special permission events
window.addEventListener(WebViewGestureRequiredEventNames.RequestEnterPIP, (e) => {
  handleReuqestEnterPictureInPicture()
})

window.addEventListener('submit', (e: Event) => {
  // @ts-ignore
  const action = e.target.action
  if (action) {
    const protocol = new URL(action).protocol
    if (protocol === 'http:' && window.location.protocol === 'https:') {
      if (
        !confirm(
          'Warning: You are submitting a form via an insecure connection which could reveal the data you are sending to others. Are you sure you want to continue?'
        )
      ) {
        e.stopPropagation()
        e.preventDefault()
      }
    }
  }
})

window.addEventListener('fullscreenchange', (e: Event) => {
  sendPageEvent(WebViewEventSendNames.FullscreenChange, {
    fullscreen: document.fullscreenElement != undefined
  })
})
