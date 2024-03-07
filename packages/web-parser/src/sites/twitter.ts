import { ResourceTypes, type ResourceDataPost } from '@horizon/types'

import { WebAppExtractor } from '../extractors'
import type { DetectedWebApp, WebApp } from '../types'

export const TwitterRegexPatterns = {
  // example: /@detahq/status/1441160730730736640
  tweet: /^\/[a-zA-Z0-9_-]+\/status\/[0-9]+\/?$/
}

export type TweetData = {
  tweetId: string
  content: string
  contentHtml: string
  author: string
  username: string
  publishedAt: string
  likeNumber: number
}

export class TwitterParser extends WebAppExtractor {
  constructor(app: WebApp, url: URL) {
    super(app, url)
  }

  detectResourceType() {
    console.log('Detecting resource type', this.url.pathname)

    const pathname = this.url.pathname
    if (TwitterRegexPatterns.tweet.test(pathname)) {
      console.log('Detected tweet')
      return ResourceTypes.POST_TWITTER
    } else {
      console.log('Unknown resource type')
      return null
    }
  }

  private getTweetId() {
    return this.url.pathname.split('/').pop() ?? null
  }

  getInfo(): DetectedWebApp {
    const resourceType = this.detectResourceType()
    const appResourceIdentifier =
      resourceType === ResourceTypes.POST_TWITTER ? this.getTweetId() : null

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
    if (type === ResourceTypes.POST_TWITTER) {
      const tweet = await this.getTweet(document)
      if (!tweet) return null

      const post = this.normalizePost(tweet)

      console.log('normalized post', post)

      return {
        data: post,
        type: ResourceTypes.POST_TWITTER
      }
    } else {
      console.log('Unknown resource type')
      return Promise.resolve(null)
    }
  }

  private async getTweet(document: Document) {
    try {
      const tweetId = this.url.pathname.split('/').pop()
      if (!tweetId) {
        console.log('No tweet id found')
        return null
      }

      const tweetElem = document.querySelector('[data-testid="tweet"]')
      if (!tweetElem) {
        console.log('No tweet found')
        return null
      }

      const contentElem = tweetElem.querySelector('[data-testid="tweetText"]')
      if (!contentElem) {
        console.log('No tweet content found')
        return null
      }

      const contentHtml = contentElem.innerHTML
      const content = contentElem.textContent
      if (!content) {
        console.log('No tweet content found')
        return null
      }

      const userElem = tweetElem.querySelector('div[data-testid="User-Name"]')
      if (!userElem) {
        console.log('No user found')
        return null
      }

      const user = userElem.textContent?.split('@')
      if (!user || user.length < 2) {
        console.log('No user found')
        return null
      }

      const author = user[0].trim()
      const username = user[1].trim()

      const publishedAt = tweetElem.querySelector('time')?.getAttribute('datetime')
      if (!publishedAt) {
        console.log('No published date found')
        return null
      }

      const likes =
        tweetElem.querySelector(`a[href="/${username}/status/${tweetId}/likes"] div`)
          ?.textContent ?? '0'
      const likeNumber = parseInt(likes.replace(/,/g, ''))

      return {
        tweetId,
        content,
        contentHtml,
        author,
        username,
        publishedAt,
        likeNumber
      } as TweetData
    } catch (e) {
      console.error('Error getting post data', e)
      return null
    }
  }

  private normalizePost(data: TweetData) {
    return {
      post_id: data.tweetId,
      title: data.content,
      url: this.url.href,
      date_published: new Date(data.publishedAt).toISOString(),
      date_edited: null,
      edited: null,
      site_name: 'Twitter',
      site_icon: 'https://abs.twimg.com/responsive-web/web/icon-default.1ea219d5.png',

      author: data.username,
      author_fullname: data.author,
      author_image: `https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png`,
      author_url: `https://www.twitter.com/${data.username}`,

      excerpt: data.content,
      content_plain: data.content,
      content_html: data.contentHtml,
      lang: null,

      links: [],
      images: [],
      video: [],

      parent_url: `https://www.twitter.com/${data.username}`,
      parent_title: `@${data.username}`,

      stats: {
        views: null,
        up_votes: data.likeNumber,
        down_votes: null,
        comments: null
      }
    } as ResourceDataPost
  }
}

export default TwitterParser
