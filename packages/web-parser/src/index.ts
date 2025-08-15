import {
  type ResourceDataArticle,
  type ResourceDataChatMessage,
  type ResourceDataChatThread,
  type ResourceDataDocument,
  type ResourceDataLink,
  type ResourceDataPost,
  type ResourceDataTable,
  type ResourceDataTableColumn,
  ResourceTypes
} from '@deta/types'
export { SERVICES } from './services'

import {
  RedditParser,
  TwitterParser,
  NotionParser,
  ArticleParser,
  LinkParser,
  SlackParser,
  YoutubeParser,
  TypeformParser,
  GoogleSheetsParser
} from './sites/index'
import { type DetectedResource, type ResourceContent, type WebServiceActionInputs } from './types'
import { MetadataExtractor } from './extractors/metadata'
import { WebViewExtractor } from './extractors/webview'
import { WebAppExtractor } from './extractors/index'
import { SERVICES } from './services'

const ParserModules = {
  reddit: RedditParser,
  twitter: TwitterParser,
  notion: NotionParser,
  slack: SlackParser,
  youtube: YoutubeParser,
  typeform: TypeformParser,
  'google.sheets': GoogleSheetsParser // TODO: <-- We should use _ instead of . for service ids
}

const wait = (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

const SUPPORTED_APPS = SERVICES
export class WebParser {
  url: URL

  constructor(url: string) {
    this.url = new URL(url)
  }

  isSupportedApp() {
    const hostname = this.url.hostname
    const app = SUPPORTED_APPS.find((app) => app.matchHostname.test(hostname))

    if (!app) return false

    const Parser = ParserModules[app.id as keyof typeof ParserModules]
    if (!Parser) return false

    return true
  }

  detectApp() {
    const hostname = this.url.hostname
    const app = SUPPORTED_APPS.find((app) => app.matchHostname.test(hostname))

    return app ?? null
  }

  createMetadataExtractor() {
    return new MetadataExtractor(this.url)
  }

  createAppParser() {
    const hostname = this.url.hostname
    const app = SUPPORTED_APPS.find((app) => app.matchHostname.test(hostname))

    if (!app) return null

    const Parser = ParserModules[app.id as keyof typeof ParserModules]
    if (!Parser) return null

    return new Parser(app, this.url) as WebAppExtractor
  }

  useFallbackParser(document: Document) {
    const articleParser = new ArticleParser(this.url)

    const isArticle = articleParser.isArticle(document)
    console.log('Is article', isArticle)

    if (isArticle) {
      return articleParser
    } else {
      return new LinkParser(this.url)
    }
  }

  createWebviewExtractor(document: Document) {
    return new WebViewExtractor(this.url, document)
  }

  getPageInfo() {
    const appParser = this.createAppParser()
    if (!appParser) return null

    return appParser.getInfo()
  }

  getSimpleMetadata() {
    const metadataParser = this.createMetadataExtractor()
    return metadataParser.extractRemote()
  }

  getWebService(id: string) {
    return WebParser.getWebService(id)
  }

  async extractResourceUsingWebview(document: Document) {
    const webviewExtractor = this.createWebviewExtractor(document)

    await webviewExtractor.initializeWebview()

    // TODO - wait for the page to have fully loaded
    await wait(3000)

    const extracted = await webviewExtractor.detectResource()

    return extracted as DetectedResource | null
  }

  async runActionUsingWebview(document: Document, id: string, inputs?: WebServiceActionInputs) {
    const webviewExtractor = this.createWebviewExtractor(document)

    await webviewExtractor.initializeWebview()

    // TODO - wait for the page to have fully loaded
    await wait(3000)

    const extracted = await webviewExtractor.runAction(id, inputs)

    return extracted as DetectedResource | null
  }

  static useFallbackParser(document: Document, url: URL) {
    const articleParser = new ArticleParser(url)

    const isArticle = articleParser.isArticle(document)
    console.log('Is article', isArticle)

    if (isArticle) {
      return articleParser
    } else {
      return new LinkParser(url)
    }
  }

  static getAppParser(url: string) {
    const webParser = new WebParser(url)
    const appParser = webParser.createAppParser()
    if (!appParser) return null

    return appParser
  }

  static getWebService(id: string) {
    return SUPPORTED_APPS.find((app) => app.id === id) ?? null
  }

  static getResourceContent(
    type: DetectedResource['type'],
    resourceData: DetectedResource['data']
  ): ResourceContent {
    if (type === ResourceTypes.ARTICLE) {
      const data = resourceData as ResourceDataArticle
      return {
        html: data.content_html,
        plain: data.content_plain
      }
    } else if (type === ResourceTypes.LINK) {
      const data = resourceData as ResourceDataLink
      return {
        html: data.content_html,
        plain: data.content_plain
      }
    } else if (type.startsWith(ResourceTypes.POST)) {
      const data = resourceData as ResourceDataPost
      return {
        html: data.content_html,
        plain: data.content_plain
      }
    } else if (type.startsWith(ResourceTypes.CHAT_MESSAGE)) {
      const data = resourceData as ResourceDataChatMessage
      return {
        html: data.content_html,
        plain: data.content_plain
      }
    } else if (type.startsWith(ResourceTypes.CHAT_THREAD)) {
      const data = resourceData as ResourceDataChatThread
      return {
        html: data.content_html,
        plain: data.content_plain
      }
    } else if (type === ResourceTypes.DOCUMENT_SPACE_NOTE) {
      const data = resourceData as string
      const parser = new DOMParser()
      const doc = parser.parseFromString(data, 'text/html')

      return {
        html: data,
        plain: doc.body.textContent
      }
    } else if (type.startsWith(ResourceTypes.DOCUMENT)) {
      const data = resourceData as ResourceDataDocument
      return {
        html: data.content_html,
        plain: data.content_plain
      }
    } else if (type.startsWith(ResourceTypes.TABLE_COLUMN)) {
      const data = resourceData as ResourceDataTableColumn

      const html = data.rows.join('\n') // TODO: turn into html table
      const csv = data.rows.join('\n')

      return {
        html: html,
        plain: csv
      }
    } else if (type.startsWith(ResourceTypes.TABLE)) {
      const data = resourceData as ResourceDataTable

      const html = `
      <table>
        <thead>
          <tr>
            ${data.columns.map((col) => `<th>${col}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.rows
            .map(
              (row) => `
          <tr>
            ${row.map((cell) => `<td>${cell}</td>`).join('')}
          </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
      `

      const csv = `${data.columns.join(',')}\n${data.rows.map((row) => row.join(',')).join('\n')}`

      return {
        html: html,
        plain: csv
      }
    } else if (type === ResourceTypes.LINK) {
      const data = resourceData as ResourceDataLink
      return {
        html: null,
        plain: data.description || data.title
      }
    } else if (type === 'text/plain') {
      const data = resourceData as string
      return {
        html: null,
        plain: data
      }
    } else {
      return {
        html: null,
        plain: null
      }
    }
  }

  static getResourcePreview(resource: DetectedResource): {
    title: string
    type: string
    url: string | null
  } {
    if (resource.type === ResourceTypes.ARTICLE) {
      const data = resource.data as ResourceDataArticle
      return {
        title: data.title ?? data.excerpt,
        type: ResourceTypes.ARTICLE,
        url: data.url
      }
    } else if (resource.type.startsWith(ResourceTypes.POST)) {
      const data = resource.data as ResourceDataPost
      return {
        title: data.title ?? data.content_plain,
        type: ResourceTypes.POST,
        url: data.url
      }
    } else if (resource.type.startsWith(ResourceTypes.CHAT_MESSAGE)) {
      const data = resource.data as ResourceDataChatMessage
      return {
        title: data.content_plain ?? data.author,
        type: ResourceTypes.CHAT_MESSAGE,
        url: data.url
      }
    } else if (resource.type.startsWith(ResourceTypes.CHAT_THREAD)) {
      const data = resource.data as ResourceDataChatThread
      return {
        title: data.content_plain ?? data.creator,
        type: ResourceTypes.CHAT_THREAD,
        url: data.url
      }
    } else if (resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE) {
      return {
        title: 'Document',
        type: ResourceTypes.DOCUMENT_SPACE_NOTE,
        url: null
      }
    } else if (resource.type.startsWith(ResourceTypes.DOCUMENT)) {
      const data = resource.data as ResourceDataDocument
      return {
        title: data.title ?? data.author ?? data.url,
        type: ResourceTypes.DOCUMENT,
        url: data.url
      }
    } else if (resource.type.startsWith(ResourceTypes.TABLE_COLUMN)) {
      const data = resource.data as ResourceDataTableColumn
      return {
        title: data.name ?? data.rows.join('\n'),
        type: ResourceTypes.TABLE_COLUMN,
        url: null
      }
    } else if (resource.type.startsWith(ResourceTypes.TABLE)) {
      const data = resource.data as ResourceDataTable
      return {
        title: data.name ?? data.columns.join(','),
        type: ResourceTypes.TABLE,
        url: null
      }
    } else if (resource.type === ResourceTypes.LINK) {
      const data = resource.data as ResourceDataLink
      return {
        title: data.title ?? data.description ?? data.url,
        type: ResourceTypes.LINK,
        url: data.url
      }
    } else if (resource.type === 'text/plain') {
      return {
        title: 'Text',
        type: 'text/plain',
        url: null
      }
    } else {
      return {
        title: 'Unknown',
        type: 'unknown',
        url: null
      }
    }
  }
}

/*

   In WebView

    window.onload = () => {
        const webParser = new WebParser(window.location.href)

        const isSupportedApp = webParser.isSupported()
        if (!isSupportedApp) return

        const detectedApp = webDetector.detectApp()

        const appParser = webDetector.createAppParser(document)

        const resource = appParser.getResource()
        if (!resource) return

        const data = resource.data
    }

  In Oasis:

    const url = 'https://twitter.com/elonmusk/status/123'

    const webParser = new WebParser(url)

    const detectedApp = webParser.detectApp() // { id: 'twitter', name: 'Twitter', matchHostname: /twitter.com/ }

    const metadataExtractor = webParser.createMetadataExtractor()

    const preview = await metadataExtractor.extractRemote() // { title: 'Elon Musk on Twitter', description: 'Elon Musk tweet', image: 'https://twitter.com/elonmusk/status/123/photo/1' }

*/

export * from './types'
export * from './extractors/index'
export * from './importers/index'
export * from './annotations/index'
export * from './search/index'
