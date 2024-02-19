import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { join } from 'path'
import fetch from 'cross-fetch'

const webviewNewWindowHandlers = {}
const previewImageHandlers = {}

const api = {
  webviewDevToolsBtn: !import.meta.env.PROD || !!process.env.WEBVIEW_DEV_TOOLS_BTN,
  webviewPreloadPath: join(__dirname, '../preload/webview.js'),
  captureWebContents: () => ipcRenderer.invoke('capture-web-contents'),
  getAdblockerState: (partition: string) =>
    ipcRenderer.invoke('get-adblocker-state', { partition }),
  setAdblockerState: (partition: string, state: boolean) =>
    ipcRenderer.invoke('set-adblocker-state', { partition, state }),

  registerNewWindowHandler: (webContentsId: number, callback: any) => {
    webviewNewWindowHandlers[webContentsId] = callback
  },
  unregisterNewWindowHandler: (webContentsId: number) => {
    if (webviewNewWindowHandlers[webContentsId]) {
      delete webviewNewWindowHandlers[webContentsId]
    }
  },
  requestNewPreviewImage: (horizonId: string) =>
    ipcRenderer.invoke('request-new-preview-image', { horizonId }),

  registerPreviewImageHandler: (horizonId: string, callback: any) => {
    previewImageHandlers[horizonId] = callback
  },
  unregisterPreviewImageHandler: (horizonId: string) => {
    if (previewImageHandlers[horizonId]) {
      delete previewImageHandlers[horizonId]
    }
  },

  fetchAsDataURL: async (url: string) => {
    try {
      const response = await fetch(url)
      const arrayBuffer = await response.arrayBuffer()
      const type = response.headers.get('Content-Type')
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      const dataUrl = `data:${type};base64,${base64}`
      return dataUrl
    } catch (error) {
      throw error
    }
  }
}

ipcRenderer.on('new-window-request', (_, { webContentsId, ...data }) => {
  const handler = webviewNewWindowHandlers[webContentsId]
  if (handler) {
    handler(data)
  }
})

ipcRenderer.on('new-preview-image', (_, { horizonId, buffer, width, height }) => {
  const handler = previewImageHandlers[horizonId]
  if (!handler) return

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  buffer = new Uint8ClampedArray(buffer.buffer)
  for (let i = 0; i < buffer.length; i += 4) {
    let temp = buffer[i]
    buffer[i] = buffer[i + 2]
    buffer[i + 2] = temp
  }

  canvas?.getContext('2d')?.putImageData(new ImageData(buffer, width, height), 0, 0)
  canvas.toBlob((blob) => handler(blob), 'image/png', 0.7)
})

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
