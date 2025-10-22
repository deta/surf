/*
SAMPLE LINK:
{
    "addedAt": "2024-05-05T20:17:16.547Z",
    "addedWith": "web",
    "crate": "null",
    "id": "xKMANuJucTnzLT48",
    "key": "8638285059763454-ku-gc62wf6",
    "meta": {
        "description": "Experience a calmer, more human Internet",
        "icon": "https://sublime.app/apple-touch-icon.png?v=2",
        "image": "https://sublime.app/preview-landing.png",
        "title": "Sublime"
    },
    "public": false,
    "url": "https://sublime.app/"
}
*/

import { type ResourceDataPost, ResourceTypes } from '@deta/types'
import { BatchFetcher } from '../batcher'
import { AppImporter } from './index'
import { type DetectedResource } from '../../types'
import { WebParser, WebViewExtractor } from '../..'
import { wait } from '@deta/utils'

export type TwitterAuthData = {
  uid: string
  authorization: string
  clientTransactionId: string
  csrfToken: string
}

export class TwitterImporter extends AppImporter {
  webParser: WebParser
  webviewExtractor: WebViewExtractor

  authData: TwitterAuthData | null = null

  constructor() {
    super()

    this.webParser = new WebParser('https://x.com/i/bookmarks')
    this.webviewExtractor = this.webParser.createWebviewExtractor(document)
  }

  async init() {
    // we need to start intercepting requests before initializing the webview
    // @ts-ignore
    window.api
      // Dang. The partition here MUST not be the `persist:horizon` partition.
      .interceptRequestsHeaders(['https://x.com/i/api/*'], this.webviewExtractor.partition)
      .then((data: any) => {
        this.authData = {
          uid: 'yzqS_xq0glDD7YZJ2YDaiA',
          authorization: data.headers.authorization,
          clientTransactionId: data.headers['x-client-transaction-id'],
          csrfToken: data.headers['x-csrf-token']
        }
      })

    await this.webviewExtractor.initializeWebview()

    this.webviewExtractor.webview?.openDevTools()

    await wait(3000)
  }

  async fetchBookmarks(limit: number = 100, cursor?: string) {
    if (!this.authData) {
      throw new Error('Auth data not found')
    }

    const extractedResource = await this.webviewExtractor.runAction('get_bookmarks_from_twitter', {
      ...this.authData,
      limit,
      cursor
    })

    return extractedResource?.data as any as { posts: ResourceDataPost[]; cursor: string }
  }

  getBatchFetcher(size: number) {
    const batcher = new BatchFetcher<DetectedResource>(size, async (limit, offset) => {
      const json = await this.fetchBookmarks(limit, offset as string)

      return {
        data: json.posts.map((item) => ({ type: ResourceTypes.POST_TWITTER, data: item })),
        nextOffset: json.cursor
      }
    })

    return batcher
  }
}
