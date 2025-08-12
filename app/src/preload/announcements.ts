import { IPC_EVENTS_RENDERER } from '@deta/services/src/ipc/events'
import { contextBridge, shell } from 'electron'

contextBridge.exposeInMainWorld('announcementsAPI', {
  getAnnouncements: async () => {
    return await IPC_EVENTS_RENDERER.getAnnouncements.invoke()
  }
})

contextBridge.exposeInMainWorld('electron', {
  openUrl: async (url: string) => {
    try {
      const urlObj = new URL(url)

      // Only allow http and https protocols
      if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
        return await shell.openExternal(url)
      } else {
        console.warn(`Blocked attempt to open URL with unauthorized protocol: ${urlObj.protocol}`)
      }
    } catch (error) {
      console.warn('Invalid URL:', url)
    }
  }
})
