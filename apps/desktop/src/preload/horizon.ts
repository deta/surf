import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { join } from 'path'

const api = {}

const captureWebContents = () => {
  return ipcRenderer.invoke('capture-web-contents')
}

export const mainWorld = {
  captureWebContents: captureWebContents,
  webviewPreloadPath: join(__dirname, '../preload/webview.js')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)

    contextBridge.exposeInMainWorld('electronAPI', mainWorld)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
