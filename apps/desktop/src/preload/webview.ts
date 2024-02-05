import { ipcRenderer } from 'electron'

window.addEventListener('DOMContentLoaded', (_) => {
  window.addEventListener('mouseup', (e: MouseEvent) => {
    const selection = window.getSelection()
    const text = selection?.toString().trim()

    if (text) {
      const oldDiv = document.getElementById('horizonTextDragHandle')
      oldDiv?.parentNode?.removeChild(oldDiv)

      const div = document.createElement('div')
      div.id = 'horizonTextDragHandle'
      div.style.width = '30px'
      div.style.height = '30px'
      div.style.background = 'blue'
      div.style.position = 'absolute'
      div.style.left = `${e.clientX + window.scrollX}px`
      div.style.top = `${e.clientY + window.scrollY - 30}px`
      div.draggable = true

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
