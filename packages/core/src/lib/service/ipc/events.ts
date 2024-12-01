import type {
  EditablePrompt,
  ElectronAppInfo,
  RightSidebarTab,
  UserConfig,
  UserSettings,
  DownloadDoneMessage,
  DownloadRequestMessage,
  DownloadUpdatedMessage,
  TelemetryEventTypes,
  SFFSResource
} from '@horizon/types'
import { createIPCService, type IPCEvent } from './ipc'
import type { ControlWindow } from '../../types'

export const ipcService = createIPCService()

export interface AdblockerStateChange {
  partition: string
  state: boolean
}

export interface BrowserFocusChange {
  state: 'focused' | 'unfocused'
}

export interface TrackEvent {
  name: TelemetryEventTypes
  properties: Record<string, any>
}

export interface NewWindowRequest {
  url: string
  disposition?: Electron.HandlerDetails['disposition']
  webContentsId?: number
}

export interface OpenURL {
  url: string
  active: boolean
}

export interface GetAdblockerState extends IPCEvent {
  payload: string
  output: boolean
}

export interface CaptureWebContents extends IPCEvent {
  payload: void
  output: string | null
}

export interface GetUserConfig extends IPCEvent {
  payload: void
  output: UserConfig
}

export interface StartDrag {
  resourceId: string
  filePath: string
  fileType: string
}

export interface GetAppInfo extends IPCEvent {
  payload: void
  output: ElectronAppInfo
}

export interface InterceptRequestHeaders extends IPCEvent {
  payload: {
    urls: string[]
    partition: string
  }
  output: {
    url: string
    headers: Record<string, string>
  }
}

export interface ScreenshotPage extends IPCEvent {
  payload: { x: number; y: number; width: number; height: number }
  output: string
}

export interface WebviewReadResourceData extends IPCEvent {
  payload: { token: string; resourceId: string }
  output: Uint8Array
}

export interface TokenCreate extends IPCEvent {
  payload: any
  output: string
}

export interface DefaultBrowserCheck extends IPCEvent {
  payload: void
  output: boolean
}

const IPC_EVENTS = ipcService.registerEvents({
  // events that don't return a value
  updateTrafficLights: ipcService.addEvent<boolean>('update-traffic-lights'),
  restartApp: ipcService.addEvent<void>('restart-app'),
  startDrag: ipcService.addEvent<StartDrag>('start-drag'),
  setAdblockerState: ipcService.addEvent<AdblockerStateChange>('set-adblocker-state'),
  appReady: ipcService.addEvent<void>('app-ready'),
  downloadRequest: ipcService.addEvent<DownloadRequestMessage>('download-request'),
  downloadUpdated: ipcService.addEvent<DownloadUpdatedMessage>('download-updated'),
  downloadDone: ipcService.addEvent<DownloadDoneMessage>('download-done'),
  storeAPIKey: ipcService.addEvent<string>('store-api-key'),
  updateUserConfigSettings: ipcService.addEvent<Partial<UserSettings>>(
    'store-user-config-settings'
  ),
  userConfigSettingsChange: ipcService.addEvent<UserSettings>('user-config-settings-change'),
  updateInitializedTabs: ipcService.addEvent<boolean>('update-initialized-tabs'),
  checkForUpdates: ipcService.addEvent<void>('check-for-updates'),
  useAsDefaultBrowser: ipcService.addEvent<void>('use-as-default-browser'),
  setPrompts: ipcService.addEvent<EditablePrompt[]>('set-prompts'),
  requestPrompts: ipcService.addEvent<void>('request-prompts'),
  resetPrompt: ipcService.addEvent<string>('reset-prompt'),
  updatePrompt: ipcService.addEvent<Pick<EditablePrompt, 'id' | 'content'>>('update-prompt'),
  openCheatSheet: ipcService.addEvent<void>('open-cheat-sheet'),
  openInvitePage: ipcService.addEvent<void>('open-invite-page'),
  openFeedbackPage: ipcService.addEvent<void>('open-feedback-page'),
  openWelcomePage: ipcService.addEvent<void>('open-welcome-page'),
  openImporter: ipcService.addEvent<void>('open-importer'),
  browserFocusChange: ipcService.addEvent<BrowserFocusChange>('browser-focus-change'),
  adBlockerStateChange: ipcService.addEvent<AdblockerStateChange>('adblocker-state-change'),
  trackEvent: ipcService.addEvent<TrackEvent>('track-event'),
  toggleSidebar: ipcService.addEvent<boolean | undefined>('toggle-sidebar'),
  toggleTabsPosition: ipcService.addEvent<void>('toggle-tabs-position'),
  toggleTheme: ipcService.addEvent<void>('toggle-theme'),
  copyActiveTabUrl: ipcService.addEvent<void>('copy-active-tab-url'),
  createNewTab: ipcService.addEvent<void>('create-new-tab'),
  closeActiveTab: ipcService.addEvent<void>('close-active-tab'),
  openOasis: ipcService.addEvent<void>('open-oasis'),
  startScreenshotPicker: ipcService.addEvent<void>('start-screenshot-picker'),
  toggleRightSidebar: ipcService.addEvent<void>('toggle-right-sidebar'),
  toggleRightSidebarTab: ipcService.addEvent<RightSidebarTab>('toggle-right-sidebar-tab'),
  reloadActiveTab: ipcService.addEvent<boolean>('reload-active-tab'),
  openDevTools: ipcService.addEvent<void>('open-dev-tools'),
  trackpadScrollStart: ipcService.addEvent<void>('trackpad-scroll-start'),
  trackpadScrollStop: ipcService.addEvent<void>('trackpad-scroll-stop'),
  newWindowRequest: ipcService.addEvent<NewWindowRequest>('new-window-request'),
  openURL: ipcService.addEvent<OpenURL>('open-url'),
  openHistory: ipcService.addEvent<void>('open-history'),
  controlWindow: ipcService.addEvent<ControlWindow>('control-window'),
  openSettings: ipcService.addEvent<void>('open-settings'),
  openResourceLocally: ipcService.addEvent<SFFSResource>('open-resource-locally'),
  showAppMenuPopup: ipcService.addEvent<void>('show-app-menu-popup'),
  resetBackgroundImage: ipcService.addEvent<void>('reset-background-image'),
  importedFiles: ipcService.addEvent<string[]>('imported-files'),

  // events that return a value
  getAdblockerState: ipcService.addEventWithReturn<GetAdblockerState>('get-adblocker-state'),
  captureWebContents: ipcService.addEventWithReturn<CaptureWebContents>('capture-web-contents'),
  getUserConfig: ipcService.addEventWithReturn<GetUserConfig>('get-user-config'),
  getAppInfo: ipcService.addEventWithReturn<GetAppInfo>('get-app-info'),
  interceptRequestHeaders: ipcService.addEventWithReturn<InterceptRequestHeaders>(
    'intercept-request-headers'
  ),
  screenshotPage: ipcService.addEventWithReturn<ScreenshotPage>('screenshot-page'),
  tokenCreate: ipcService.addEventWithReturn<TokenCreate>('token-create'),
  webviewReadResourceData: ipcService.addEventWithReturn<WebviewReadResourceData>(
    'webview-read-resource-data'
  ),
  isDefaultBrowser: ipcService.addEventWithReturn<DefaultBrowserCheck>('is-default-browser')
})

export const IPC_EVENTS_MAIN = IPC_EVENTS.main
export const IPC_EVENTS_RENDERER = IPC_EVENTS.renderer
