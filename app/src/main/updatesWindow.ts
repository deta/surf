import { BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { isMac } from '@horizon/utils'

let updatesWindow: BrowserWindow | undefined

export const updatesEntryPoint = join(__dirname, '../renderer')

export function createUpdatesWindow() {
  if (updatesWindow && !updatesWindow.isDestroyed()) {
    updatesWindow.show()
    return
  }

  updatesWindow = new BrowserWindow({
    width: 500,
    height: 500,
    fullscreenable: false,
    show: false,
    resizable: true,
    autoHideMenuBar: false,
    title: 'Update',
    frame: !isMac(),
    trafficLightPosition: { x: 14, y: 14 },
    titleBarStyle: isMac() ? 'hidden' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/updates.js'),
      defaultFontSize: 14,
      webviewTag: false,
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  updatesWindow.setMenu(null)

  updatesWindow.on('ready-to-show', () => {
    updatesWindow?.show()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    updatesWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/updates.html`)
  } else {
    updatesWindow.loadFile(join(updatesEntryPoint, 'updates.html'))
  }
}

export function sendUpdateProgressStatus(progressPercent: number) {
  updatesWindow?.webContents.send('update-progress', progressPercent)
}

export function sendUpdateErrorStatus(errorMessage: string) {
  updatesWindow?.webContents.send('update-error', errorMessage)
}

export function closeUpdatesWindow() {
  updatesWindow?.close()
}

export function mockUpdatesWindow() {
  createUpdatesWindow()
  let progress = 0
  setInterval(() => {
    progress += 10
    if (progress > 100) {
      progress = 0
    }
    sendUpdateProgressStatus(progress)
  }, 2000)
}
