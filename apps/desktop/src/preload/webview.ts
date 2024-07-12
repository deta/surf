import { ipcRenderer } from 'electron'
import {
  WebParser,
  type WebAppExtractor,
  DetectedResource,
  WebAppExtractorActions,
  WebServiceActionInputs,
  getRangeData,
  constructRange,
  applyRangeHighlight
} from '@horizon/web-parser'
import {
  AnnotationCommentRange,
  AnnotationRangeData,
  WebViewEventReceiveNames,
  WebViewEventSendNames,
  WebViewReceiveEvents,
  WebViewSendEvents,
  WebviewAnnotationEventNames,
  WebviewAnnotationEvents
} from '@horizon/types'

import Menu from './components/Menu.svelte'
import CommentMenu from './components/Comment.svelte'
import CommentIndicator from './components/CommentIndicator.svelte'
import { useDebounce } from '@horizon/core/src/lib/utils/debounce'

const COMPONENT_WRAPPER_TAG = 'DETA-COMPONENT-WRAPPER'

// let mouseDownX = 0
let previouslySelectedText: string | undefined = ''
let appParser: WebAppExtractor | null = null
let selectionMenu: Menu | null = null

let selectionMenuWrapper: ReturnType<typeof createComponentWrapper> | null = null

// const clickOutsideHandlers = new Map<string, () => void>()

const debouncedAppDetection = useDebounce(runAppDetection, 200)

function runAppDetection() {
  console.log('Running app detection on', window.location.href)
  // TODO: pass the URL to the detection function so we don't have to initialize a new WebParser
  const webParser = new WebParser(window.location.href)

  const isSupported = webParser.isSupportedApp()
  console.log('Is supported app', isSupported)

  if (isSupported) {
    appParser = webParser.createAppParser()
  } else {
    console.warn('No supported app found, using fallback parser')
    appParser = webParser.useFallbackParser(document)
  }

  if (!appParser) {
    console.error('No app parser found for', window.location.href)
    return
  }

  const appInfo = appParser.getInfo()
  const rssFeedUrl = appParser.getRSSFeedUrl(document)
  if (rssFeedUrl) {
    appInfo.rssFeedUrl = rssFeedUrl
  }

  console.log('App detected:', appInfo)
  sendPageEvent(WebViewEventSendNames.DetectedApp, appInfo)

  return appParser
}

function runResourceDetection() {
  // We are intentionally re-running the app detection here since the user might have navigated to a different page since the last detection
  const appParser = runAppDetection()
  if (appParser) {
    appParser.extractResourceFromDocument(document).then((resource) => {
      console.log('Resource', resource)
      console.log('Sending detected-resource event')
      sendPageEvent(WebViewEventSendNames.DetectedResource, resource)
    })
  } else {
    console.error('No app parser found for', window.location.href)
  }
}

function startResourcePicker() {
  // We are intentionally re-running the app detection here since the user might have navigated to a different page since the last detection
  const appParser = runAppDetection()
  if (appParser) {
    const appInfo = appParser.getInfo()
    if (appInfo.resourceNeedsPicking) {
      // @ts-ignore TODO: Fix this
      appParser.startResourcePicker(document, (resource: DetectedResource) => {
        console.log('Picked resource', resource)

        sendPageEvent(WebViewEventSendNames.DetectedResource, resource)
      })
    } else {
      console.warn('App does not need/support resource picking')
      sendPageEvent(WebViewEventSendNames.DetectedResource, null)
    }
  }
}

function runServiceAction(id: string, inputs: WebServiceActionInputs) {
  const appParser = runAppDetection() as WebAppExtractorActions | undefined
  if (appParser) {
    console.log('Running action', id, 'with input', inputs)
    appParser.runAction(document, id, inputs).then((resource) => {
      console.log('Resource', resource)
      console.log('Sending action-output event')
      sendPageEvent(WebViewEventSendNames.ActionOutput, { id, output: resource })
    })
  }
}

function handleTransformOutput(text: string) {
  if (!selectionMenu) return

  selectionMenu.handleOutput(text)
}

