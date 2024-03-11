import {
  ResourceDataArticle,
  ResourceDataChatMessage,
  ResourceDataChatThread,
  ResourceDataDocument,
  ResourceDataLink,
  ResourceDataPost,
  ResourceTypes
} from '@horizon/types'
export { SERVICES } from './services'

import {
  RedditParser,
  TwitterParser,
  NotionParser,
  ArticleParser,
  LinkParser,
  SlackParser,
  YoutubeParser
} from './sites/index'
import { DetectedResource, ResourceContent } from './types'
import { MetadataExtractor } from './extractors/metadata'
import { WebViewExtractor } from './extractors/webview'
import { WebAppExtractor } from './extractors/index'
import { SERVICES } from './services'

const ParserModules = {
  reddit: RedditParser,
  twitter: TwitterParser,
  notion: NotionParser,
  slack: SlackParser,
  youtube: YoutubeParser
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

  async extractResourceUsingWebview(document: Document) {
    const webviewExtractor = this.createWebviewExtractor(document)

    await webviewExtractor.initializeWebview()

    // TODO - wait for the page to have fully loaded
    await wait(3000)

    const extracted = await webviewExtractor.detectResource()

    return extracted as DetectedResource | null
  }

  static getAppParser(url: string) {
    const webParser = new WebParser(url)
    const appParser = webParser.createAppParser()
    if (!appParser) return null

    return appParser
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
    } else if (type.startsWith(ResourceTypes.DOCUMENT)) {
      const data = resourceData as ResourceDataDocument
      return {
        html: data.content_html,
        plain: data.content_plain
      }
    } else if (type === ResourceTypes.LINK) {
      const data = resourceData as ResourceDataLink
      return {
        html: null,
        plain: data.description || data.title
      }
    } else {
      return {
        html: null,
        plain: null
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
