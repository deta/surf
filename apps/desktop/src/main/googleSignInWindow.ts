import { BrowserWindow, session } from 'electron'
import { getMainWindow } from './mainWindow'
import { isGoogleSignInUrl } from '@horizon/utils'

let signInWindow: BrowserWindow | null = null

export function getGoogleSignInWindowId(): number | undefined {
  return signInWindow?.webContents.id
}

export function createGoogleSignInWindow(url: string): Promise<string | null> {
  return new Promise((resolve, _reject) => {
    if (signInWindow) {
      signInWindow.show()
      resolve(null)
      return
    }
    let isResolved = false

    signInWindow = new BrowserWindow({
      width: 1024,
      height: 768,
      closable: true,
      modal: true,
      parent: getMainWindow(),
      webPreferences: {
        partition: 'persist:horizon',
        sandbox: true,
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    signInWindow.loadURL(url)

    // not `close`
    signInWindow.on('closed', () => {
      signInWindow = null
      if (!isResolved) resolve(null)
    })
    signInWindow.webContents.on('did-navigate', (_, url) => {
      if (!isGoogleSignInUrl(url ?? '')) {
        resolve(url)
        isResolved = true
        signInWindow?.close()
      }
    })
    // signInWindow.on('error', (error) => {
    //   // What kind of errors should I handle here, maybe reject on timeout?
    //   reject(error)
    // })

    if (process.platform === 'darwin') {
      signInWindow.webContents.on('did-finish-load', () => {
        if (isResolved) return
        signInWindow?.webContents.executeJavaScript(`
          const style = document.createElement('style');
          style.textContent = \`
            .mac-close-button {
              position: fixed;
              top: 10px;
              left: 10px;
              width: 12px;
              height: 12px;
              border-radius: 50%;
              background-color: #ff5f57;
              border: 1px solid #e33e32;
              box-shadow: 0 0 1px rgba(0, 0, 0, 0.2);
              z-index: 9999;
              cursor: pointer;
              transition: all 0.1s ease;
            }
            .mac-close-button:hover {
              background-color: #ff7b72;
            }
            .mac-close-button:active {
              background-color: #bf4943;
              border-color: #ad3934;
            }
          \`;
          document.head.appendChild(style);

          const closeButton = document.createElement('div');
          closeButton.className = 'mac-close-button';
          closeButton.addEventListener('click', () => {
            window.close();
          });
          document.body.appendChild(closeButton);
      `)
      })
    }
  })
}
