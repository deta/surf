import { ResourceTypes, type ResourceDataPost } from '@horizon/types'

import { WebAppExtractor } from '../extractors'
import type { DetectedWebApp, WebService } from '../types'
import { makeAbsoluteURL } from '../utils'
import { DOMExtractor } from '../extractors/dom'

export const YoutubeRegexPatterns = {
  // example: /watch?v=I_wc3DfgQvs or /embed/I_wc3DfgQvs or /I_wc3DfgQvs /watch
  video: /^\/[a-zA-Z0-9_-]+\/status\/[0-9]+\/?$/
}

export type VideoData = {
  videoId: string
  videoUrl: string
  imageUrl: string
  title: string
  excerpt: string
  description: string | null
  descriptionHtml: string | null
  creator: string
  creator_url: string
  creator_image: string
  publishedAt: string
  viewNumber: number
}

export class YouTubeDocumentParser extends DOMExtractor {
  constructor(document: Document) {
    super(document)
  }

  getViewCount() {
    const viewCountElem = this.document.querySelector(
      'yt-formatted-string.ytd-watch-info-text span'
    )
    const viewCountTextRaw = viewCountElem?.textContent ?? null // '614.393 Aufrufe'
    if (!viewCountTextRaw) return null

    const onlyViewCount = viewCountTextRaw?.split(' ')[0]
    if (!onlyViewCount) return null

    const parseToInt = (text: string) => {
      try {
        return parseInt(text)
      } catch (e) {
        return null
      }
    }

    if (onlyViewCount.includes('.')) {
      // '614.393' => 614393
      const viewCountRaw = onlyViewCount?.split('.').join('')
      return parseToInt(viewCountRaw)
    } else if (onlyViewCount.includes(',')) {
      // '614,393' => 614393
      const viewCountRaw = onlyViewCount?.split(',').join('')
      return parseToInt(viewCountRaw)
    } else if (onlyViewCount.includes('K')) {
      // '614K' => 614000
      const viewCountRaw = onlyViewCount?.split('K').join('000')
      return parseToInt(viewCountRaw)
    } else {
      return parseToInt(onlyViewCount)
    }
  }

  parseVideoObjectElement(elem: Element) {
    const videoId = elem.querySelector('[itemprop="identifier"]')?.getAttribute('content') ?? null

    const title = elem.querySelector('[itemprop="name"]')?.getAttribute('content') ?? null
    const description =
      elem.querySelector('[itemprop="description"]')?.getAttribute('content') ?? null

    const authorElem = elem.querySelector('[itemprop="author"]')
    const authorUrl = authorElem?.querySelector('[itemprop="url"]')?.getAttribute('href') ?? null
    const authorName =
      authorElem?.querySelector('[itemprop="name"]')?.getAttribute('content') ?? null

    const thumbnailUrl =
      elem.querySelector('[itemprop="thumbnailUrl"]')?.getAttribute('href') ?? null
    const videoUrl = elem.querySelector('[itemprop="embedUrl"]')?.getAttribute('href') ?? null

    const viewCountRaw =
      elem.querySelector('[itemprop="interactionCount"]')?.getAttribute('content') ?? null
    const viewCount = viewCountRaw ? parseInt(viewCountRaw) : null

    const publishDateRaw =
      elem.querySelector('[itemprop="datePublished"]')?.getAttribute('content') ?? null
    const publishDate = publishDateRaw ? new Date(publishDateRaw).toISOString() : null

    return {
      videoId: videoId,
      videoUrl: videoUrl,
      title: title,
      description: description,
      imageUrl: thumbnailUrl,
      authorName: authorName,
      authorUrl: authorUrl,
      viewCount: viewCount,
      publishDate: publishDate
    }
  }
}

export class YoutubeParser extends WebAppExtractor {
  constructor(app: WebService, url: URL) {
    super(app, url)
  }

  detectResourceType() {
    console.log('Detecting resource type', this.url.pathname)

    const videoId = this.getVideoId()
    if (videoId) {
      console.log('Detected video')
      return ResourceTypes.POST_YOUTUBE
    } else {
      console.log('Unknown resource type')
      return null
    }
  }

