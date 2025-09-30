import type { WebviewTag } from 'electron'
import { type DetectedResource, type DetectedWebApp, type WebServiceActionInputs } from '../types'
import { WebViewEventReceiveNames, WebViewEventSendNames } from '@deta/types'
import { shouldIgnoreWebviewErrorCode } from '@deta/utils'

const DEFAULT_EXTRACTION_TIMEOUT = 10000
const DEFAULT_INITIALIZING_TIMEOUT = 7000
const DEFAULT_ACTION_TIMEOUT = 10000

export class WebViewExtractor {
  url: string
  document: Document
  webview: WebviewTag | null
  partition: string

  consoleMessages: string[]

  appDetectionCallback: ((app: DetectedWebApp) => void) | null
  resourceDetectionCallback: ((resource: any) => void) | null

  constructor(url: string | URL, document: Document, partition?: string) {
    this.url = url instanceof URL ? url.href : url
    this.document = document
    this.webview = null
    this.partition = partition ?? 'persist:horizon'

    this.consoleMessages = []

    this.appDetectionCallback = null
    this.resourceDetectionCallback = null
  }

  getConsoleMessages() {
    return this.consoleMessages
  }

  onAppDetection(callback: (app: DetectedWebApp) => void) {
    this.appDetectionCallback = callback
  }

  onResourceDetection(callback: (resource: any) => void) {
    this.resourceDetectionCallback = callback
  }

  initializeWebview(timeout: number = DEFAULT_INITIALIZING_TIMEOUT) {
    this.webview = document.createElement('webview')
    if (!this.webview) return

    this.webview.addEventListener('destroyed', () => {
      this.destroyWebview()
    })

    // TODO: THis dupe can be removed
    this.webview.addEventListener('destroyed', () => {
      this.destroyWebview()
    })

    this.webview.addEventListener('console-message', (e) => {
      this.consoleMessages.push(e.message)
    })

    this.webview.addEventListener('dom-ready', () => {
      this.webview?.setAudioMuted(true)
    })

    this.webview.addEventListener('ipc-message', (event) => {
      if (event.channel !== 'webview-page-event') return

      const eventType = event.args[0] as WebViewEventSendNames
      const eventData = event.args[1]

      if (!eventType) return

      if (eventType === WebViewEventSendNames.DetectedApp) {
        if (this.appDetectionCallback) {
          this.appDetectionCallback(eventData.appName)
        }
      } else if (eventType === WebViewEventSendNames.DetectedResource) {
        if (this.resourceDetectionCallback) {
          this.resourceDetectionCallback(eventData)
        }
      }
    })

    this.webview.style.width = '100%'
    this.webview.style.height = '100%'
    this.webview.style.position = 'fixed'
    this.webview.style.top = '0'
    this.webview.style.left = '0'
    this.webview.style.zIndex = '999999'
    this.webview.style.backgroundColor = 'white'
    this.webview.style.border = 'none'
    this.webview.style.overflow = 'hidden'
    this.webview.style.opacity = '0'
    this.webview.style.pointerEvents = 'none'

    this.webview.setAttribute('data-webview-extractor', 'true')
    this.webview.src = this.url
    this.webview.partition = this.partition
    this.webview.webpreferences =
      'autoplayPolicy=document-user-activation-required,contextIsolation=true,nodeIntegration=false,sandbox=true,webSecurity=true'
    // webviews needed for extracting stuff don't need to create windows
    this.webview.allowpopups = false

    document.body.appendChild(this.webview)

    let timeoutId: any

    return new Promise<void>((resolve, reject) => {
      const handleLoad = () => {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }

        resolve()
      }

      timeoutId = setTimeout(() => {
        this.webview?.removeEventListener('did-finish-load', handleLoad)
        handleLoad()
      }, timeout)

      this.webview?.addEventListener('did-finish-load', handleLoad)

      this.webview?.addEventListener('did-fail-load', (event: Electron.DidFailLoadEvent) => {
        if (!event.isMainFrame) return
        if (shouldIgnoreWebviewErrorCode(event.errorCode)) return

        console.error('Webview failed to load', event)
        this.destroyWebview()
        reject()
      })
    })
  }

  destroyWebview() {
    this.webview?.remove()
    this.webview = null
  }

  wait(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }

  async detectResource(timeout: number = DEFAULT_EXTRACTION_TIMEOUT) {
    return new Promise<any | null>(async (resolve) => {
      if (this.webview === null) {
        await this.initializeWebview()
      }

      this.resourceDetectionCallback = (resource) => {
        this.resourceDetectionCallback = null
        this.destroyWebview()
        resolve(resource ?? null)
      }

      await this.wait(500)

      this.webview?.send('webview-event', { type: WebViewEventReceiveNames.GetResource })

      setTimeout(() => {
        this.resourceDetectionCallback = null
        this.destroyWebview()
        resolve(null)
      }, timeout)
    })
  }

  async runAction(
    id: string,
    inputs?: WebServiceActionInputs,
    timeoutNum: number = DEFAULT_ACTION_TIMEOUT
  ) {
    return new Promise<DetectedResource | null>(async (resolve) => {
      if (this.webview === null) {
        await this.initializeWebview()
      }

      let timeout: any

      const handleEvent = (event: Electron.IpcMessageEvent) => {
        if (event.channel !== 'webview-page-event') return

        const eventType = event.args[0] as string
        const eventData = event.args[1]

        if (eventType === WebViewEventSendNames.ActionOutput && eventData.id === id) {
          event.preventDefault()
          event.stopPropagation()

          if (timeout) {
            clearTimeout(timeout)
          }

          this.webview?.removeEventListener('ipc-message', handleEvent)
          // this.destroyWebview()
          resolve(eventData.output)
        }
      }

      timeout = setTimeout(() => {
        this.webview?.removeEventListener('ipc-message', handleEvent)
        resolve(null)
        //this.destroyWebview()
      }, timeoutNum)

      this.webview?.addEventListener('ipc-message', handleEvent)
      this.webview?.send('webview-event', {
        type: WebViewEventReceiveNames.RunAction,
        data: { id, inputs }
      })
    })
  }

  async executeJavaScript<T>(code: string, userGesture?: boolean) {
    return this.webview?.executeJavaScript(code, userGesture) as Promise<T>
  }
}

export const createWebviewExtractor = (
  url: string | URL,
  document: Document,
  partition?: string
) => {
  return new WebViewExtractor(url, document, partition)
}
