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
// import CommentIndicator from './components/CommentIndicator.svelte'
import { useDebounce } from '@horizon/utils'
import { type Resource } from '@horizon/core/src/lib/service/resources'

const COMPONENT_WRAPPER_TAG = 'DETA-COMPONENT-WRAPPER'

// let mouseDownX = 0
let previouslySelectedText: string | undefined = ''
let appParser: WebAppExtractor | null = null
let selectionMenu: Menu | null = null

let selectionMenuWrapper: ReturnType<typeof createComponentWrapper> | null = null

// const clickOutesouHandlers = new Map<string, () => void>()
// debouncedAppDetection
useDebounce(runAppDetection, 200)

function runAppDetection() {
  console.debug('Running app detection on', window.location.href)
  // TODO: pass the URL to the detection function so we don't have to initialize a new WebParser
  const webParser = new WebParser(window.location.href)

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
    return
  }

  const appInfo = appParser.getInfo()
  const rssFeedUrl = appParser.getRSSFeedUrl(document)
  if (rssFeedUrl) {
    appInfo.rssFeedUrl = rssFeedUrl
  }

  console.debug('App detected:', appInfo)
  sendPageEvent(WebViewEventSendNames.DetectedApp, appInfo)

  return appParser
}

function runResourceDetection() {
  // We are intentionally re-running the app detection here since the user might have navigated to a different page since the last detection
  const appParser = runAppDetection()
  if (appParser) {
    appParser.extractResourceFromDocument(document).then((resource) => {
      console.debug('Resource', resource)
      console.debug('Sending detected-resource event')
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
        console.debug('Picked resource', resource)

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
    console.debug('Running action', id, 'with input', inputs)
    appParser.runAction(document, id, inputs).then((resource) => {
      console.debug('Resource', resource)
      console.debug('Sending action-output event')
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
  console.debug('old wrapper', oldWrapper)
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

  const shadow = div.attachShadow({ mode: 'closed' })
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

// function renderCommentIndicator(annotation: AnnotationCommentRange) {
//   const calculatePosition = (elem: Element) => {
//     const rangePosition = annotation.range.getBoundingClientRect()
//     const xRaw = rangePosition.left - elem.clientWidth - 10 + window.scrollX
//     const yRaw = rangePosition.top + window.scrollY
//     const x = `${cssKeepInBounds(xRaw, elem.clientWidth)}px`
//     const y = `${yRaw}px`

//     return { x, y }
//   }

//   const pos = calculatePosition(document.body)

//   const wrapper = createComponentWrapper(
//     `deta-annotation-${annotation.id}`,
//     {
//       x: pos.x,
//       y: pos.y
//     },
//     'transform: translateY(-5px);',
//     'deta-annotation-comment-indicator'
//   )

//   const repositionWrapper = () => {
//     const pos = calculatePosition(wrapper.content)
//     wrapper.content.style.left = pos.x
//     wrapper.content.style.top = pos.y
//   }

//   const indicator = new CommentIndicator({
//     target: wrapper.root,
//     props: {}
//   })

//   // listen for resize events and update the position of the indicator
//   const resizeObserver = new ResizeObserver(repositionWrapper)
//   resizeObserver.observe(annotation.range.commonAncestorContainer as Element)

//   // listen for page resize events and update the position of the indicator
//   window.addEventListener('resize', repositionWrapper)

//   indicator.$on('click', () => {
//     console.debug('clicked on comment', annotation.id)

//     wrapper.remove()

//     // remove the event listeners when the indicator is closed
//     window.removeEventListener('resize', repositionWrapper)
//     resizeObserver.disconnect()

//     renderComment(annotation)
//   })

//   // finally show the indicator
//   wrapper.show()
// }

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
    console.debug('Closing comment', annotation)

    wrapper.remove()

    // remove the event listeners when the indicator is closed
    window.removeEventListener('resize', repositionWrapper)
    resizeObserver.disconnect()

    // renderCommentIndicator(annotation)
  }

  comment.$on('close', (_) => {
    closeComment()
  })

  comment.$on('remove', (_) => {
    console.debug('Removing annotation', annotation)
    sendPageEvent(WebViewEventSendNames.RemoveAnnotation, annotation.id)
  })

  comment.$on('updateContent', (e) => {
    console.debug('Updating annotation content', e.detail)

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
  console.debug('Opening comment', annotation)
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

    console.debug('Restoring annotation', range)
    applyRangeHighlight(range, annotationEvent.id, annotation.type)

    const commentAnnotation = {
      id: annotationEvent.id,
      range: range,
      data:
        annotation.type === 'comment' ? annotation.data : { content_plain: '', content_html: '' }
    } as AnnotationCommentRange

    console.debug('Injecting comment', commentAnnotation)
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

    //   console.debug('Injecting comment', commentAnnotation)
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

function handleScrollToAnnotation(
  data: WebViewReceiveEvents[WebViewEventReceiveNames.ScrollToAnnotation]
) {
  console.debug('Scrolling to annotation', data)
  const annotation = data.data

  const elements = document.querySelectorAll(`deta-annotation[id="${data.id}"]`)
  if (!elements) {
    console.error('Elements not found for scroll', data)
    return
  }

  console.debug('Scrolling to element', elements)
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

/**
 * We need this shitty serialization boilerplate, as we cannot ipc send DataTransfer directly..
 * Would love to do but we need to break it down to string / ArrayBuffer primitives and re-assemble
 * it in here.
 */
// function deSerializeDragData(data: {
//   strings: { type: string; value: string | undefined }[]
//   files: { name: string; type: string; buffer: ArrayBuffer | undefined }[]
// }): DataTransfer {
//   const dataTransfer = new DataTransfer()
//   dataTransfer.dropEffect = 'move'
//   dataTransfer.effectAllowed = 'all'

//   for (const str of data.strings) {
//     dataTransfer.setData(str.type, str.value ?? '')
//   }

//   for (const f of data.files) {
//     if (!f.buffer) {
//       f.buffer = new ArrayBuffer(1)
//     }

//     const file = new File([f.buffer], f.name, { type: f.type })
//     dataTransfer.items.add(file)
//   }

//   return dataTransfer
// }

// function handleSimulateDragStart(
//   data: WebViewReceiveEvents[WebViewEventReceiveNames.SimulateDragStart]
// ) {
//   console.debug('Simulating drag start', data)
//   window.dragcula = {
//     target: null,
//     dataTransfer: deSerializeDragData(data.data)
//   }
// }
// function handleSimulateDragUpdate(
//   data: WebViewReceiveEvents[WebViewEventReceiveNames.SimulateDragUpdate]
// ) {
//   const target = document.elementFromPoint(data.clientX, data.clientY)
//   if (!target) return

//   const dataTransfer = window.dragcula.dataTransfer

//   if (
//     window.dragcula.target !== target &&
//     !target.classList.contains('p-message_pane_drag_overlay')
//   ) {
//     console.log('New dragover target', target, window.dragcula.target)
//     if (window.dragcula.target !== null) {
//       const evt = new DragEvent('dragleave', {
//         relatedTarget: target !== null ? target : undefined,

//         clientX: data.clientX,
//         clientY: data.clientY,
//         screenX: data.screenX,
//         screenY: data.screenY,
//         pageX: data.pageX,
//         pageY: data.pageY,

//         dataTransfer,
//         bubbles: true
//       })
//       window.dragcula.target.dispatchEvent(evt)
//     }
//     if (target !== null) {
//       const evt = new DragEvent('dragenter', {
//         relatedTarget: window.dragcula.target !== null ? window.dragcula.target : undefined,
//         clientX: data.clientX,
//         clientY: data.clientY,
//         screenX: data.screenX,
//         screenY: data.screenY,
//         pageX: data.pageX,
//         pageY: data.pageY,

//         dataTransfer,
//         bubbles: true,
//         cancelable: true
//       })
//       target.dispatchEvent(evt)
//     }
//   }
//   if (target !== null) {
//     const evt = new DragEvent('dragover', {
//       clientX: data.clientX,
//       clientY: data.clientY,
//       screenX: data.screenX,
//       screenY: data.screenY,
//       pageX: data.pageX,
//       pageY: data.pageY,

//       dataTransfer,
//       bubbles: true,
//       cancelable: true
//     })

//     target.dispatchEvent(evt)
//     if (target.focus) target.focus()
//   }
//   window.dragcula.target = target
// }
// function handleSimulateDragEnd(
//   data: WebViewReceiveEvents[WebViewEventReceiveNames.SimulateDragEnd]
// ) {
//   console.debug('Ending Drag', data, data.data)
//   if (data.action === 'drop') {
//     const target = document.elementFromPoint(data.clientX, data.clientY)
//     if (!target) return

//     const dataTransfer = window.dragcula.dataTransfer
//     const evt = new DragEvent('drop', {
//       clientX: data.clientX,
//       clientY: data.clientY,
//       screenX: data.screenX,
//       screenY: data.screenY,
//       pageX: data.pageX,
//       pageY: data.pageY,

//       dataTransfer,
//       bubbles: true
//     })

//     target.dispatchEvent(evt)
//     if (target.focus) target.focus()
//   }
//   window.dragcula = undefined
// }

window.addEventListener('DOMContentLoaded', async (_) => {
  document.body.addEventListener('dragover', (e: DragEvent) => e.preventDefault())
  window.addEventListener('mouseup', (e: MouseEvent) => {
    const target = e.target as HTMLElement
    console.debug('mouseup', target, target.id)
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

      selectionMenu.$on('copy', (_) => {
        sendPageEvent(WebViewEventSendNames.Copy)
      })

      selectionMenu.$on('save', (e) => {
        const text = e.detail
        console.debug('Saving text', text)

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

        console.debug('Range data', rangeData)

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

      selectionMenu.$on('highlight', (_) => {
        // const selection = window.getSelection()
        // if (!selection) return
        if (!selectionRange) {
          console.error('No selection range found')
          return
        }

        // const range = selection?.getRangeAt(0)
        const rangeData = getRangeData(selectionRange)

        console.debug('Highlighting data', rangeData)

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

      selectionMenu.$on('addToChat', (e) => {
        const text = e.detail

        sendPageEvent(WebViewEventSendNames.AddToChat, text)

        if (selection && selectionRange) {
          selection.removeAllRanges()
        }

        selectionMenuWrapper?.remove()
      })

      selectionMenu.$on('comment', (e) => {
        const content = e.detail
        console.debug('Commenting', content)

        if (!selectionRange) {
          console.error('No selection range found')
          return
        }

        const rangeData = getRangeData(selectionRange)

        console.debug('Highlighting data', rangeData)

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
        const { query, type, includePageContext, isFollowUp } = e.detail
        console.debug('transforming', type, query, text)

        // re apply selection if it was removed accidentally
        if (selection && selectionRange) {
          selection.removeAllRanges()
          selection.addRange(selectionRange)
        }

        sendPageEvent(WebViewEventSendNames.Transform, {
          text,
          query,
          type,
          includePageContext,
          isFollowUp
        })
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
        console.debug('Alt key pressed, highlighting directly')
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
    console.debug('mousedown', target, target.id, target.tagName)

    if (target.tagName !== COMPONENT_WRAPPER_TAG) {
      if (selectionMenuWrapper) {
        if (selectionMenu?.canClose()) {
          console.debug('Removing selection menu')
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
      console.debug('Clicked on annotation', id, type)

      if (type === 'comment') {
        // TODO: will crash the app
        // renderComment()
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

  // runAppDetection()
})

window.addEventListener('keyup', (event: KeyboardEvent) => {
  sendPageEvent(WebViewEventSendNames.KeyUp, { key: event.key })
})

window.addEventListener('keydown', (event: KeyboardEvent) => {
  // Ignore synthetic events that are not user generated
  if (!event.isTrusted) {
    return
  }

  if (event.key === 'd' && (event.ctrlKey || event.metaKey) && event.shiftKey) {
    startResourcePicker()
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

window.addEventListener(
  'mousemove',
  (event: MouseEvent) => {
    // NOTE: Cant pass event instance directly, spread copy also fails so need to manually copy!
    // TODO: Fix missing types
    sendPageEvent(WebViewEventSendNames.MouseMove, {
      ...event,
      clientX: event.clientX,
      clientY: event.clientY,
      pageX: event.pageX,
      pageY: event.pageY,
      screenX: event.screenX,
      screenY: event.screenY,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey
    })
  },
  { passive: true, capture: true }
)

window.addEventListener(
  'mouseup',
  (event: MouseEvent) => {
    // NOTE: Cant pass event instance directly, spread copy also fails so need to manually copy!
    // TODO: Fix missing types
    sendPageEvent(WebViewEventSendNames.MouseUp, {
      ...event,
      clientX: event.clientX,
      clientY: event.clientY,
      screenX: event.screenX,
      screenY: event.screenY,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey
    })
  },
  { passive: true, capture: true }
)

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

    const resourceId = e.dataTransfer?.getData('application/vnd.space.dragcula.resourceId')
    if (!resourceId) return
    const metadata = await getDragMetadata(resourceId)
    if (!metadata) return

    const { token, resource } = metadata
    const newDataTransfer = await createNewDataTransfer(token, resource)
    if (newDataTransfer) {
      e.target!.dispatchEvent(
        new DragEvent('drop', {
          dataTransfer: newDataTransfer,
          bubbles: true,
          cancelable: true
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
    newDataTransfer.items.add(file)
    return newDataTransfer
  } catch (error) {
    console.error('error fetching file:', error)
    return null
  }
}

const handleDragEnterLeave = (eventType: 'dragenter' | 'dragleave') => {
  let isHandling = false
  return async (e: DragEvent) => {
    if (isHandling) return
    isHandling = true
    e.preventDefault()
    e.stopImmediatePropagation()

    /*const resourceId = e.dataTransfer?.getData('application/vnd.space.dragcula.resourceId')
    console.warn("resourceID", resourceId, " ??")
    if (!resourceId) {
      isHandling = false
      return
    }
    const metadata = await getDragMetadata(resourceId)
    if (!metadata) {
      isHandling = false
      return
    }*/
    //const { resource } = metadata

    //console.warn(eventType, resource.type, resource)*/

    //const dummyFile = new File([new ArrayBuffer(1)], resource.metadata?.name || 'file', { type: resource.type ?? 'application/octet-stream' })
    // TODO: (dnd): Rn we always attach a file so that the handler work correctly, this is weird tho if the drag itself has no data attached.
    const dummyFile = new File([new ArrayBuffer(1)], 'file', { type: 'application/octet-stream' })
    const newDataTransfer = new DataTransfer()
    newDataTransfer.items.add(dummyFile)

    e.target?.dispatchEvent(
      new DragEvent(eventType, {
        ...e,
        dataTransfer: newDataTransfer,
        relatedTarget: e.relatedTarget,
        bubbles: true,
        cancelable: true
      })
    )
    isHandling = false
  }
}

window.addEventListener('dragenter', handleDragEnterLeave('dragenter'), { capture: true })
window.addEventListener('dragleave', handleDragEnterLeave('dragleave'), { capture: true })

// window.addEventListener(
//   'dragover',
//   (e: DragEvent) => {
//     e.preventDefault()
//     // NOTE: Cant pass event instance directly, spread copy also fails so need to manually copy!
//     // TODO: Fix missing types
//     sendPageEvent(WebViewEventSendNames.DragOver, {
//       ...e,
//       clientX: e.clientX,
//       clientY: e.clientY,
//       pageX: e.pageX,
//       pageY: e.pageY,
//       screenX: e.screenX,
//       screenY: e.screenY,
//       altKey: e.altKey,
//       ctrlKey: e.ctrlKey,
//       metaKey: e.metaKey,
//       shiftKey: e.shiftKey
//     })
//   },
//   { capture: true } // TODO: Try no capture
// )

// // This is the "hack" we can use to detect whether we are inside / outside the webview when dragging.
// let dragDepth = 0
// window.addEventListener(
//   'dragenter',
//   (e: DragEvent) => {
//     dragDepth++
//     // Ignore stuff inside the webview
//     if (dragDepth > 1) return
//     // NOTE: Cant pass event instance directly, spread copy also fails so need to manually copy!
//     sendPageEvent(WebViewEventSendNames.DragEnter, {
//       ...e,
//       clientX: e.clientX,
//       clientY: e.clientY,
//       pageX: e.pageX,
//       pageY: e.pageY,
//       screenX: e.screenX,
//       screenY: e.screenY,
//       altKey: e.altKey,
//       ctrlKey: e.ctrlKey,
//       metaKey: e.metaKey,
//       shiftKey: e.shiftKey
//     })
//   },
//   { passive: true, capture: true }
// )

// window.addEventListener(
//   'dragleave',
//   (e: DragEvent) => {
//     dragDepth--
//     // Ignore stuff inside the webview
//     if (dragDepth > 0) return
//     dragDepth = 0
//     // NOTE: Cant pass event instance directly, spread copy also fails so need to manually copy!
//     sendPageEvent(WebViewEventSendNames.DragLeave, {
//       ...e,
//       clientX: e.clientX,
//       clientY: e.clientY,
//       pageX: e.pageX,
//       pageY: e.pageY,
//       screenX: e.screenX,
//       screenY: e.screenY,
//       altKey: e.altKey,
//       ctrlKey: e.ctrlKey,
//       metaKey: e.metaKey,
//       shiftKey: e.shiftKey
//     })
//   },
//   { passive: true, capture: true }
// )

// let once = false
// window.addEventListener(
//   'drop',
//   async (e: DragEvent) => {
//     if (once) return
//     once = true
//     e.preventDefault()
//     e.stopImmediatePropagation()
//     e.dataTransfer!.effectAllowed = 'all'
//     e.dataTransfer!.dropEffect = 'move'
//     console.warn('Dropped!', e)

//     // NOTE: Cant pass event instance directly, spread copy also fails so need to manually copy!
//     sendPageEvent(WebViewEventSendNames.Drop, {
//       ...e,
//       dataTransfer: e.dataTransfer,
//       clientX: e.clientX,
//       clientY: e.clientY,
//       pageX: e.pageX,
//       pageY: e.pageY,
//       screenX: e.screenX,
//       screenY: e.screenY,
//       altKey: e.altKey,
//       ctrlKey: e.ctrlKey,
//       metaKey: e.metaKey,
//       shiftKey: e.shiftKey
//     })

//     //console.warn("ffile", e.dataTransfer!.items[0]);

//     //const fPath = e.dataTransfer?.getData("oasis/resource");
//     //const fType = e.dataTransfer?.getData("oasis/type");
//     //const content = fs.readFileSync(fPath!)
//     //console.log("content", content)

//     //const f = new File([content.buffer], fPath!, { type: fType! });
//     const f = new File([new ArrayBuffer(1)], 'dummy', { type: 'image/png' })
//     // e.dataTransfer!.clearData()
//     const asd = new DataTransfer()

//     //e.dataTransfer!.items.add(f)
//     asd.items.add(f)
//     //asd.items.add("text/uri-list", "https://www.google.de")

//     //e.dataTransfer!.items.add(new File([blobba], 'keksaf.png', { type: 'image/png' }));
//     // for (const item of asd.items) {
//     for (const item of e.dataTransfer!.items) {
//       // e.dataTransfer!.items
//       if (item.kind === 'file') {
//         const f = item.getAsFile()!
//         console.log(`[drop] Received file of type ${item.type}`)
//         console.log(f.name, f.path, f.type, f.webkitRelativePath)
//         console.log('contents', await item.getAsFile()?.text())
//       } else {
//         item.getAsString((data) => {
//           console.log(`[drop] Received string:`, JSON.parse(data))
//         })
//       }
//     }

//     e.target!.dispatchEvent(
//       new DragEvent('drop', { dataTransfer: asd, bubbles: true, cancelable: true })
//     )
//     once = false
//     twice = false
//     trice = false
//     dragDepth = 0
//   },
//   { capture: true }
// )

// let twice = false
// window.addEventListener(
//   'dragenter',
//   (e) => {
//     // TODO: Fully spec out re-thrown events
//     if (twice) return
//     twice = true
//     console.warn('dragenter', e.target, e)
//     e.preventDefault()
//     e.stopImmediatePropagation()

//     /*const fPath = e.dataTransfer?.getData("oasis/resource");
//   const fType = e.dataTransfer?.getData("oasis/type");
//   console.error("fPath", fPath, fType)
//   const content = fs.readFileSync(fPath!)
//   console.log("content", content)*/

//     const f = new File([new ArrayBuffer(1)], 'dummy', { type: 'image/png' })
//     //console.warn(f)
//     e.dataTransfer!.clearData()
//     const asd = new DataTransfer()

//     //e.dataTransfer!.items.add(f)
//     //asd.items.add("text/uri-list", "https://www.google.de")
//     asd.items.add(f)

//     const ne = new DragEvent('dragenter', {
//       ...e,
//       dataTransfer: asd,
//       bubbles: true,
//       cancelable: true
//     })
//     e.target?.dispatchEvent(ne)
//     twice = false
//   },
//   { capture: true }
// )

// let trice = false
// window.addEventListener(
//   'dragleave',
//   (e) => {
//     if (trice) return
//     trice = true
//     console.warn('dragleave', e.target, e)
//     e.preventDefault()
//     e.stopImmediatePropagation()

//     /*const fPath = e.dataTransfer?.getData("oasis/resource");
//   const fType = e.dataTransfer?.getData("oasis/type");
//   console.error("fPath", fPath, fType)
//   const content = fs.readFileSync(fPath!)
//   console.log("content", content)*/

//     const f = new File([new ArrayBuffer(1)], 'dummy', { type: 'image/png' })
//     //console.warn(f)
//     e.dataTransfer!.clearData()
//     const asd = new DataTransfer()

//     //e.dataTransfer!.items.add(f)
//     //asd.items.add("text/uri-list", "https://www.google.de")
//     asd.items.add(f)

//     e.target?.dispatchEvent(
//       new DragEvent('dragleave', {
//         ...e,
//         dataTransfer: asd,
//         bubbles: true,
//         cancelable: true,
//         relatedTarget: e.relatedTarget
//       })
//     )
//     trice = false
//   },
//   { capture: true }
// )

window.addEventListener('focus', (_event: FocusEvent) => {
  sendPageEvent(WebViewEventSendNames.Focus)
})

function sendPageEvent<T extends keyof WebViewSendEvents>(
  name: T,
  data?: WebViewSendEvents[T]
): void {
  // Ignore mouse related passthrough to avoid spam
  if (![WebViewEventSendNames.MouseMove, WebViewEventSendNames.DragOver].includes(name))
    console.debug('Sending page event', name, data)
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
    runAppDetection()
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
  } /*else if (type === WebViewEventReceiveNames.SimulateDragStart) {
    handleSimulateDragStart(data)
  } else if (type === WebViewEventReceiveNames.SimulateDragUpdate) {
    handleSimulateDragUpdate(data)
  } else if (type === WebViewEventReceiveNames.SimulateDragEnd) {
    handleSimulateDragEnd(data)
  }*/
})

// @ts-expect-error
window.insertText = (text: string) => {
  console.debug('Inserting text', text)
  sendPageEvent(WebViewEventSendNames.InsertText, text)
}
