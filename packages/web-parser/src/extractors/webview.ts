import type { WebviewTag } from 'electron'
import { DetectedResource, DetectedWebApp, WebServiceActionInputs } from '../types'
import { WebViewEventReceiveNames, WebViewEventSendNames } from '@horizon/types'

export class WebViewExtractor {
  url: URL
  document: Document
  webview: WebviewTag | null
  partition: string

  appDetectionCallback: ((app: DetectedWebApp) => void) | null
  resourceDetectionCallback: ((resource: any) => void) | null

  constructor(url: URL, document: Document, partition?: string) {
    this.url = url
    this.document = document
    this.webview = null
    this.partition = partition ?? 'persist:horizon'

    this.appDetectionCallback = null
    this.resourceDetectionCallback = null
  }

  onAppDetection(callback: (app: DetectedWebApp) => void) {
    this.appDetectionCallback = callback
  }

  onResourceDetection(callback: (resource: any) => void) {
    this.resourceDetectionCallback = callback
  }

  initializeWebview() {
    console.log('Initializing webview with location', this.url.href)
    this.webview = document.createElement('webview')
    if (!this.webview) return

    this.webview.setAttribute('data-webview-extractor', 'true')
    this.webview.src = this.url.href
    this.webview.partition = this.partition
    // @ts-expect-error
    this.webview.preload = `file://${window.api.webviewPreloadPath}`
    this.webview.webpreferences =
      'autoplayPolicy=user-gesture-required,contextIsolation=true,nodeIntegration=false,sandbox=true,webSecurity=true'
    // webviews needed for extracting stuff don't need to create windows
    this.webview.allowpopups = false

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

    this.webview.addEventListener('destroyed', () => {
      this.destroyWebview()
    })

    this.webview.addEventListener('destroyed', () => {
      this.destroyWebview()
    })

    this.webview.addEventListener('console-message', (e) => {
      console.log('Webview console:', e.message)
    })

    this.webview.addEventListener('ipc-message', (event) => {
      if (event.channel !== 'webview-page-event') return

      const eventType = event.args[0] as WebViewEventSendNames
      const eventData = event.args[1]

      if (!eventType) return

      if (eventType === WebViewEventSendNames.DetectedApp) {
        console.log('Detected app', eventData)
        if (this.appDetectionCallback) {
          this.appDetectionCallback(eventData.appName)
        }
      } else if (eventType === WebViewEventSendNames.DetectedResource) {
        console.log('Detected resource', eventData)
        if (this.resourceDetectionCallback) {
          this.resourceDetectionCallback(eventData)
        }
      }
    })

    document.body.appendChild(this.webview)

    return new Promise<void>((resolve, reject) => {
      this.webview?.addEventListener('did-finish-load', () => {
        resolve()
      })

      this.webview?.addEventListener('did-fail-load', () => {
        console.error('Webview failed to load')
        this.destroyWebview()
        reject()
      })
    })
  }

  destroyWebview() {
    this.webview?.remove()
    this.webview = null
  }

  wait = (ms: number) => {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }

  async detectResource(timeout: number = 10000) {
    return new Promise<any | null>(async (resolve) => {
      if (this.webview === null) {
        await this.initializeWebview()
      }

      this.resourceDetectionCallback = (resource) => {
        console.log('Detected resource', resource)
        this.resourceDetectionCallback = null
        this.destroyWebview()
        resolve(resource ?? null)
      }

      await this.wait(1000)

      this.webview?.send('webview-event', { type: WebViewEventReceiveNames.GetResource })

      setTimeout(() => {
        console.log('Resource detection timed out')
        this.resourceDetectionCallback = null
        this.destroyWebview()
        resolve(null)
      }, timeout)
    })
  }

  async runAction(id: string, inputs?: WebServiceActionInputs, timeoutNum: number = 10000) {
    console.log('Running action', id, inputs)
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
}
