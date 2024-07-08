import { ResourceDataPost } from '@horizon/types'
import Parser from 'rss-parser'

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
      // @ts-ignore
      typeof window.api !== 'undefined' &&
      // @ts-ignore
      typeof window.api.fetchHTMLFromRemoteURL === 'function'
    ) {
      console.log('Using window.api')
      // @ts-ignore
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

  static parseYouTubeRSSItemToPost(item: any) {
    return {
      post_id: item['yt:videoId'],
      url: item.link,
      title: item.title,
      site_name: 'YouTube',
      site_icon: 'https://www.youtube.com/s/desktop/4b6b9b6f/img/favicon_32.png',
      author: item.author,
      author_fullname: item.author,
      author_url: '',
      content_plain: item['media:group']?.['media:description']?.[0],
      parent_url: `https://youtube.com/channel/${item['yt:channelId']}`,
      parent_title: item.author,
      date_published: item.pubDate,
      images: [item['media:group']?.['media:thumbnail']?.[0]?.$?.views],
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
