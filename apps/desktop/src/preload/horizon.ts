import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { join } from 'path'
import fetch from 'cross-fetch'

const webviewNewWindowHandlers = {}

const api = {
  webviewDevToolsBtn: !import.meta.env.PROD || !!process.env.WEBVIEW_DEV_TOOLS_BTN,
  webviewPreloadPath: join(__dirname, '../preload/webview.js'),
  captureWebContents: () => ipcRenderer.invoke('capture-web-contents'),
  getAdblockerState: (partition: string) =>
    ipcRenderer.invoke('get-adblocker-state', { partition }),
  toggleAdblocker: (partition: string) => ipcRenderer.invoke('toggle-adblocker', { partition }),

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

  onNewPreviewImage: (callback: any) => {
    ipcRenderer.on('new-preview-image', (_, { horizonId, buffer, width, height }) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      canvas
        ?.getContext('2d')
        ?.putImageData(new ImageData(new Uint8ClampedArray(buffer.buffer), width, height), 0, 0)
      canvas.toBlob((blob) => callback(horizonId, blob), 'image/png', 0.7)
    })
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
