import type { WebviewTag } from 'electron'
import { DetectedWebApp } from '../types'

export class WebViewExtractor {
  url: URL
  document: Document
  webview: WebviewTag | null

  appDetectionCallback: ((app: DetectedWebApp) => void) | null
  resourceDetectionCallback: ((resource: any) => void) | null

  constructor(url: URL, document: Document) {
    this.url = url
    this.document = document
    this.webview = null

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
    console.log('Initializing webview')
    this.webview = document.createElement('webview')
    if (!this.webview) return

    this.webview.setAttribute('data-webview-extractor', 'true')
    this.webview.src = this.url.href
    this.webview.partition = 'persist:horizon'
    this.webview.preload = `file://${window.api.webviewPreloadPath}`
    this.webview.webpreferences = 'autoplayPolicy=user-gesture-required'
    this.webview.allowpopups = true

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

      const eventData = event.args[0]
      const eventType = eventData.type as string
      delete eventData.type

      if (!eventType) return

      if (eventType === 'detected-app') {
        console.log('Detected app', eventData)
        if (this.appDetectionCallback) {
          this.appDetectionCallback(eventData.appName)
        }
      } else if (eventType === 'detected-resource') {
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

  async detectResource(timeout: number = 10000) {
    return new Promise<any | null>(async (resolve, reject) => {
      if (this.webview === null) {
        await this.initializeWebview()
      }

      this.resourceDetectionCallback = (resource) => {
        console.log('Detected resource', resource)
        this.resourceDetectionCallback = null
        this.destroyWebview()
        resolve(resource)
      }

      this.webview?.send('webview-event', { type: 'get-resource' })

      setTimeout(() => {
        console.log('Resource detection timed out')
        this.resourceDetectionCallback = null
        this.destroyWebview()
        reject(null)
      }, timeout)
    })
  }
}
