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

export class YoutubePlaylistImporter extends AppImporter {
  webParser: WebParser
  webviewExtractor: WebViewExtractor

  constructor(playlistUrl: string) {
    super()

    this.webParser = new WebParser(playlistUrl)
    this.webviewExtractor = this.webParser.createWebviewExtractor(document)
  }

  async init() {
    await this.webviewExtractor.initializeWebview()

    this.webviewExtractor.webview?.openDevTools()

    await wait(3000)
  }

  async fetchPlaylist(limit: number = 100, cursor?: string) {
    const extractedResource = await this.webviewExtractor.runAction(
      'get_posts_from_youtube_playlist'
    )

    console.log('Extracted resource', extractedResource)

    return extractedResource?.data as any as ResourceDataPost[]
  }

  getBatchFetcher(size: number) {
    const batcher = new BatchFetcher<DetectedResource>(size, async (limit, offset) => {
      const json = await this.fetchPlaylist(limit, offset as string)

      return {
        data: json.map((item) => ({ type: ResourceTypes.POST_YOUTUBE, data: item })),
        nextOffset: ''
      }
    })

    return batcher
  }
}
