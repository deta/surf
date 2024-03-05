import type { DetectedResource, DetectedWebApp, WebApp } from '../types'

export abstract class WebAppExtractor {
  app: WebApp | null
  url: URL

  constructor(app: WebApp | null, url: URL) {
    this.app = app
    this.url = url
  }

  abstract getInfo(): DetectedWebApp

  abstract detectResourceType(): string | null

  abstract extractResourceFromDocument(document: Document): Promise<DetectedResource | null>
}

export * from './api'
export * from './metadata'
export * from './webview'
