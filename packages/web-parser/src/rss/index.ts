import { ResourceDataPost } from '@deta/types'
import { parseStringIntoUrl, parseTextIntoISOString } from '@deta/utils'
import Parser from 'rss-parser'
import { sanitizeHTML } from '../utils'

export class RSSParser {
  url: URL

  constructor(url: string) {
    this.url = new URL(url)
  }

  private async fetchRemoteHTML() {
    const response = await fetch(this.url.href, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
        'Content-Type': 'application/rss+xml'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch the page')
    }

    return response.text()
  }

  private async fetchRemote() {
    let html: string
    if (
      typeof window !== 'undefined' &&
      // @ts-expect-error
      typeof window.api !== 'undefined' &&
      // @ts-expect-error
      typeof window.api.fetchHTMLFromRemoteURL === 'function'
    ) {
      console.log('Using window.api')
      // @ts-expect-error
      html = await window.api.fetchHTMLFromRemoteURL(this.url.href, {
        headers: {
          'Content-Type': 'application/rss+xml'
        }
      })
    } else {
      console.log('Using fetch API')
      html = await this.fetchRemoteHTML()
    }

    console.log('HTML', html)

    return html
  }

  async parse() {
    const html = await this.fetchRemote()
    const parser = new Parser({
      customFields: {
        item: [
          'yt:videoId',
          'yt:channelId',
          'author',
          'published',
          'updated',
          'media:group',
          'comments'
        ]
      }
    })

    return parser.parseString(html)
  }

  static parseYouTubeRSSItemToPost(item: RSSItem) {
    const cleanAuthor = sanitizeHTML(item.author)
    const rawImage = item['media:group']?.['media:thumbnail']?.[0]?.$?.views
    const cleanImage = rawImage ? parseStringIntoUrl(rawImage)?.href : undefined

    return {
      post_id: item['yt:videoId'],
      url: item.link ? parseStringIntoUrl(item.link)?.href : undefined,
      title: item.title ? sanitizeHTML(item.title) : undefined,
      site_name: 'YouTube',
      site_icon: 'https://www.youtube.com/s/desktop/4b6b9b6f/img/favicon_32.png',
      author: cleanAuthor,
      author_fullname: cleanAuthor,
      author_url: '',
      content_plain: item['media:group']?.['media:description']?.[0],
      parent_url: `https://youtube.com/channel/${item['yt:channelId']}`,
      parent_title: cleanAuthor,
      date_published: item.pubDate ? parseTextIntoISOString(item.pubDate) : undefined,
      images: cleanImage ? [cleanImage] : [],
      stats: {
        views: item['media:group']?.['media:community']?.[0]['media:statistics']?.[0]?.$?.views,
        up_votes: item['media:group']?.['media:community']?.[0]?.['media:starRating']?.[0]?.$?.count
      }
    } as ResourceDataPost
  }

  static async parse(url: string) {
    const parser = new RSSParser(url)
    return parser.parse()
  }
}

export type RSSItem = Awaited<ReturnType<typeof RSSParser.parse>>['items'][0]