  private getVideoId() {
    const url = this.url.href
    const regex = /[?&]v=([^&#]+)/
    const regexShort = /(?:\/)([a-zA-Z0-9_-]{11})(?:\/|$|\?)/
    const match = url.match(regex) || url.match(regexShort)

    if (match) {
      return match[1]
    } else {
      return null
    }
  }

  getInfo(): DetectedWebApp {
    const resourceType = this.detectResourceType()
    const appResourceIdentifier =
      resourceType === ResourceTypes.POST_YOUTUBE ? this.getVideoId() : null

    return {
      appId: this.app?.id ?? null,
      appName: this.app?.name ?? null,
      hostname: this.url.hostname,
      resourceType: resourceType,
      appResourceIdentifier: appResourceIdentifier,
      resourceNeedsPicking: false
    }
  }

  async extractResourceFromDocument(document: Document) {
    const type = this.detectResourceType()
    if (type === ResourceTypes.POST_YOUTUBE) {
      const video = await this.getVideo(document)
      if (!video) return null

      const post = this.normalizeVideo(video)

      console.log('normalized post', post)

      return {
        data: post,
        type: ResourceTypes.POST_YOUTUBE
      }
    } else {
      console.log('Unknown resource type')
      return Promise.resolve(null)
    }
  }

  private async getVideo(document: Document) {
    try {
      const parser = new YouTubeDocumentParser(document)

      const videoId = this.getVideoId()
      if (!videoId) {
        console.log('No video id found')
        return null
      }

      const title = document.querySelector('#title h1')?.textContent
      if (!title) {
        console.log('No title found')
        return null
      }

      const videoObject = document.querySelector('div[itemtype="http://schema.org/VideoObject"]')
      let videoObjectData = videoObject ? parser.parseVideoObjectElement(videoObject) : null

      // if you navigate to a different video without a page reload the old videoObject will still be there
      if (videoObjectData && videoObjectData.videoId !== videoId) {
        videoObjectData = null
      }

      const videoUrl =
        document.querySelector('meta[property="og:video:url"]')?.getAttribute('content') ??
        this.url.href
      const creatorElem = document.querySelector('yt-formatted-string.ytd-channel-name')
      const creator = creatorElem?.textContent ?? null
      const creatorUrlRaw = creatorElem?.querySelector('a')?.getAttribute('href')
      const createUrl = creatorUrlRaw ? makeAbsoluteURL(creatorUrlRaw, this.url) : null
      const creatorImage = document.querySelector('#avatar img')?.getAttribute('src') ?? null

      const excerpt =
        document.querySelector('meta[name="description"]')?.getAttribute('content') ?? null
      const image =
        document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? null

      const viewNumber = parser.getViewCount()
      // TODO: parse likeNumber and commentsNumber from the page (needs to account for different languages and formats)

      return {
        videoId: videoId,
        videoUrl: videoObjectData?.videoUrl ?? videoUrl,
        imageUrl: videoObjectData?.imageUrl ?? image,
        title: videoObjectData?.title ?? title,
        excerpt: videoObjectData?.description ?? excerpt,
        description: null,
        descriptionHtml: null,
        creator: videoObjectData?.authorName ?? creator,
        creator_url: videoObjectData?.authorUrl ?? createUrl,
        creator_image: creatorImage,
        publishedAt: videoObjectData?.publishDate ?? null,
        viewNumber: videoObjectData?.viewCount ?? viewNumber
      } as VideoData
    } catch (e) {
      console.error('Error getting post data', e)
      return null
    }
  }

  private normalizeVideo(data: VideoData) {
    const lang = document.documentElement.lang

    return {
      post_id: data.videoId,
      title: data.title,
      url: this.url.href,
      date_published: data.publishedAt ?? null,
      date_edited: null,
      edited: null,
      site_name: 'YouTube',
      site_icon: `https://www.youtube.com/s/desktop/4b6b3e7e/img/favicon_32.png`,

      author: data.creator,
      author_fullname: data.creator,
      author_image: data.creator_image,
      author_url: data.creator_url,

      excerpt: data.excerpt,
      content_plain: data.description,
      content_html: data.descriptionHtml,
      lang: lang,

      links: [],
      images: [data.imageUrl],
      video: [data.videoUrl],

      parent_url: data.creator_url,
      parent_title: data.creator,

      stats: {
        views: data.viewNumber,
        up_votes: null,
        down_votes: null,
        comments: null
      }
    } as ResourceDataPost
  }
}

export default YoutubeParser