function createComponentWrapper(
  id: string,
  position: { x: string; y: string; maxWidth?: string },
  styles?: string,
  className?: string,
  closeHandler?: () => void
) {
  const oldWrapper = document.getElementById(id)
  console.log('old wrapper', oldWrapper)
  oldWrapper?.parentNode?.removeChild(oldWrapper)

  const div = document.createElement(COMPONENT_WRAPPER_TAG)
  div.id = id
  div.style.position = 'absolute'
  div.style.zIndex = '100000'
  div.style.left = position.x
  div.style.top = position.x
  div.style.opacity = '0' // Set initial opacity to 0
  div.style.transition = 'opacity 0.2s ease' // Add transition for opacity
  div.style.pointerEvents = 'none'

  if (position.maxWidth) {
    div.style.maxWidth = position.maxWidth
  }

  if (styles) {
    div.style.cssText += styles
  }

  if (className) {
    div.classList.add(className)
  }

  document.body.appendChild(div)

  const shadow = div.attachShadow({ mode: 'open' })
  const webviewStyles = document.getElementById('webview-styles')
  if (webviewStyles) {
    shadow.appendChild(webviewStyles.cloneNode(true))
  }

  const remove = () => {
    if (closeHandler) {
      closeHandler()
    }
    div.parentNode?.removeChild(div)
  }

  const show = () => {
    div.style.opacity = '1'
  }

  return {
    root: shadow,
    content: div,
    remove,
    show
  }
}

function renderCommentIndicator(annotation: AnnotationCommentRange) {
  const calculatePosition = (elem: Element) => {
    const rangePosition = annotation.range.getBoundingClientRect()
    const xRaw = rangePosition.left - elem.clientWidth - 10 + window.scrollX
    const yRaw = rangePosition.top + window.scrollY
    const x = `${cssKeepInBounds(xRaw, elem.clientWidth)}px`
    const y = `${yRaw}px`

    return { x, y }
  }

  const pos = calculatePosition(document.body)

  const wrapper = createComponentWrapper(
    `deta-annotation-${annotation.id}`,
    {
      x: pos.x,
      y: pos.y
    },
    'transform: translateY(-5px);',
    'deta-annotation-comment-indicator'
  )

  const repositionWrapper = () => {
    const pos = calculatePosition(wrapper.content)
    wrapper.content.style.left = pos.x
    wrapper.content.style.top = pos.y
  }

  const indicator = new CommentIndicator({
    target: wrapper.root,
    props: {}
  })

  // listen for resize events and update the position of the indicator
  const resizeObserver = new ResizeObserver(repositionWrapper)
  resizeObserver.observe(annotation.range.commonAncestorContainer as Element)

  // listen for page resize events and update the position of the indicator
  window.addEventListener('resize', repositionWrapper)

  indicator.$on('click', () => {
    console.log('clicked on comment', annotation.id)

    wrapper.remove()

    // remove the event listeners when the indicator is closed
    window.removeEventListener('resize', repositionWrapper)
    resizeObserver.disconnect()

    renderComment(annotation)
  })

  // finally show the indicator
  wrapper.show()
}

function cssKeepInBounds(raw: number, width: number, adjustment: number = 0) {
  const BOUNDS = 10
  const pos = raw - width * adjustment

  const leftBound = Math.max(pos, BOUNDS)
  const rightBound = Math.min(leftBound, window.innerWidth - width - BOUNDS * 2)

  return rightBound
}

function renderComment(annotation: AnnotationCommentRange) {
  const rangePosition = annotation.range.getBoundingClientRect()

  const calculatePosition = (elem: Element) => {
    const rangePosition = annotation.range.getBoundingClientRect()
    const xRaw = rangePosition.left + rangePosition.width / 2 + window.scrollX
    const yRaw = rangePosition.bottom + window.scrollY
    const x = `${cssKeepInBounds(xRaw, elem.clientWidth, 0.5)}px`
    const y = `${yRaw}px`

    return { x, y }
  }

  const pos = calculatePosition(document.body)

  const wrapper = createComponentWrapper(
    `deta-annotation-comment-${annotation.id}`,
    {
      x: pos.x,
      y: pos.y,
      maxWidth: Math.min(Math.max(rangePosition.width, 550), 800) + 'px'
    },
    'transform: translateY(15px);',
    'deta-annotation-comment'
  )

  const repositionWrapper = () => {
    const pos = calculatePosition(wrapper.content)
    wrapper.content.style.left = pos.x
    wrapper.content.style.top = pos.y
  }

  const comment = new CommentMenu({
    target: wrapper.root,
    props: {
      text: annotation.data.content_html ?? annotation.data.content_plain
    }
  })

  // listen for resize events and update the position of the indicator
  const resizeObserver = new ResizeObserver(repositionWrapper)
  resizeObserver.observe(annotation.range.commonAncestorContainer as Element)

  // listen for page resize events and update the position of the indicator
  window.addEventListener('resize', repositionWrapper)

  const closeComment = () => {
    console.log('Closing comment', annotation)

    wrapper.remove()

    // remove the event listeners when the indicator is closed
    window.removeEventListener('resize', repositionWrapper)
    resizeObserver.disconnect()

    // renderCommentIndicator(annotation)
  }

  comment.$on('close', (e) => {
    closeComment()
  })

  comment.$on('remove', (e) => {
    console.log('Removing annotation', annotation)
    sendPageEvent(WebViewEventSendNames.RemoveAnnotation, annotation.id)
  })

  comment.$on('updateContent', (e) => {
    console.log('Updating annotation content', e.detail)

    annotation.data.content_plain = e.detail.plain
    annotation.data.content_html = e.detail.html

    sendPageEvent(WebViewEventSendNames.UpdateAnnotation, {
      id: annotation.id,
      data: {
        content_plain: e.detail.plain,
        content_html: e.detail.html
      }
    })
  })

  wrapper.show()
}

