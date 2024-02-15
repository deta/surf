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
