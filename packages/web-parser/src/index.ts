import { ResourceTypes } from '@horizon/types'

import {
  RedditParser,
  TwitterParser,
  NotionParser,
  ArticleParser,
  LinkParser,
  SlackParser
} from './sites/index'
import { DetectedResource, WebApp } from './types'
import { MetadataExtractor } from './extractors/metadata'
import { WebViewExtractor } from './extractors/webview'

const ParserModules = {
  reddit: RedditParser,
  twitter: TwitterParser,
  notion: NotionParser,
  slack: SlackParser
}

export const SUPPORTED_APPS: WebApp[] = [
  {
    id: 'reddit',
    name: 'Reddit',
    matchHostname: /reddit.com/,
    supportedResources: [ResourceTypes.POST_REDDIT]
  },
  {
    id: 'twitter',
    name: 'Twitter',
    matchHostname: /twitter.com/,
    supportedResources: [ResourceTypes.POST_TWITTER]
  },
  {
    id: 'notion',
    name: 'Notion',
    matchHostname: /notion.so/,
    supportedResources: [ResourceTypes.DOCUMENT_NOTION]
  },
  {
    id: 'slack',
    name: 'Slack',
    matchHostname: /slack.com/,
    supportedResources: [ResourceTypes.CHAT_MESSAGE_SLACK, ResourceTypes.CHAT_THREAD_SLACK]
  }
]

const wait = (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export class WebParser {
  url: URL

  constructor(url: string) {
    this.url = new URL(url)
  }

  isSupportedApp() {
    const hostname = this.url.hostname
    const app = SUPPORTED_APPS.find((app) => app.matchHostname.test(hostname))

    return !!app
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

    return new Parser(app, this.url)
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

    return extracted
  }

  static getAppParser(url: string) {
    const webParser = new WebParser(url)
    const appParser = webParser.createAppParser()
    if (!appParser) return null

    return appParser
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
