import { ipcRenderer } from 'electron'

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

function sendPageEvent(eventType: string, data: any) {
  ipcRenderer.sendToHost('webview-page-event', { type: eventType, ...data })
}
