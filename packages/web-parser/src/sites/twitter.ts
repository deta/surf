import { ResourceTypes, type ResourceDataPost } from '@horizon/types'

import { APIExtractor, WebAppExtractor } from '../extractors'
import type { DetectedWebApp, WebService, WebServiceActionInputs } from '../types'
import { SERVICES } from '../services'

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
      author_image: authorImage,
      author_url: `https://www.twitter.com/${data.username}`,

      excerpt: data.content,
      content_plain: data.content,
      content_html: data.contentHtml,
      lang: null,

      links: [],
      images: images,
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

  getActions() {
    return SERVICES.find((service) => service.id === 'twitter')?.actions ?? []
  }

  async runAction(document: Document, id: string, inputs: WebServiceActionInputs) {
    const action = this.getActions().find((action) => action.id === id)
    if (!action) return null

    console.log('Running action', action.id)

    if (action.id === 'get_bookmarks_from_twitter') {
      const userId = 'yzqS_xq0glDD7YZJ2YDaiA'
      const data = await this.getBookmarks(userId)
      if (!data) return null

      console.log('data', data)

      return {
        data: data,
        type: action.output?.type ?? ResourceTypes.POST_TWITTER
      }
    } else {
      console.log('Unknown action')
      return null
    }
  }

  async getBookmarks(userId: string, cursor?: string) {
    const base = `https://twitter.com/i/api/graphql/${userId}/Bookmarks`
    const queryParams = {
      variables: {
        count: 100,
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

    const json = await api.getJSON(url.pathname + url.search, {
      accept: '*/*',
      'accept-language': 'en-US,en;q=0.9',
      authorization:
        'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
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
      'x-client-transaction-id':
        'Bp0Pl1HYeNHEEgLpm352hdpQnpOhMo1grBScLzYcj0N+tqXq8vQE0GZ/6JM61QE9hvtI8wc/i3NYlSSRvb0gC1PrHSUvBQ',
      'x-csrf-token':
        'c5062ed10debd4bebefcb9b62c94413a8dd68005c90f46662adaa6d8c75d7fd8ad245da1f68e6bd6c4a71d5ac5e890837d9ac8d6f013494120771e3c4d4ac0b52060fba213d693ed76c9d82ee5ed62dc',
      'x-twitter-active-user': 'yes',
      'x-twitter-auth-type': 'OAuth2Session',
      'x-twitter-client-language': 'en'
    })

    console.log('json', json)

    const entries = json?.data?.bookmark_timeline_v2?.timeline?.instructions[0]?.entries
    const posts = entries?.map((entry: any) => this.parseTweet(entry)).filter((post: any) => post)

    return posts
  }

  parseTweet(entry: any) {
    const data = entry?.content?.itemContent?.tweet_results?.result
    console.log('data', data)

    const tweet = data?.legacy
    const author = data?.core?.user_results?.result?.legacy

    if (!tweet || !author) {
      console.log('No tweet or author found')
      return null
    }

    console.log('tweet', tweet)
    console.log('author', author)

    return {
      post_id: tweet.id_str,
      url: `https://www.twitter.com/${author.screen_name}/status/${tweet.id_str}`,
      date_published: new Date(tweet.created_at).toISOString(),
      date_edited: null,
      edited: null,
      site_name: 'Twitter',
      site_icon: 'https://abs.twimg.com/responsive-web/web/icon-default.1ea219d5.png',
      parent_title: `@${author.screen_name}`,
      parent_url: `https://www.twitter.com/${author.screen_name}`,
      author: author.screen_name,
      author_fullname: author.name,
      author_image: author.profile_image_url_https,
      author_url: `https://www.twitter.com/${author.screen_name}`,
      title: tweet.full_text,
      excerpt: tweet.full_text,
      content_plain: tweet.full_text,
      content_html: tweet.full_text,
      stats: {
        views: null,
        up_votes: tweet.favorite_count,
        down_votes: null,
        comments: tweet.reply_count
      },
      images: tweet.entities?.media?.map((media: any) => media.media_url_https)
    } as ResourceDataPost
  }
}

export default TwitterParser
