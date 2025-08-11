import { ResourceTypes, type ResourceDataPost } from '@deta/types'
import type { DetectedWebApp, WebService } from '../types'

import { APIExtractor, WebAppExtractor } from '../extractors'
import { sanitizeHTML } from '../utils'
import { parseStringIntoUrl } from '@deta/utils'

export const RedditRegexPatterns = {
  subreddit: /^\/r\/[a-zA-Z0-9_-]+\/?$/,
  post: /^\/r\/[a-zA-Z0-9_-]+\/comments\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/?$/
}

export type RedditPost = {
  id: string
  title: string
  author: string
  author_fullname: string
  created: number
  downs: number
  ups: number
  num_comments: number
  view_count: number | null
  edited: boolean
  is_video: boolean
  selftext: string
  selftext_html: string
  subreddit: string
  subreddit_id: string
  permalink: string
  url: string
  preview?: any
  thumbnail?: string
  media_metadata?: any
}

export class RedditParser extends WebAppExtractor {
  constructor(app: WebService, url: URL) {
    super(app, url)
  }

  detectResourceType() {
    console.log('Detecting resource type')

    const pathname = this.url.pathname
    if (RedditRegexPatterns.post.test(pathname)) {
      console.log('Detected post')
      return ResourceTypes.POST_REDDIT
      // } else if (RedditRegexPatterns.subreddit.test(pathname)) {
      //     console.log('Detected subreddit')
      //     return 'subreddit'
    } else {
      console.log('Unknown resource type')
      return null
    }
  }

  private getPostId() {
    // For "/r/programming/comments/1b690im/native_vs_hybrid_vs_crossplatform_development/"" extract "1b690im"
    return this.url.pathname.split('/')[4] ?? null
  }

  private getSubreddit() {
    // For "/r/programming/comments/1b690im/native_vs_hybrid_vs_crossplatform_development/"" extract "programming"
    return this.url.pathname.split('/')[2] ?? null
  }

  getInfo(): DetectedWebApp {
    const resourceType = this.detectResourceType()
    const appResourceIdentifier =
      resourceType === ResourceTypes.POST_REDDIT ? this.getPostId() : this.url.pathname

    return {
      appId: this.app?.id ?? null,
      appName: this.app?.name ?? null,
      hostname: this.url.hostname,
      canonicalUrl: this.url.href,
      resourceType: resourceType,
      appResourceIdentifier: appResourceIdentifier,
      resourceNeedsPicking: false
    }
  }

  getRSSFeedUrl(document: Document) {
    const subreddit = this.getSubreddit()
    if (!subreddit) return null

    return `https://www.reddit.com/r/${subreddit}.rss`
  }

  async extractResourceFromDocument(_document: Document) {
    const type = this.detectResourceType()
    if (type === ResourceTypes.POST_REDDIT) {
      const rawPost = await this.getPost()
      if (!rawPost) return null

      const post = this.normalizePost(rawPost)

      console.log('normalized post', post)

      return {
        data: post,
        type: ResourceTypes.POST_REDDIT
      }
    } else {
      console.log('Unknown resource type')
      return Promise.resolve(null)
    }
  }

  private async getPost() {
    try {
      const api = new APIExtractor(this.url.origin)

      const data = await api.getJSON(`${this.url.pathname}.json`)

      if (
        !data ||
        !data[0] ||
        !data[0].data ||
        !data[0].data.children ||
        data[0].data.children.length < 1
      ) {
        console.log('No data found')
        return null
      }

      console.log('raw data', data)

      const post = data[0].data.children[0].data

      console.log('post', post)

      return post
    } catch (e) {
      console.error('Error getting post data', e)
      return null
    }
  }

  private normalizePost(post: RedditPost) {
    let images: string[] = []

    // TODO: add support for more ways to get images
    if (post.media_metadata) {
      images = Object.values(post.media_metadata).map((img: any) => img?.s?.u as string)
    } else if (post.preview) {
      images = post.preview.images.map((img: any) => img.source.url as string)
    } else if (post.thumbnail) {
      images = [post.thumbnail]
    }

    const cleanImages = images
      .map((img) => parseStringIntoUrl(img)?.href)
      .filter((x) => !!x) as string[]
    const cleanSubreddit = sanitizeHTML(post.subreddit)

    return {
      post_id: sanitizeHTML(post.id),
      title: sanitizeHTML(post.title),
      url: parseStringIntoUrl(`https://www.reddit.com${post.permalink}`)?.href ?? this.url.href,
      date_published: new Date(post.created * 1000).toISOString(),
      date_edited: null,
      edited: post.edited,
      site_name: 'Reddit',
      site_icon: 'https://www.redditstatic.com/desktop2x/img/favicon/apple-icon-57x57.png',

      author: sanitizeHTML(post.author),
      author_fullname: sanitizeHTML(post.author_fullname),
      author_image: `https://www.redditstatic.com/avatars/avatar_default_15_24A0ED.png`,
      author_url: `https://www.reddit.com/user/${post.author_fullname}`,

      excerpt: sanitizeHTML(post.selftext),
      content_plain: sanitizeHTML(post.selftext),
      content_html: sanitizeHTML(post.selftext_html),
      lang: null,

      links: [post.url],
      images: cleanImages,
      video: [], // TODO: add video support

      parent_url: `https://www.reddit.com/r/${cleanSubreddit}`,
      parent_title: `/r/${cleanSubreddit}`,

      stats: {
        views: post.view_count,
        up_votes: post.ups,
        down_votes: post.downs,
        comments: post.num_comments
      }
    } as ResourceDataPost
  }
}

export default RedditParser
