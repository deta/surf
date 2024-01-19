import { app, shell, BrowserWindow, session, globalShortcut } from 'electron'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
// import { electronApp, optimizer, is } from '@electron-toolkit/utils'

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
      webSecurity: false,
      webviewTag: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
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
  console.log('sending shortcut', key)

  const window = BrowserWindow.getFocusedWindow()
  if (window) {
    window.webContents.sendInputEvent({
      type: 'keyDown',
      keyCode: key,
      modifiers: ['meta', 'ctrl'],
    })
  }
}

function registerShortcuts () {
  globalShortcut.register(`CommandOrControl+n`, () => sendShortcutToHorizon('n'))
  Array.from(Array(9).keys()).map((idx) => {
    globalShortcut.register(`CommandOrControl+${idx + 1}`, () => sendShortcutToHorizon((idx + 1).toString()))
  })
}

function unregisterShortcuts () {
  globalShortcut.unregister(`CommandOrControl+n`)
  Array.from(Array(9).keys()).map((idx) => {
    globalShortcut.unregister(`CommandOrControl+${idx + 1}`)
  })
}


app.whenReady().then(() => {
  electronApp.setAppUserModelId('space.deta')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

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
