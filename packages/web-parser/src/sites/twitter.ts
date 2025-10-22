import { ResourceTypes, type ResourceDataPost } from '@deta/types'

import { APIExtractor, WebAppExtractor } from '../extractors'
import type { DetectedWebApp, WebService, WebServiceActionInputs } from '../types'
import { SERVICES } from '../services'
import { WebParser } from '..'
import { sanitizeHTML } from '../utils'
import { parseStringIntoUrl, parseTextIntoISOString } from '@deta/utils'

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
  tweetImageSources: string[]
}

const MAX_RETRIES = 3

export class TwitterParser extends WebAppExtractor {
  constructor(app: WebService, url: URL) {
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
      resourceType === ResourceTypes.POST_TWITTER ? this.getTweetId() : this.url.pathname

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
      console.log('Unknown resource type, using fallback parser')
      const fallbackParser = WebParser.useFallbackParser(document, this.url)
      return fallbackParser.extractResourceFromDocument(document)
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

      const tweetImageElements = tweetElem.querySelectorAll('img')
      const tweetImageSources = Array.from(tweetImageElements).map((img) => img.src)

      return {
        tweetId,
        content,
        contentHtml,
        author,
        username,
        publishedAt,
        likeNumber,
        tweetImageSources
      } as TweetData
    } catch (e) {
      console.error('Error getting post data', e)
      return null
    }
  }

  private normalizePost(data: TweetData) {
    const [authorImage, ...images] = data.tweetImageSources

    const cleanUsername = sanitizeHTML(data.username)
    const cleanImages = images.map((img) => parseStringIntoUrl(img)?.href).filter((x) => !!x)

    return {
      post_id: sanitizeHTML(data.tweetId),
      title: sanitizeHTML(data.content),
      url: this.url.href,
      date_published: parseTextIntoISOString(data.publishedAt),
      date_edited: null,
      edited: null,
      site_name: 'Twitter',
      site_icon: 'https://abs.twimg.com/responsive-web/web/icon-default.1ea219d5.png',

      author: sanitizeHTML(data.username),
      author_fullname: sanitizeHTML(data.author),
      author_image: parseStringIntoUrl(authorImage)?.href,
      author_url: `https://www.twitter.com/${cleanUsername}`,

      excerpt: sanitizeHTML(data.content),
      content_plain: sanitizeHTML(data.content),
      content_html: sanitizeHTML(data.contentHtml),
      lang: null,

      links: [],
      images: cleanImages,
      video: [],

      parent_url: `https://www.twitter.com/${cleanUsername}`,
      parent_title: `@${cleanUsername}`,

      stats: {
        views: null,
        up_votes: data.likeNumber,
        down_votes: null,
        comments: null
      }
    } as ResourceDataPost
  }

  getActions() {
    return SERVICES.find((service) => service.id === 'twitter')?.actions ?? []
  }

  async runAction(document: Document, id: string, inputs: WebServiceActionInputs) {
    const action = this.getActions().find((action) => action.id === id)
    if (!action) return null

    console.log('Running action', action.id)

    if (action.id === 'get_bookmarks_from_twitter') {
      const { uid, authorization, clientTransactionId, csrfToken, limit, cursor } = inputs

      const data = await this.getBookmarks(
        uid,
        {
          authorization,
          clientTransactionId,
          csrfToken
        },
        limit,
        cursor
      )
      if (!data) return null

      console.log('data', data)

      return {
        data: data,
        type: 'application/vnd.space.post.twitter.paginated'
      }
    } else {
      console.log('Unknown action')
      return null
    }
  }

  async getBookmarks(
    uid: string,
    headers: { authorization: string; clientTransactionId: string; csrfToken: string },
    limit = 100,
    cursor?: string,
    retryCount = 0
  ): Promise<null | { posts: ResourceDataPost[]; cursor: string }> {
    try {
      const base = `https://x.com/i/api/graphql/${uid}/Bookmarks`
      const queryParams = {
        variables: {
          count: limit,
          cursor: cursor,
          includePromotedContent: true
        },
        features: {
          graphql_timeline_v2_bookmark_timeline: true,
          rweb_tipjar_consumption_enabled: true,
          responsive_web_graphql_exclude_directive_enabled: true,
          verified_phone_label_enabled: false,
          creator_subscriptions_tweet_preview_api_enabled: true,
          responsive_web_graphql_timeline_navigation_enabled: true,
          responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
          communities_web_enable_tweet_community_results_fetch: true,
          c9s_tweet_anatomy_moderator_badge_enabled: true,
          articles_preview_enabled: true,
          tweetypie_unmention_optimization_enabled: true,
          responsive_web_edit_tweet_api_enabled: true,
          graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
          view_counts_everywhere_api_enabled: true,
          longform_notetweets_consumption_enabled: true,
          responsive_web_twitter_article_tweet_consumption_enabled: true,
          tweet_awards_web_tipping_enabled: false,
          creator_subscriptions_quote_tweet_preview_enabled: false,
          freedom_of_speech_not_reach_fetch_enabled: true,
          standardized_nudges_misinfo: true,
          tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
          tweet_with_visibility_results_prefer_gql_media_interstitial_enabled: true,
          rweb_video_timestamps_enabled: true,
          longform_notetweets_rich_text_read_enabled: true,
          longform_notetweets_inline_media_enabled: true,
          responsive_web_enhance_cards_enabled: false
        }
      }

      const url = new URL(base)
      url.searchParams.append('variables', JSON.stringify(queryParams.variables))
      url.searchParams.append('features', JSON.stringify(queryParams.features))

      console.log('Fetching', url.href)

      const api = new APIExtractor(base)

      const res = await api.get(url.pathname + url.search, {
        accept: '*/*',
        'accept-language': 'en-US,en;q=0.9',
        authorization: headers.authorization,
        'cache-control': 'no-cache',
        'content-type': 'application/json',
        pragma: 'no-cache',
        priority: 'u=1, i',
        'sec-ch-ua': '"Not-A.Brand";v="99", "Chromium";v="124"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'x-client-transaction-id': headers.clientTransactionId,
        'x-csrf-token': headers.csrfToken,
        'x-twitter-active-user': 'yes',
        'x-twitter-auth-type': 'OAuth2Session',
        'x-twitter-client-language': 'en'
      })

      if (!res.ok) {
        console.error('Failed to fetch bookmarks', res.status, res.statusText, res.url)
        if (res.status === 429) {
          console.log('Rate limited')

          if (retryCount >= MAX_RETRIES) {
            console.log('Max retries reached')
            return null
          }

          const defaultRetry = 60
          const retryAfter = res.headers.get('retry-after')
          const retry = retryAfter ? parseInt(retryAfter) : defaultRetry

          console.log('Retrying after', retry)
          retryCount++
          await new Promise((resolve) => setTimeout(resolve, retry * 1000))
          return this.getBookmarks(uid, headers, limit, cursor, retryCount)
        }

        return null
      }

      const json = await res.json()

      console.log('json', json)

      const entries = json?.data?.bookmark_timeline_v2?.timeline?.instructions[0]?.entries
      const posts = entries?.map((entry: any) => this.parseTweet(entry)).filter((post: any) => post)

      const newCursor =
        json?.data?.bookmark_timeline_v2?.timeline?.instructions[0]?.entries?.pop()?.content?.value

      return { posts, cursor: newCursor }
    } catch (e) {
      console.error('Error getting bookmarks', e)
      return null
    }
  }

  parseTweet(entry: any) {
    const data = entry?.content?.itemContent?.tweet_results?.result
    console.log('data', data)

    if (!data) {
      console.log('No data found')
      return null
    }

    const tweet = data?.legacy
    const author = data?.core?.user_results?.result?.legacy

    if (!tweet || !author) {
      console.log('No tweet or author found')
      return null
    }

    console.log('tweet', tweet)
    console.log('author', author)

    const cleanAuthorName = sanitizeHTML(author.screen_name)

    return {
      post_id: sanitizeHTML(tweet.id_str),
      url: `https://www.twitter.com/${cleanAuthorName}/status/${tweet.id_str}`,
      date_published: parseTextIntoISOString(tweet.created_at),
      date_edited: null,
      edited: null,
      site_name: 'Twitter',
      site_icon: 'https://abs.twimg.com/responsive-web/web/icon-default.1ea219d5.png',
      parent_title: `@${cleanAuthorName}`,
      parent_url: `https://www.twitter.com/${cleanAuthorName}`,
      author: cleanAuthorName,
      author_fullname: sanitizeHTML(author.name),
      author_image: parseStringIntoUrl(author.profile_image_url_https, this.url)?.href,
      author_url: `https://www.twitter.com/${cleanAuthorName}`,
      title: sanitizeHTML(tweet.full_text),
      excerpt: sanitizeHTML(tweet.full_text),
      content_plain: sanitizeHTML(tweet.full_text),
      content_html: sanitizeHTML(tweet.full_text),
      stats: {
        views: null,
        up_votes: tweet.favorite_count,
        down_votes: null,
        comments: tweet.reply_count
      },
      images: tweet.entities?.media?.map(
        (media: any) => parseStringIntoUrl(media.media_url_https, this.url)?.href
      )
    } as ResourceDataPost
  }
}

export default TwitterParser
