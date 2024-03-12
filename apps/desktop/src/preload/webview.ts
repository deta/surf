import { ipcRenderer } from 'electron'
import { WebParser, type WebAppExtractor, DetectedResource } from '@horizon/web-parser'

let mouseDownX = 0
let previouslySelectedText: string | undefined = ''
let appParser: WebAppExtractor | null = null

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
  sendPageEvent('detected-app', appInfo)

  return appParser
}

function runResourceDetection() {
  // We are intentionally re-running the app detection here since the user might have navigated to a different page since the last detection
  const appParser = runAppDetection()
  if (appParser) {
    appParser.extractResourceFromDocument(document).then((resource) => {
      console.log('Resource', resource)
      console.log('Sending detected-resource event')
      sendPageEvent('detected-resource', { resource })
    })
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

        sendPageEvent('detected-resource', { resource })
      })
    } else {
      console.warn('App does not need/support resource picking')
      sendPageEvent('detected-resource', { resource: null })
    }
  }
}

window.addEventListener('DOMContentLoaded', async (_) => {
  window.addEventListener('mouseup', (e: MouseEvent) => {
    const selection = window.getSelection()
    const text = selection?.toString().trim()
    const bodyBackgroundColor = getComputedStyle(document.body).backgroundColor ?? 'white'

    const mouseUpX = e.clientX
    const direction = mouseUpX > mouseDownX ? 'left-to-right' : 'right-to-left'
    const movement = Math.abs(mouseUpX - mouseDownX)

    let offset
    if (movement < 10) {
      offset = 10
    } else {
      offset = direction === 'left-to-right' ? 10 : -35
    }

    // check if text is available and if the selection has changed
    if (text && text != previouslySelectedText) {
      const oldDiv = document.getElementById('horizonTextDragHandle')
      oldDiv?.parentNode?.removeChild(oldDiv)

      const div = document.createElement('div')
      div.id = 'horizonTextDragHandle'
      div.style.display = 'flex'
      div.style.alignItems = 'center'
      div.style.justifyContent = 'center'
      div.style.width = '30px'
      div.style.height = '30px'
      div.style.cursor = 'grab'
      div.style.borderRadius = '50%'
      div.style.padding = '2px 0 0 2px'
      div.style.borderRadius = '3px'
      div.style.background = 'color-mix(in srgb, #F73B95 95%, ' + bodyBackgroundColor + ')'
      div.style.boxShadow =
        '0px 1px 3px 0px rgba(0, 0, 0, 0.15), 0px 0px 0.5px 0px rgba(0, 0, 0, 0.30)'
      div.style.position = 'absolute'
      div.style.zIndex = '100000'
      div.style.left = `${e.clientX + window.scrollX + offset}px`
      div.style.top = `${e.clientY + window.scrollY - 15}px`
      div.style.opacity = '0' // Set initial opacity to 0
      div.style.transition = 'opacity 0.2s ease' // Add transition for opacity
      div.draggable = true

      div.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 7 7" fill="none" xmlns="http://www.w3.org/2000/svg" style="pointer-events: none;">
          <circle cx="3.125" cy="0.625" r="0.625" fill="white"/>
          <circle cx="0.625" cy="3.125" r="0.625" fill="white"/>
          <circle cx="3.125" cy="3.125" r="0.625" fill="white"/>
          <circle cx="5.625" cy="3.125" r="0.625" fill="white"/>
          <circle cx="3.125" cy="5.625" r="0.625" fill="white"/>
        </svg>`

      document.body.appendChild(div)

      // Animate in on appear
      setTimeout(() => {
        div.style.opacity = '1'
        window.addEventListener('mousedown', () => {
          return
        })
      }, 120)

      // Create and style tooltip
      const tooltip = document.createElement('div')
      tooltip.innerText = 'Drag me out!' // Tooltip text
      tooltip.style.position = 'absolute'
      tooltip.style.padding = '5px'
      tooltip.style.display = 'flex'
      tooltip.style.alignItems = 'center'
      tooltip.style.justifyContent = 'center'
      tooltip.style.background = 'black'
      tooltip.style.color = 'white'
      tooltip.style.borderRadius = '4px'
      tooltip.style.fontSize = '0.75rem'
      tooltip.style.visibility = 'hidden' // Initially hidden
      tooltip.style.whiteSpace = 'nowrap' // Keep text in one line
      tooltip.id = 'horizonTextTooltip'

      div.appendChild(tooltip)

      // Show tooltip on hover and position it dynamically
      div.addEventListener('mouseover', () => {
        tooltip.style.visibility = 'visible'

        // Calculate width of the tooltip after it renders
        const tooltipWidth = tooltip.offsetWidth

        // Center tooltip below the drag handle
        tooltip.style.left = `calc(50% - ${tooltipWidth / 2}px)`
        tooltip.style.bottom = '-2rem'
      })

      // Hide tooltip when not hovering
      div.addEventListener('mouseout', () => {
        tooltip.style.visibility = 'hidden'
      })

      div.addEventListener('dragstart', (event: DragEvent) => {
        event.stopPropagation()
        event.dataTransfer?.setData('text/plain', text)
        event.dataTransfer?.setData('text/space-source', window.location.href)
      })

      // reset previously selected text after delay, so the user can actually select the same text again.
      previouslySelectedText = ''
    }

    previouslySelectedText = text
  })

  // When a text is selected and the user starts typing again, disable the handle again
  window.addEventListener('keydown', () => {
    const div = document.getElementById('horizonTextDragHandle')
    div?.parentNode?.removeChild(div)
  })

  window.addEventListener('mousedown', (e: MouseEvent) => {
    mouseDownX = e.clientX // Store the X-coordinate on mousedown

    // ...existing mousedown functionality
    const div = document.getElementById('horizonTextDragHandle')
    if (div && e.target !== div) {
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
  sendPageEvent('keyup', { key: event.key })
})

window.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === 'd' && (event.ctrlKey || event.metaKey) && event.shiftKey) {
    startResourcePicker()
  }

  sendPageEvent('keydown', {
    key: event.key,
    code: event.code,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey
  })
})

window.addEventListener('wheel', (event: WheelEvent) => {
  sendPageEvent('wheel', {
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
  sendPageEvent('focus', {})
})

function sendPageEvent(eventType: string, data: any) {
  ipcRenderer.sendToHost('webview-page-event', eventType, data)
}

ipcRenderer.on('webview-event', (_event, data) => {
  if (data.type === 'get-selection') {
    const selection = window.getSelection()
    const text = selection?.toString().trim()

    ipcRenderer.sendToHost('selection', text)
  } else if (data.type === 'get-resource') {
    runResourceDetection()
  } else if (data.type === 'get-app') {
    runAppDetection()
  }
})
