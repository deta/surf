import type { DetectedResource, DetectedWebApp, WebService } from '../types'

export abstract class WebAppExtractor {
  app: WebService | null
  url: URL

  constructor(app: WebService | null, url: URL) {
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