function openComment(annotation: AnnotationCommentRange) {
  console.log('Opening comment', annotation)
  const oldComment = document.getElementById(`deta-annotation-comment-${annotation.id}`)
  if (oldComment) {
    oldComment.remove()
  }

  renderComment(annotation)
}

function handleRestoreAnnotation(
  annotationEvent: WebViewReceiveEvents[WebViewEventReceiveNames.RestoreAnnotation]
) {
  try {
    const selection = window.getSelection()
    if (!selection) {
      console.error('No selection found')
      return
    }

    const annotation = annotationEvent.data

    if (annotation.anchor?.type !== 'range') {
      console.error('Unsupported anchor type', annotation.anchor?.type)
      return
    }

    const range = constructRange(annotation.anchor.data as AnnotationRangeData)

    console.log('Restoring annotation', range)
    applyRangeHighlight(range, annotationEvent.id, annotation.type)

    const commentAnnotation = {
      id: annotationEvent.id,
      range: range,
      data:
        annotation.type === 'comment' ? annotation.data : { content_plain: '', content_html: '' }
    } as AnnotationCommentRange

    console.log('Injecting comment', commentAnnotation)
    // renderCommentIndicator(commentAnnotation)
    applyRangeHighlight(range, annotationEvent.id, annotation.type, () => {
      renderComment(commentAnnotation)
    })

    // if (annotation.type === 'comment') {
    //   const commentAnnotation = {
    //     id: annotationEvent.id,
    //     range: range,
    //     data: annotation.data
    //   } as AnnotationCommentRange

    //   console.log('Injecting comment', commentAnnotation)
    //   // renderCommentIndicator(commentAnnotation)
    //   applyRangeHighlight(range, annotationEvent.id, annotation.type, () => {
    //     renderComment(commentAnnotation)
    //   })
    // } else {
    //   applyRangeHighlight(range, annotationEvent.id, annotation.type)
    // }
  } catch (e) {
    console.error('Failed to restore annotation', e)
  }
}

function handleHighlightText(data: WebViewReceiveEvents[WebViewEventReceiveNames.HighlightText]) {
  console.log('highlight webview text:', data)
  const texts = data.texts

  const style = document.createElement('style')
  style.innerHTML = `
            .citation-highlight{
              background-color: yellow;
            }
        `
  document.head.appendChild(style)

  // reset highlights
  const highlights = document.querySelectorAll('.citation-highlight')
  console.log('Removing existing highlights', highlights)
  highlights.forEach((highlight) => {
    highlight.classList.remove('citation-highlight')
  })

  const paragraphs = document.querySelectorAll('p')
  for (const text of texts) {
    paragraphs.forEach((p) => {
      const content = p.textContent?.trim() ?? ''
      if (text === content) {
        // highlight the paragraph
        p.classList.add('citation-highlight')
      }
    })
  }

  const newHighlights = document.querySelectorAll('.citation-highlight')
  if (newHighlights.length > 0) {
    console.log('Scrolling to highlight', newHighlights)
    newHighlights[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
  }
}

function handleSeekToTimestamp(
  data: WebViewReceiveEvents[WebViewEventReceiveNames.SeekToTimestamp]
) {
  console.log('Seeking to timestamp', data)
  const timestamp = data.timestamp
  const video = document.querySelector('video')
  if (!video) {
    console.error('No video element found')
    return
  }
  video.currentTime = timestamp
  video.play()
}

function handleScrollToAnnotation(
  data: WebViewReceiveEvents[WebViewEventReceiveNames.ScrollToAnnotation]
) {
  console.log('Scrolling to annotation', data)
  const annotation = data.data

  const elements = document.querySelectorAll(`deta-annotation[id="${data.id}"]`)
  if (!elements) {
    console.error('Elements not found for scroll', data)
    return
  }

  console.log('Scrolling to element', elements)
  elements[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })

  // make the element glow for a short time
  const glowClass = 'deta-annotion-glow'

  elements.forEach((element) => {
    element.classList.add(glowClass)
  })

  setTimeout(() => {
    elements.forEach((element) => {
      element.classList.remove(glowClass)
    })
  }, 1000)

  if (annotation.type === 'comment') {
    const commentAnnotation = {
      id: data.id,
      range: constructRange(annotation.anchor?.data as AnnotationRangeData),
      data: annotation.data
    } as AnnotationCommentRange

    openComment(commentAnnotation)
  }
}

