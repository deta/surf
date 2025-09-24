import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { isMac } from '@deta/utils/system'
import { UpdatesWindowEntryPoint } from './utils'

let updatesWindow: BrowserWindow | undefined

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
      additionalArguments: [
        `--userDataPath=${app.getPath('userData')}`,
        `--updates-window-entry-point=${UpdatesWindowEntryPoint}`
      ],
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
  updatesWindow.loadURL(UpdatesWindowEntryPoint)
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
