/* BEGIN Chrome Web Store API */
import { ipcRenderer, contextBridge, webFrame } from 'electron'

const ExtensionInstallStatus = {
  BLACKLISTED: 'blacklisted',
  BLOCKED_BY_POLICY: 'blocked_by_policy',
  CAN_REQUEST: 'can_request',
  CORRUPTED: 'corrupted',
  CUSTODIAN_APPROVAL_REQUIRED: 'custodian_approval_required',
  CUSTODIAN_APPROVAL_REQUIRED_FOR_INSTALLATION: 'custodian_approval_required_for_installation',
  DEPRECATED_MANIFEST_VERSION: 'deprecated_manifest_version',
  DISABLED: 'disabled',
  ENABLED: 'enabled',
  FORCE_INSTALLED: 'force_installed',
  INSTALLABLE: 'installable',
  REQUEST_PENDING: 'request_pending',
  TERMINATED: 'terminated'
}

const MV2DeprecationStatus = {
  INACTIVE: 'inactive',
  SOFT_DISABLE: 'soft_disable',
  WARNING: 'warning'
}

const Result = {
  ALREADY_INSTALLED: 'already_installed',
  BLACKLISTED: 'blacklisted',
  BLOCKED_BY_POLICY: 'blocked_by_policy',
  BLOCKED_FOR_CHILD_ACCOUNT: 'blocked_for_child_account',
  FEATURE_DISABLED: 'feature_disabled',
  ICON_ERROR: 'icon_error',
  INSTALL_ERROR: 'install_error',
  INSTALL_IN_PROGRESS: 'install_in_progress',
  INVALID_ICON_URL: 'invalid_icon_url',
  INVALID_ID: 'invalid_id',
  LAUNCH_IN_PROGRESS: 'launch_in_progress',
  MANIFEST_ERROR: 'manifest_error',
  MISSING_DEPENDENCIES: 'missing_dependencies',
  SUCCESS: 'success',
  UNKNOWN_ERROR: 'unknown_error',
  UNSUPPORTED_EXTENSION_TYPE: 'unsupported_extension_type',
  USER_CANCELLED: 'user_cancelled',
  USER_GESTURE_REQUIRED: 'user_gesture_required'
}

const WebGlStatus = {
  WEBGL_ALLOWED: 'webgl_allowed',
  WEBGL_BLOCKED: 'webgl_blocked'
}

interface WebstorePrivate {
  ExtensionInstallStatus: typeof ExtensionInstallStatus
  MV2DeprecationStatus: typeof MV2DeprecationStatus
  Result: typeof Result
  WebGlStatus: typeof WebGlStatus

  beginInstallWithManifest3: (
    details: unknown,
    callback?: (result: string) => void
  ) => Promise<string>
  completeInstall: (id: string, callback?: (result: string) => void) => Promise<string>
  enableAppLauncher: (enable: boolean, callback?: (result: boolean) => void) => Promise<boolean>
  getBrowserLogin: (callback?: (result: string) => void) => Promise<string>
  getExtensionStatus: (
    id: string,
    manifestJson: string,
    callback?: (status: string) => void
  ) => Promise<string>
  getFullChromeVersion: (callback?: (result: string) => void) => Promise<{
    version_number: string
    app_name: string
  }>
  getIsLauncherEnabled: (callback?: (result: boolean) => void) => Promise<boolean>
  getMV2DeprecationStatus: (callback?: (result: string) => void) => Promise<string>
  getReferrerChain: (callback?: (result: unknown[]) => void) => Promise<unknown[]>
  getStoreLogin: (callback?: (result: string) => void) => Promise<string>
  getWebGLStatus: (callback?: (result: string) => void) => Promise<string>
  install: (
    id: string,
    silentInstall: boolean,
    callback?: (result: string) => void
  ) => Promise<string>
  isInIncognitoMode: (callback?: (result: boolean) => void) => Promise<boolean>
  isPendingCustodianApproval: (id: string, callback?: (result: boolean) => void) => Promise<boolean>
  setStoreLogin: (login: string, callback?: (result: boolean) => void) => Promise<boolean>
}

function updateBranding(appName: string) {
  const update = () => {
    requestAnimationFrame(() => {
      const chromeButtons = Array.from(document.querySelectorAll('span')).filter((node) =>
        node.innerText.includes('Chrome')
      )

      for (const button of chromeButtons) {
        button.innerText = button.innerText.replace('Chrome', appName)
      }

      const switchChromeElements = Array.from(document.querySelectorAll('div')).filter((element) =>
        element.textContent
          ?.toLowerCase()
          .includes('switch to chrome to install extensions and themes')
      )
      switchChromeElements.forEach((element) => element.remove())
    })
  }

  // Try twice to ensure branding changes
  update()
  setTimeout(update, 1000 / 60)
}