window.addEventListener('DOMContentLoaded', async (_) => {
  window.addEventListener('mouseup', (e: MouseEvent) => {
    const target = e.target as HTMLElement
    console.log('mouseup', target, target.id)
    if (target.id === 'horizonTextDragHandle') {
      return
    }

    const selection = window.getSelection()
    const text = selection?.toString().trim()
    // const bodyBackgroundColor = getComputedStyle(document.body).backgroundColor ?? 'white'

    const selectionRange = selection?.getRangeAt(0)
    const selectionRect = selectionRange?.getBoundingClientRect()
    // const elementSelector = selectionRange?.commonAncestorContainer.parentElement

    if (selectionRect && text && text != previouslySelectedText) {
      const calculatePosition = (elem: Element) => {
        const rangePosition = selectionRange!.getBoundingClientRect()
        const xRaw = rangePosition.left + window.scrollX
        const yRaw = rangePosition.bottom + window.scrollY
        const x = `${cssKeepInBounds(xRaw, elem.clientWidth)}px`
        const y = `${yRaw}px`

        return { x, y }
      }

      const pos = calculatePosition(document.body)

      selectionMenuWrapper = createComponentWrapper(
        'horizonTextDragHandle',
        {
          x: pos.x,
          y: pos.y,
          maxWidth: Math.min(Math.max(selectionRect.width, 650), 800) + 'px'
        },
        'transform: translateY(15px);'
      )

      const respositionWrapper = () => {
        const pos = calculatePosition(selectionMenuWrapper!.content)
        selectionMenuWrapper!.content.style.left = pos.x
        selectionMenuWrapper!.content.style.top = pos.y
      }

      if (selectionRange?.commonAncestorContainer) {
        // listen for resize events and update the position of the indicator
        const resizeObserver = new ResizeObserver(respositionWrapper)
        const elem = selectionRange.commonAncestorContainer.parentElement
        if (elem) {
          resizeObserver.observe(elem)
        }
      }

      // listen for page resize events and update the position of the indicator
      window.addEventListener('resize', respositionWrapper)

      // TODO: unregister the event listeners when the selection menu is removed

      selectionMenu = new Menu({
        target: selectionMenuWrapper.root,
        props: {
          text: text
        }
      })

      selectionMenu.$on('save', (e) => {
        const text = e.detail
        console.log('Saving text', text)

        // re apply selection if it was removed accidentally
        if (selection && selectionRange) {
          selection.removeAllRanges()
          selection.addRange(selectionRange)
        }

        if (!selectionRange) {
          console.error('No selection range found')
          return
        }

        const rangeData = getRangeData(selectionRange)

        console.log('Range data', rangeData)

        sendPageEvent(WebViewEventSendNames.Annotate, {
          type: 'comment',
          anchor: {
            type: 'range',
            data: rangeData
          },
          data: {
            url: window.location.href,
            content_plain: text,
            source: 'inline_ai'
          }
        })

        // sendPageEvent(WebViewEventSendNames.Bookmark, { text, url: window.location.href })
      })

      selectionMenu.$on('highlight', (e) => {
        // const selection = window.getSelection()
        // if (!selection) return
        if (!selectionRange) {
          console.error('No selection range found')
          return
        }

        // const range = selection?.getRangeAt(0)
        const rangeData = getRangeData(selectionRange)

        console.log('Highlighting data', rangeData)

        sendPageEvent(WebViewEventSendNames.Annotate, {
          type: 'comment',
          anchor: {
            type: 'range',
            data: rangeData
          },
          data: {
            url: window.location.href,
            content_plain: '',
            content_html: '',
            source: 'user'
          }
        })

        if (selection && selectionRange) {
          selection.removeAllRanges()
        }
      })

      selectionMenu.$on('comment', (e) => {
        const content = e.detail
        console.log('Commenting', content)

        if (!selectionRange) {
          console.error('No selection range found')
          return
        }

        const rangeData = getRangeData(selectionRange)

        console.log('Highlighting data', rangeData)

        sendPageEvent(WebViewEventSendNames.Annotate, {
          type: 'comment',
          anchor: {
            type: 'range',
            data: rangeData
          },
          data: {
            url: window.location.href,
            content_plain: content.plain,
            content_html: content.html,
            source: 'user',
            tags: content.tags
          }
        })

        if (selection && selectionRange) {
          selection.removeAllRanges()
        }

        selectionMenuWrapper?.remove()
      })

      selectionMenu.$on('transform', (e) => {
        const { query, type, includePageContext } = e.detail
        console.log('transforming', type, query, text)

        // re apply selection if it was removed accidentally
        if (selection && selectionRange) {
          selection.removeAllRanges()
          selection.addRange(selectionRange)
        }

        sendPageEvent(WebViewEventSendNames.Transform, { text, query, type, includePageContext })
      })

      selectionMenu.$on('insert', (e) => {
        // re apply selection if it was removed accidentally
        if (selection && selectionRange) {
          selection.removeAllRanges()
          selection.addRange(selectionRange)
        }

        sendPageEvent(WebViewEventSendNames.InlineTextReplace, { target: text, content: e.detail })
      })

      if (e.altKey) {
        console.log('Alt key pressed, highlighting directly')
        selectionMenu.handleMarker()
      }

      // Animate in on appear
      setTimeout(() => {
        selectionMenuWrapper?.show()
        window.addEventListener('mousedown', () => {
          return
        })
      }, 120)

      // reset previously selected text after delay, so the user can actually select the same text again.
      previouslySelectedText = ''
    }

    previouslySelectedText = text
  })

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
    console.log('mousedown', target, target.id, target.tagName)

    if (target.tagName !== COMPONENT_WRAPPER_TAG) {
      if (selectionMenuWrapper) {
        if (selectionMenu?.canClose()) {
          console.log('Removing selection menu')
          selectionMenuWrapper.remove()
        } else {
          e.preventDefault()
        }
      }
    }
  })

  window.addEventListener(
    WebviewAnnotationEventNames.Click as any,
    (e: CustomEvent<WebviewAnnotationEvents[WebviewAnnotationEventNames.Click]>) => {
      const { id, type } = e.detail
      console.log('Clicked on annotation', id, type)

      if (type === 'comment') {
        renderComment()
      }

      sendPageEvent(WebViewEventSendNames.AnnotationClick, { id, type })
    }
  )

  document.addEventListener('dragend', () => {
    const div = document.getElementById('horizonTextDragHandle')
    div?.parentNode?.removeChild(div)
    window.getSelection()?.removeAllRanges()
  })

  document.addEventListener('dragstart', (event: DragEvent) => {
    event.dataTransfer?.setData('text/space-source', window.location.href)
  })

  runAppDetection()
})

