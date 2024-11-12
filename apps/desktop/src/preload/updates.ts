import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('updatesAPI', {
  onUpdateProgress: (callback: (progress: number) => void) =>
    ipcRenderer.on('update-progress', (_event, value) => callback(value)),

  removeUpdateProgressListener: () => ipcRenderer.removeAllListeners('update-progress')
})
