import { app, shell, BrowserWindow, session, globalShortcut, ipcMain } from 'electron'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

const validShortcuts = ['Up', 'Down', 'Space', 'k', 'n', ...Array.from(Array(9).keys()).map((idx) => `${idx + 1}`)]

function createWindow(): void {
  const spaceSession = session.fromPartition('persist:horizon-session-v0')
  const mainWindow = new BrowserWindow({
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      session: spaceSession,
      webviewTag: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.showInactive()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // mainWindow.loadURL(
  //   process.env['ELECTRON_SPACE_URL'] ||
  //     'https://staging0.deta.space/login?redirect_uri=https%3A%2F%2Fstaging0.deta.space'
  // )
  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  registerShortcuts()
  mainWindow.on('focus', registerShortcuts)
  mainWindow.on('blur', unregisterShortcuts)
}

const sendShortcutToHorizon = (key: string) => {
  const window = BrowserWindow.getFocusedWindow()
  if (window) {
    window.webContents.sendInputEvent({
      type: 'keyDown',
      keyCode: key,
      modifiers: ['meta', 'ctrl']
    })
  }
}

function registerShortcuts() {
  validShortcuts.map((shortcut) => globalShortcut.register(`CommandOrControl+${shortcut}`, () => sendShortcutToHorizon(shortcut)))
}

function unregisterShortcuts() {
  validShortcuts.map((shortcut) => globalShortcut.unregister(`CommandOrControl+${shortcut}`))
}

async function handleCaptureWebContents() {
  console.log('capture-web-contents')
  const window = BrowserWindow.getFocusedWindow()
  if (window) {
    const PADDING = 40
    const rect = window.getContentBounds()

    const image = await window.webContents.capturePage({
      ...rect,
      x: 0,
      y: PADDING
    })
    return image.toDataURL()
  }

  return null
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('space.deta')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('capture-web-contents', handleCaptureWebContents)

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