function getUAProductVersion(userAgent: string, product: string) {
  const regex = new RegExp(`${product}/([\\d.]+)`)
  return userAgent.match(regex)?.[1]
}

function overrideUserAgent() {
  const chromeVersion = getUAProductVersion(navigator.userAgent, 'Chrome') || '133.0.6920.0'
  const userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`

  const funcStr = `/* javascript
    function(userAgent) {
      Object.defineProperty(navigator, 'userAgent', { value: userAgent })
    }
  */`
    .replace('/* javascript', '')
    .replace('*/', '')
    .trim()

  webFrame.executeJavaScript(`(${funcStr})(${JSON.stringify(userAgent)});`)
}

export function setupChromeWebStoreApi() {
  let appName: string | undefined

  const setAppName = (name: string) => {
    appName = name
    updateBranding(appName)
  }

  const maybeUpdateBranding = () => {
    if (appName) updateBranding(appName)
  }

  const setExtensionError = (message?: string) => {
    webFrame.executeJavaScript(`
      if (typeof chrome !== 'undefined') {
        if (!chrome.extension) chrome.extension = {};
        chrome.extension.lastError = ${JSON.stringify(message ? { message } : null)};
      }
    `)
  }

  /**
   * Implementation of Chrome's webstorePrivate for Electron.
   */
  const electronWebstore: WebstorePrivate = {
    ExtensionInstallStatus,
    MV2DeprecationStatus,
    Result,
    WebGlStatus,

    beginInstallWithManifest3: async (details, callback) => {
      console.log('webstorePrivate.beginInstallWithManifest3', details)
      const { result, message } = await ipcRenderer.invoke('chromeWebstore.beginInstall', details)
      console.log('webstorePrivate.beginInstallWithManifest3 result:', result)
      setExtensionError(result === Result.SUCCESS ? null : message)
      if (callback) callback(result)
      return result
    },

    completeInstall: async (id, callback) => {
      console.log('webstorePrivate.completeInstall', id)
      const result = await ipcRenderer.invoke('chromeWebstore.completeInstall', id)
      console.log('webstorePrivate.completeInstall result:', result)
      if (callback) callback(result)
      maybeUpdateBranding()
      return result
    },

    enableAppLauncher: async (enable, callback) => {
      console.log('webstorePrivate.enableAppLauncher', enable)
      const result = await ipcRenderer.invoke('chromeWebstore.enableAppLauncher', enable)
      console.log('webstorePrivate.enableAppLauncher result:', result)
      if (callback) callback(result)
      return result
    },

    getBrowserLogin: async (callback) => {
      console.log('webstorePrivate.getBrowserLogin called')
      const result = await ipcRenderer.invoke('chromeWebstore.getBrowserLogin')
      console.log('webstorePrivate.getBrowserLogin result:', result)
      if (callback) callback(result)
      return result
    },

    getExtensionStatus: async (id, manifestJson, callback) => {
      console.log('webstorePrivate.getExtensionStatus', id, { id, manifestJson, callback })
      const result = await ipcRenderer.invoke('chromeWebstore.getExtensionStatus', id, manifestJson)
      console.log('webstorePrivate.getExtensionStatus result:', id, result)
      if (callback) callback(result)
      maybeUpdateBranding()
      return result
    },

    getFullChromeVersion: async (callback) => {
      console.log('webstorePrivate.getFullChromeVersion called')
      const result = await ipcRenderer.invoke('chromeWebstore.getFullChromeVersion')
      console.log('webstorePrivate.getFullChromeVersion result:', result)

      if (result.app_name) {
        setAppName(result.app_name)
        delete result.app_name
      }

      if (callback) callback(result)
      return result
    },

    getIsLauncherEnabled: async (callback) => {
      console.log('webstorePrivate.getIsLauncherEnabled called')
      const result = await ipcRenderer.invoke('chromeWebstore.getIsLauncherEnabled')
      console.log('webstorePrivate.getIsLauncherEnabled result:', result)
      if (callback) callback(result)
      return result
    },

    getMV2DeprecationStatus: async (callback) => {
      console.log('webstorePrivate.getMV2DeprecationStatus called')
      const result = await ipcRenderer.invoke('chromeWebstore.getMV2DeprecationStatus')
      console.log('webstorePrivate.getMV2DeprecationStatus result:', result)
      if (callback) callback(result)
      return result
    },

    getReferrerChain: async (callback) => {
      console.log('webstorePrivate.getReferrerChain called')
      const result = await ipcRenderer.invoke('chromeWebstore.getReferrerChain')
      console.log('webstorePrivate.getReferrerChain result:', result)
      if (callback) callback(result)
      return result
    },

    getStoreLogin: async (callback) => {
      console.log('webstorePrivate.getStoreLogin called')
      const result = await ipcRenderer.invoke('chromeWebstore.getStoreLogin')
      console.log('webstorePrivate.getStoreLogin result:', result)
      if (callback) callback(result)
      return result
    },

    getWebGLStatus: async (callback) => {
      console.log('webstorePrivate.getWebGLStatus called')
      const result = await ipcRenderer.invoke('chromeWebstore.getWebGLStatus')
      console.log('webstorePrivate.getWebGLStatus result:', result)
      if (callback) callback(result)
      return result
    },

    install: async (id, silentInstall, callback) => {
      console.log('webstorePrivate.install', { id, silentInstall })
      const result = await ipcRenderer.invoke('chromeWebstore.install', id, silentInstall)
      console.log('webstorePrivate.install result:', result)
      if (callback) callback(result)
      return result
    },

    isInIncognitoMode: async (callback) => {
      console.log('webstorePrivate.isInIncognitoMode called')
      const result = await ipcRenderer.invoke('chromeWebstore.isInIncognitoMode')
      console.log('webstorePrivate.isInIncognitoMode result:', result)
      if (callback) callback(result)
      return result
    },

    isPendingCustodianApproval: async (id, callback) => {
      console.log('webstorePrivate.isPendingCustodianApproval', id)
      const result = await ipcRenderer.invoke('chromeWebstore.isPendingCustodianApproval', id)
      console.log('webstorePrivate.isPendingCustodianApproval result:', result)
      if (callback) callback(result)
      return result
    },

    setStoreLogin: async (login, callback) => {
      console.log('webstorePrivate.setStoreLogin', login)
      const result = await ipcRenderer.invoke('chromeWebstore.setStoreLogin', login)
      console.log('webstorePrivate.setStoreLogin result:', result)
      if (callback) callback(result)
      return result
    }
  }

  // Expose webstorePrivate API
  contextBridge.exposeInMainWorld('electronWebstore', electronWebstore)

  // Expose chrome.runtime and chrome.management APIs
  const runtime = {
    lastError: null,
    getManifest: async () => {
      console.log('chrome.runtime.getManifest called')
      return {}
    }
  }
  contextBridge.exposeInMainWorld('electronRuntime', runtime)

  const management = {
    onInstalled: {
      addListener: (callback: () => void) => {
        console.log('chrome.management.onInstalled.addListener called')
        ipcRenderer.on('chrome.management.onInstalled', callback)
      },
      removeListener: (callback: () => void) => {
        console.log('chrome.management.onInstalled.removeListener called')
        ipcRenderer.removeListener('chrome.management.onInstalled', callback)
      }
    },
    onUninstalled: {
      addListener: (callback: () => void) => {
        console.log('chrome.management.onUninstalled.addListener called')
        ipcRenderer.on('chrome.management.onUninstalled', callback)
      },
      removeListener: (callback: () => void) => {
        console.log('chrome.management.onUninstalled.removeListener called')
        ipcRenderer.removeListener('chrome.management.onUninstalled', callback)
      }
    },
    getAll: (callback: (extensions: any[]) => void) => {
      console.log('chrome.management.getAll called')
      ipcRenderer.invoke('chrome.management.getAll').then((result) => {
        console.log('chrome.management.getAll result:', result)
        callback(result)
      })
    },
    setEnabled: async (id: string, enabled: boolean) => {
      console.log('chrome.management.setEnabled', { id, enabled })
      const result = await ipcRenderer.invoke('chrome.management.setEnabled', id, enabled)
      console.log('chrome.management.setEnabled result:', result)
      return result
    },
    uninstall: (id: string, options: { showConfirmDialog: boolean }, callback?: () => void) => {
      console.log('chrome.management.uninstall', { id, options })
      ipcRenderer.invoke('chrome.management.uninstall', id, options).then((result) => {
        console.log('chrome.management.uninstall result:', result)
        if (callback) callback()
      })
    }
  }
  contextBridge.exposeInMainWorld('electronManagement', management)

  webFrame.executeJavaScript(`
    (function () {
      chrome.webstorePrivate = globalThis.electronWebstore;
      Object.assign(chrome.runtime, electronRuntime);
      Object.assign(chrome.management, electronManagement);
      void 0;
    }());
  `)

  // Fetch app name
  electronWebstore.getFullChromeVersion()

  // Replace branding
  overrideUserAgent()
  process.once('document-start', maybeUpdateBranding)
  if ('navigation' in window) {
    ;(window.navigation as any).addEventListener('navigate', maybeUpdateBranding)
  }
}

export async function checkIfExtensionsEnabled() {
  try {
    const result = await ipcRenderer.invoke('get-extensions-enabled')
    return result
  } catch (error) {
    console.error('Error getting user config:', error)
    return false
  }
}
