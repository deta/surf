import { ipcRenderer } from 'electron'
import {
  WebParser,
  type WebAppExtractor,
  DetectedResource,
  WebAppExtractorActions,
  WebServiceActionInputs
} from '@horizon/web-parser'
import Menu from './Menu.svelte'
import { WebViewEventReceiveNames, WebViewEventSendNames, WebViewSendEvents } from '@horizon/types'

// let mouseDownX = 0
let previouslySelectedText: string | undefined = ''
let appParser: WebAppExtractor | null = null
let selectionMenu: Menu | null = null

function runAppDetection() {
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
      const oldDiv = document.getElementById('horizonTextDragHandle')
      console.log('old div', oldDiv)
      oldDiv?.parentNode?.removeChild(oldDiv)

      const div = document.createElement('div')
      div.id = 'horizonTextDragHandle'
      // div.style.display = 'flex'
      // div.style.alignItems = 'center'
      // div.style.justifyContent = 'center'
      // div.style.width = '30px'
      // div.style.height = '30px'
      // div.style.cursor = 'grab'
      // div.style.borderRadius = '50%'
      // div.style.padding = '2px 0 0 2px'
      // div.style.borderRadius = '3px'
      // div.style.background = 'color-mix(in srgb, #F73B95 95%, ' + bodyBackgroundColor + ')'
      // div.style.boxShadow =
      //   '0px 1px 3px 0px rgba(0, 0, 0, 0.15), 0px 0px 0.5px 0px rgba(0, 0, 0, 0.30)'
      div.style.position = 'absolute'
      div.style.zIndex = '100000'
      div.style.left = `${selectionRect.left + window.scrollX}px`
      div.style.top = `${selectionRect.bottom + window.scrollY}px`
      div.style.transform = 'translateY(15px)'
      div.style.opacity = '0' // Set initial opacity to 0
      div.style.transition = 'opacity 0.2s ease' // Add transition for opacity
      div.style.pointerEvents = 'none'
      // div.draggable = true

      // div.innerHTML = `
      //   <svg width="16" height="16" viewBox="0 0 7 7" fill="none" xmlns="http://www.w3.org/2000/svg" style="pointer-events: none;">
      //     <circle cx="3.125" cy="0.625" r="0.625" fill="white"/>
      //     <circle cx="0.625" cy="3.125" r="0.625" fill="white"/>
      //     <circle cx="3.125" cy="3.125" r="0.625" fill="white"/>
      //     <circle cx="5.625" cy="3.125" r="0.625" fill="white"/>
      //     <circle cx="3.125" cy="5.625" r="0.625" fill="white"/>
      //   </svg>`

      document.body.appendChild(div)

      const shadow = div.attachShadow({ mode: 'open' })

      // const componentWrapper = document.createElement('div')
      // shadow.appendChild(componentWrapper)

      const webviewStyles = document.getElementById('webview-styles')
      if (webviewStyles) {
        shadow.appendChild(webviewStyles.cloneNode(true))
      }

      selectionMenu = new Menu({
        target: shadow,
        props: {
          text: text
        }
      })

      selectionMenu.$on('bookmark', (e) => {
        const text = e.detail
        console.log('Bookmarking', text)

        // re apply selection if it was removed accidentally
        if (selection && selectionRange) {
          selection.removeAllRanges()
          selection.addRange(selectionRange)
        }

        sendPageEvent(WebViewEventSendNames.Bookmark, { text, url: window.location.href })
      })

      selectionMenu.$on('transform', (e) => {
        const { query, type } = e.detail
        console.log('transforming', type, query, text)

        // re apply selection if it was removed accidentally
        if (selection && selectionRange) {
          selection.removeAllRanges()
          selection.addRange(selectionRange)
        }

        sendPageEvent(WebViewEventSendNames.Transform, { text, query, type })
      })

      selectionMenu.$on('insert', (e) => {
        // re apply selection if it was removed accidentally
        if (selection && selectionRange) {
          selection.removeAllRanges()
          selection.addRange(selectionRange)
        }

        sendPageEvent(WebViewEventSendNames.InlineTextReplace, { target: text, content: e.detail })
      })

      // Animate in on appear
      setTimeout(() => {
        div.style.opacity = '1'
        window.addEventListener('mousedown', () => {
          return
        })
      }, 120)

      // Create and style tooltip
      // const tooltip = document.createElement('div')
      // tooltip.innerText = 'Drag me out!' // Tooltip text
      // tooltip.style.position = 'absolute'
      // tooltip.style.padding = '5px'
      // tooltip.style.display = 'flex'
      // tooltip.style.alignItems = 'center'
      // tooltip.style.justifyContent = 'center'
      // tooltip.style.background = 'black'
      // tooltip.style.color = 'white'
      // tooltip.style.borderRadius = '4px'
      // tooltip.style.fontSize = '0.75rem'
      // tooltip.style.visibility = 'hidden' // Initially hidden
      // tooltip.style.whiteSpace = 'nowrap' // Keep text in one line
      // tooltip.id = 'horizonTextTooltip'

      // div.appendChild(tooltip)

      // Show tooltip on hover and position it dynamically
      // div.addEventListener('mouseover', () => {
      //   tooltip.style.visibility = 'visible'

      //   // Calculate width of the tooltip after it renders
      //   const tooltipWidth = tooltip.offsetWidth

      //   // Center tooltip below the drag handle
      //   tooltip.style.left = `calc(50% - ${tooltipWidth / 2}px)`
      //   tooltip.style.bottom = '-2rem'
      // })

      // Hide tooltip when not hovering
      // div.addEventListener('mouseout', () => {
      //   tooltip.style.visibility = 'hidden'
      // })

      // div.addEventListener('dragstart', (event: DragEvent) => {
      //   event.stopPropagation()
      //   event.dataTransfer?.setData('text/plain', text)
      //   event.dataTransfer?.setData('text/space-source', window.location.href)
      // })

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
    console.log('mousedown', target, target.id)

    // ...existing mousedown functionality
    const div = document.getElementById('horizonTextDragHandle')
    if (div && target.id !== 'horizonTextDragHandle') {
      div.parentNode?.removeChild(div)
    }
  })

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
    runAppDetection()
  } else if (type === WebViewEventReceiveNames.RunAction) {
    runServiceAction(data.id, data.inputs)
  } else if (type === WebViewEventReceiveNames.TransformationOutput) {
    handleTransformOutput(data.text)
  }
})

// @ts-expect-error
window.insertText = (text: string) => {
  console.log('Inserting text', text)
  sendPageEvent(WebViewEventSendNames.InsertText, text)
}
