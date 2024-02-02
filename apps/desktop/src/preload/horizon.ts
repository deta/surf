import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { join } from 'path'
import fetch from 'cross-fetch'

const api = {
  webviewPreloadPath: join(__dirname, '../preload/webview.js'),
  captureWebContents: () => ipcRenderer.invoke('capture-web-contents'),
  onNewWindowRequest: (callback) => {
    ipcRenderer.on('new-window-request', (_, data) => {
      callback(data)
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
