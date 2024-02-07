import { ipcRenderer } from 'electron'
import { twoFingers, type Gesture } from '@horizon/core/src/lib/utils/two-fingers'

window.addEventListener('DOMContentLoaded', (_) => {
  window.addEventListener('mouseup', (e: MouseEvent) => {
    const selection = window.getSelection()
    
    const text = selection?.toString().trim()

    const bodyBackgroundColor = getComputedStyle(document.body).backgroundColor ?? 'white';
    console.debug("[WEBVIEW] Recieving Background Color: ", bodyBackgroundColor)


    if (text) {
      console.log("++++ TEXT DND FIRED ++++", "Selected:, ", selection)
      const oldDiv = document.getElementById('horizonTextDragHandle')
      oldDiv?.parentNode?.removeChild(oldDiv)

      const div = document.createElement('div')
      div.id = 'horizonTextDragHandle'
      div.style.display = 'flex'
      div.style.alignItems = 'center'
      div.style.justifyContent = 'center'
      div.style.width = '30px'
      div.style.height = '30px'
      div.style.borderRadius = '50%'
      div.style.padding = '2px 0 0 2px'
      div.style.borderRadius = '3px'
      div.style.background = 'color-mix(in srgb, #F73B95 80%, ' + bodyBackgroundColor + ')'
      div.style.boxShadow = '0px 1px 3px 0px rgba(0, 0, 0, 0.15), 0px 0px 0.5px 0px rgba(0, 0, 0, 0.30)'
      div.style.position = 'absolute'
      div.style.zIndex = '1000'
      div.style.left = `${e.clientX + window.scrollX}px`
      div.style.top = `${e.clientY + window.scrollY - 30}px`
      div.draggable = true

      div.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 7 7" fill="none" xmlns="http://www.w3.org/2000/svg" style="pointer-events: none;">
          <circle cx="3.125" cy="0.625" r="0.625" fill="white"/>
          <circle cx="0.625" cy="3.125" r="0.625" fill="white"/>
          <circle cx="3.125" cy="3.125" r="0.625" fill="white"/>
          <circle cx="5.625" cy="3.125" r="0.625" fill="white"/>
          <circle cx="3.125" cy="5.625" r="0.625" fill="white"/>
        </svg>`;

      document.body.appendChild(div)

      div.addEventListener('dragstart', (event: DragEvent) => {
        event.dataTransfer?.setData('text/plain', text)
      })
    }
  })

  document.addEventListener('mousedown', (e: MouseEvent) => {
    const div = document.getElementById('horizonTextDragHandle')
    if (div && e.target !== div) {
      div.parentNode?.removeChild(div)
      window.getSelection()?.removeAllRanges()
    }
  })

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
