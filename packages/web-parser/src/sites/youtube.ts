import { ResourceTypes, type ResourceDataPost } from '@deta/types'

import { WebAppExtractor } from '../extractors'
import type { DetectedWebApp, WebService, WebServiceActionInputs } from '../types'
import { makeAbsoluteURL, parseStringIntoUrl, parseTextIntoISOString } from '@deta/utils'
import { DOMExtractor } from '../extractors/dom'
import { SERVICES } from '../services'
import { WebParser } from '..'
import { sanitizeHTML } from '../utils'

export const YoutubeRegexPatterns = {
  // example: /watch?v=I_wc3DfgQvs or /embed/I_wc3DfgQvs or /I_wc3DfgQvs /watch
  video: /^\/[a-zA-Z0-9_-]+\/status\/[0-9]+\/?$/,
  channelId: /channel\/([a-zA-Z0-9%_-]+)/,
  channelName: /(?:c|user)\/[a-zA-Z0-9%_-]+/,
  channelHandle: /@[a-zA-Z0-9%_-]+/,
  channelFeatured: /\/[a-zA-Z0-9%_-]+\/featured/
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
    } else if (this.url.pathname.includes('/playlist')) {
      console.log('Detected playlist')
      return ResourceTypes.PLAYLIST_YOUTUBE
    } else if (this.isChannelUrl()) {
      console.log('Detected channel')
      return ResourceTypes.CHANNEL_YOUTUBE
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

  private isChannelUrl() {
    // YouTube's canonical channel URLs look like /channel/AlphaNumericID
    // It also supports named channels of the form /c/MyChannelName
    // and handle links of the form /@MyChannelHandle.
    // Match also on '%' to handle non-latin character codes
    // Match on both of these to autodetect channel feeds on either URL
    const url = this.url.href
    const urlPattern = new RegExp(
      `${YoutubeRegexPatterns.channelId.source}|${YoutubeRegexPatterns.channelName.source}|${YoutubeRegexPatterns.channelHandle.source}|${YoutubeRegexPatterns.channelFeatured.source}`
    )

    return url.match(urlPattern) ? true : false
  }

  private getChannelID(document: Document) {
    const canonicalElem = document.querySelector("link[rel='canonical']")
    if (!canonicalElem) {
      return null
    }

    const canonicalUrl = (canonicalElem as HTMLLinkElement).href
    const match = canonicalUrl.match(YoutubeRegexPatterns.channelId)
    if (!match) {
      return null
    }

    const channelId = match[1]
    return channelId
  }

  private getChannelIdentifier() {
    // YouTube's canonical channel URLs look like /channel/AlphaNumericID
    // It also supports named channels of the form /c/MyChannelName
    // and handle links of the form /@MyChannelHandle.
    // Match also on '%' to handle non-latin character codes
    // Match on both of these to autodetect channel feeds on either URL
    const url = this.url.href
    const idPattern = /channel\/([a-zA-Z0-9%_-]+)/
    const namePattern = /(?:c|user)\/[a-zA-Z0-9%_-]+/
    const handlePattern = /@[a-zA-Z0-9%_-]+/
    const userPattern = /\/([a-zA-Z0-9%_-]+)/

    const idMatch = url.match(idPattern)
    if (idMatch) {
      return idMatch[1]
    }

    const nameMatch = url.match(namePattern)
    if (nameMatch) {
      return nameMatch[0]
    }

    const handleMatch = url.match(handlePattern)
    if (handleMatch) {
      return handleMatch[0].substring(1)
    }

    const userMatch = url.match(userPattern)
    if (userMatch) {
      return userMatch[1]
    }

    return null
  }

  private getPlayListId() {
    const url = this.url.href
    const regex = /[?&]list=([^&#]+)/
    const match = url.match(regex)

    if (match) {
      return match[1]
    } else {
      return null
    }
  }

  private getResourceIdentifier() {
    if (this.url.pathname.includes('/playlist')) {
      return this.getPlayListId()
    } else if (this.url.pathname.includes('/watch')) {
      return this.getVideoId()
    } else {
      return this.getChannelIdentifier()
    }
  }

  private cleanedUpUrl() {
    const youtubeHostnames = [
      'youtube.com',
      'youtu.be',
      'youtube.de',
      'www.youtube.com',
      'www.youtu.be',
      'www.youtube.de'
    ]

    if (youtubeHostnames.includes(this.url.host)) {
      return this.url.href.replace(/&t.*/g, '')
    }

    return this.url.href
  }

  getRSSFeedUrl(document: Document) {
    if (this.url.pathname.includes('/playlist')) {
      const playlistId = this.getPlayListId()
      if (!playlistId) {
        console.log('No playlist ID found')
        return null
      }

      return `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`
    }

    if (this.url.pathname.includes('/watch')) {
      return null
    }

    const channelId = this.getChannelID(document)
    if (channelId) {
      return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    }

    console.log('No channel URL found')
    return null
  }

  getInfo(): DetectedWebApp {
    const resourceType = this.detectResourceType()
    const appResourceIdentifier = this.getResourceIdentifier()

    return {
      appId: this.app?.id ?? null,
      appName: this.app?.name ?? null,
      hostname: this.url.hostname,
      canonicalUrl: this.cleanedUpUrl(),
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
      console.log('Unknown resource type, using fallback parser')
      const fallbackParser = WebParser.useFallbackParser(document, this.url)
      return fallbackParser?.extractResourceFromDocument(document)
    }
  }

  getActions() {
    return SERVICES.find((service) => service.id === 'youtube')?.actions ?? []
  }

  async runAction(document: Document, id: string, inputs: WebServiceActionInputs) {
    const action = this.getActions().find((action) => action.id === id)
    if (!action) return null

    console.log('Running action', action.id)

    if (action.id === 'get_posts_from_youtube_playlist') {
      const {} = inputs

      const data = await this.getPlaylist(document)
      if (!data) return null

      console.log('data', data)

      return {
        data: data,
        type: ResourceTypes.POST_YOUTUBE
      }
    } else {
      console.log('Unknown action')
      return null
    }
  }

  async getPlaylist(document: Document) {
    const list = document.querySelector('ytd-playlist-video-list-renderer')
    if (!list) {
      console.log('No playlist found')
      return null
    }

    const videos = list.querySelectorAll('ytd-playlist-video-renderer')
    if (!videos.length) {
      console.log('No videos found')
      return null
    }

    const videoData = Array.from(videos).map((video) => {
      const url = video.querySelector('a')?.getAttribute('href')
      if (!url) return null

      const videoUrl = makeAbsoluteURL(url, this.url)
      if (!videoUrl) return null

      const cleanUrl = videoUrl.split('&')[0]

      const title = video.querySelector('#video-title')?.textContent
      const channelElem = video.querySelector('#channel-name a')
      const channelName = channelElem?.textContent
      const channelUrlRaw = channelElem?.getAttribute('href')
      const channelUrl = channelUrlRaw ? makeAbsoluteURL(channelUrlRaw, this.url) : null
      const thumbnailUrl = video.querySelector('yt-image img')?.getAttribute('src')
      const cleanThumbnailUrl = thumbnailUrl ? parseStringIntoUrl(thumbnailUrl)?.href : null

      return {
        url: parseStringIntoUrl(cleanUrl)?.href,
        post_id: sanitizeHTML(cleanUrl.split('=')[1]),
        title: title ? sanitizeHTML(title) : null,
        author: channelName ? sanitizeHTML(channelName) : null,
        author_url: channelUrl ? parseStringIntoUrl(channelUrl)?.href : null,
        images: cleanThumbnailUrl ? [cleanThumbnailUrl] : []
      } as ResourceDataPost
    })

    return videoData.filter((video) => video !== null) as ResourceDataPost[]
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

    const cleanImageUrl = parseStringIntoUrl(data.imageUrl, this.url)?.href
    const cleanVideoUrl = parseStringIntoUrl(data.videoUrl, this.url)?.href

    return {
      post_id: sanitizeHTML(data.videoId),
      title: sanitizeHTML(data.title),
      url: this.url.href,
      date_published: parseTextIntoISOString(data.publishedAt) ?? null,
      date_edited: null,
      edited: null,
      site_name: 'YouTube',
      site_icon: `https://www.youtube.com/s/desktop/4b6b3e7e/img/favicon_32.png`,

      author: sanitizeHTML(data.creator),
      author_fullname: sanitizeHTML(data.creator),
      author_image: parseStringIntoUrl(data.creator_image, this.url)?.href,
      author_url: parseStringIntoUrl(data.creator_url, this.url)?.href,

      excerpt: sanitizeHTML(data.excerpt),
      content_plain: data.description ? sanitizeHTML(data.description) : null,
      content_html: data.descriptionHtml ? sanitizeHTML(data.descriptionHtml) : null,
      lang: sanitizeHTML(lang),

      links: [],
      images: cleanImageUrl ? [cleanImageUrl] : [],
      video: cleanVideoUrl ? [cleanVideoUrl] : [],

      parent_url: parseStringIntoUrl(data.creator_url, this.url)?.href,
      parent_title: sanitizeHTML(data.creator),

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