window.addEventListener('keyup', (event: KeyboardEvent) => {
  sendPageEvent(WebViewEventSendNames.KeyUp, { key: event.key })
})

window.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === 'd' && (event.ctrlKey || event.metaKey) && event.shiftKey) {
    startResourcePicker()
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

window.addEventListener('focus', (_event: FocusEvent) => {
  sendPageEvent(WebViewEventSendNames.Focus)
})

function sendPageEvent<T extends keyof WebViewSendEvents>(
  name: T,
  data?: WebViewSendEvents[T]
): void {
  console.log('Sending page event', name, data)
  ipcRenderer.sendToHost('webview-page-event', name, data)
}

ipcRenderer.on('webview-event', (_event, payload) => {
  const { type, data } = payload
  if (type === WebViewEventReceiveNames.GetSelection) {
    const selection = window.getSelection()
    const text = selection?.toString().trim()

    sendPageEvent(WebViewEventSendNames.Selection, text)
  } else if (type === WebViewEventReceiveNames.GetResource) {
    runResourceDetection()
  } else if (type === WebViewEventReceiveNames.GetApp) {
    debouncedAppDetection()
  } else if (type === WebViewEventReceiveNames.RunAction) {
    runServiceAction(data.id, data.inputs)
  } else if (type === WebViewEventReceiveNames.TransformationOutput) {
    handleTransformOutput(data.text)
  } else if (type === WebViewEventReceiveNames.RestoreAnnotation) {
    handleRestoreAnnotation(data)
  } else if (type === WebViewEventReceiveNames.ScrollToAnnotation) {
    handleScrollToAnnotation(data)
  } else if (type === WebViewEventReceiveNames.HighlightText) {
    handleHighlightText(data)
  } else if (type == WebViewEventReceiveNames.SeekToTimestamp) {
    handleSeekToTimestamp(data)
  }
})

// @ts-expect-error
window.insertText = (text: string) => {
  console.log('Inserting text', text)
  sendPageEvent(WebViewEventSendNames.InsertText, text)
}
