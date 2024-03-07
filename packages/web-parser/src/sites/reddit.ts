import { ResourceTypes, type ResourceDataPost } from '@horizon/types'
import type { DetectedWebApp, WebApp } from '../types'

import { APIExtractor, WebAppExtractor } from '../extractors'

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
  constructor(app: WebApp, url: URL) {
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

  getInfo(): DetectedWebApp {
    const resourceType = this.detectResourceType()
    const appResourceIdentifier =
      resourceType === ResourceTypes.POST_REDDIT ? this.getPostId() : null

    return {
      appId: this.app?.id ?? null,
      appName: this.app?.name ?? null,
      hostname: this.url.hostname,
      resourceType: resourceType,
      appResourceIdentifier: appResourceIdentifier,
      resourceNeedsPicking: false
    }
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
    const links = post.url ? [post.url] : []
    let images: string[] = []

    // TODO: add support for more ways to get images
    if (post.media_metadata) {
      images = Object.values(post.media_metadata).map((img: any) => img?.s?.u as string)
    } else if (post.preview) {
      images = post.preview.images.map((img: any) => img.source.url as string)
    } else if (post.thumbnail) {
      images = [post.thumbnail]
    }

    return {
      post_id: post.id,
      title: post.title,
      url: `https://www.reddit.com${post.permalink}`,
      date_published: new Date(post.created * 1000).toISOString(),
      date_edited: null,
      edited: post.edited,
      site_name: 'Reddit',
      site_icon: 'https://www.redditstatic.com/desktop2x/img/favicon/apple-icon-57x57.png',

      author: post.author,
      author_fullname: post.author_fullname,
      author_image: `https://www.redditstatic.com/avatars/avatar_default_15_24A0ED.png`,
      author_url: `https://www.reddit.com/user/${post.author_fullname}`,

      excerpt: post.selftext,
      content_plain: post.selftext,
      content_html: post.selftext_html,
      lang: null,

      links: links,
      images: images,
      video: [], // TODO: add video support

      parent_url: `https://www.reddit.com/r/${post.subreddit}`,
      parent_title: `/r/${post.subreddit}`,

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
