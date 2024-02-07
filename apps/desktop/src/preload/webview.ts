import { ipcRenderer } from 'electron'
import { twoFingers, type Gesture } from '@horizon/core/src/lib/utils/two-fingers'

let mouseDownX = 0; 

window.addEventListener('DOMContentLoaded', (_) => {
  window.addEventListener('mouseup', (e: MouseEvent) => {
    const selection = window.getSelection()
    const text = selection?.toString().trim()
    const bodyBackgroundColor = getComputedStyle(document.body).backgroundColor ?? 'white'

    const mouseUpX = e.clientX;
    const direction = mouseUpX > mouseDownX ? 'left-to-right' : 'right-to-left';
    const movement = Math.abs(mouseUpX - mouseDownX); // Calculate the absolute mouse movement

    let offset;
    if (movement < 10) {
      offset = 10;
    } else {
      offset = direction === 'left-to-right' ? 10 : -35;
    }

    if (text) {
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
      div.style.zIndex = '100000000000'
      div.style.left = `${e.clientX + window.scrollX + offset}px`
      div.style.top = `${e.clientY + window.scrollY - 15}px`
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

      div.addEventListener('dragstart', (event: DragEvent) => {
        event.stopPropagation()
        event.dataTransfer?.setData('text/plain', text)
      })
    }
  })

  window.addEventListener('mousedown', (e: MouseEvent) => {
    mouseDownX = e.clientX; // Store the X-coordinate on mousedown

    // ...existing mousedown functionality
    const div = document.getElementById('horizonTextDragHandle')
    if (div && e.target !== div) {
      div.parentNode?.removeChild(div)
      window.getSelection()?.removeAllRanges()
    }
  });

  document.addEventListener('dragend', () => {
    const div = document.getElementById('horizonTextDragHandle')
    div?.parentNode?.removeChild(div)
    window.getSelection()?.removeAllRanges()
  })
})

twoFingers(window as unknown as HTMLElement, {
  onGestureEnd: (gesture: Gesture) => {
    sendPageEvent('pinch', gesture)
  }
})

window.addEventListener('keyup', (event: KeyboardEvent) => {
  sendPageEvent('keyup', { key: event.key })
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
  ipcRenderer.sendToHost('webview-page-event', { type: eventType, ...data })
}
