import { makeAbsoluteURL } from '@deta/utils'
import type { DetectedResource, DetectedWebApp, WebService, WebServiceAction } from '../types'

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

  getRSSFeedUrl(document: Document) {
    const getFeedLink = () => {
      const rssLink = document.querySelector('link[type="application/rss+xml"]')
      if (rssLink) {
        return rssLink.getAttribute('href')
      }

      const atomLink = document.querySelector('link[type="application/atom+xml"]')
      if (atomLink) {
        return atomLink.getAttribute('href')
      }

      const alternateLinks = Array.from(document.querySelectorAll('link[rel="alternate"]'))
      const rssLink2 = alternateLinks.find(
        (link) => link.getAttribute('type') === 'application/rss+xml'
      )
      if (rssLink2) {
        return rssLink2.getAttribute('href')
      }

      const atomLink2 = alternateLinks.find(
        (link) => link.getAttribute('type') === 'application/atom+xml'
      )
      if (atomLink2) {
        return atomLink2.getAttribute('href')
      }
    }

    const feedLink = getFeedLink()
    if (feedLink) {
      return makeAbsoluteURL(feedLink, this.url)
    }

    return null
  }
}

export abstract class WebAppExtractorActions extends WebAppExtractor {
  abstract getActions(): WebServiceAction[]

  abstract runAction(document: Document, id: string, input?: any): Promise<DetectedResource | null>
}

export * from './api'
export * from './metadata'
export * from './webview'
