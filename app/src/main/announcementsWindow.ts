import { BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { isMac } from '@horizon/utils'

let AnnouncementsWindow: BrowserWindow | undefined

export const announcementsEntryPoint = join(__dirname, '../renderer')

export function createAnnouncementsWindow() {
  if (AnnouncementsWindow && !AnnouncementsWindow.isDestroyed()) {
    AnnouncementsWindow.show()
    return
  }

  AnnouncementsWindow = new BrowserWindow({
    width: 1000,
    height: 1000,
    fullscreenable: true,
    show: false,
    resizable: true,
    movable: true,
    title: 'Announcements',
    frame: !isMac(),
    trafficLightPosition: { x: 14, y: 14 },
    titleBarStyle: isMac() ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/announcements.js'),
      defaultFontSize: 14,
      webviewTag: false,
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  AnnouncementsWindow.setMenu(null)

  AnnouncementsWindow.on('ready-to-show', () => {
    AnnouncementsWindow?.show()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    AnnouncementsWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/announcements.html`)
  } else {
    AnnouncementsWindow.loadFile(join(announcementsEntryPoint, 'announcements.html'))
  }
}

export function getAnnouncementsWindow() {
  return AnnouncementsWindow
}

export function closeAnnouncementsWindow() {
  AnnouncementsWindow?.close()
}
