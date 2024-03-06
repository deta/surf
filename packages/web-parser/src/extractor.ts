/*

    Flow to detect supported web apps and resources within that we can extract data from:
    1. Detect the web app based on the URL
    2. Detect the resource type based on the URL and HTML
    3. Extract the resource data from the web app
    4. Create a resource object with the data

*/

import { ResourceTypes } from '@horizon/types'

import { RedditParser, TwitterParser, NotionParser } from './sites/index'
import { WebApp } from './types'
import { MetadataExtractor } from './extractors/metadata'

const ParserModules = {
  reddit: RedditParser,
  twitter: TwitterParser,
  notion: NotionParser
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
  }
]

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

  static async getMetadata(url: string) {
    const webParser = new WebParser(url)
    const metadataParser = webParser.createMetadataExtractor()

    return metadataParser.extractRemote()
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

    const preview = await webParser.fetchMetadata() // { title: 'Elon Musk on Twitter', description: 'Elon Musk tweet', image: 'https://twitter.com/elonmusk/status/123/photo/1' }

*/
