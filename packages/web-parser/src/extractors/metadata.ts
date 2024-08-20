import { WebMetadata } from '../types'
import { makeAbsoluteURL, parseTextIntoISOString } from '@horizon/utils'

export class MetadataExtractor {
  url: URL

  constructor(url: URL) {
    this.url = url
  }

  private async fetchRemoteHTML() {
    const response = await fetch(this.url.href, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
        'Content-Type': 'text/html'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch the page')
    }

    return response.text()
  }

  private createDocumentFromHTML = (html: string) => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    return doc
  }

  private extractMetaTagsFromDocument(document: Document) {
    const metaTags = document.querySelectorAll('meta')

    const metadata = Array.from(metaTags)
      .map((tag) => {
        const name = tag.getAttribute('name')
        const property = tag.getAttribute('property')
        const content = tag.getAttribute('content')

        return {
          name,
          property,
          content
        }
      })
      .filter((tag) => tag.name || tag.property)

    return metadata
  }

  extractMetadataFromDocument(document: Document) {
    const metadata = this.extractMetaTagsFromDocument(document)

    const getMeta = (name: string, property: string) => {
      const tag = metadata.find((tag) => tag.name === name || tag.property === property)
      return tag?.content
    }

    const favicon = document.querySelector('link[rel="icon"]')?.getAttribute('href')
    const language = document.querySelector('html')?.getAttribute('lang')

    const tags = document.querySelectorAll('meta[property="article:tag"]')
    const keywords = Array.from(tags)
      .map((tag) => tag.getAttribute('content'))
      .filter((tag) => tag !== null) as string[]

    const image = getMeta('image', 'og:image')

    const datePublished = getMeta('date', 'article:published_time')
    const dateModified = getMeta('date', 'article:modified_time')

    const parsed = {
      title: getMeta('title', 'og:title'),
      description: getMeta('description', 'og:description'),
      image: image ? makeAbsoluteURL(image, this.url) : null,
      icon: favicon ? makeAbsoluteURL(favicon, this.url) : null,
      language: language ?? null,
      author: getMeta('author', 'article:author'),
      date_published: datePublished ? parseTextIntoISOString(datePublished) : null,
      date_modified: dateModified ? parseTextIntoISOString(dateModified) : null,
      provider: getMeta('provider', 'og:site_name') ?? this.url.hostname,
      type: getMeta('type', 'og:type'),
      keywords: keywords
    } as WebMetadata

    return parsed
  }

  async extractRemote() {
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
      html = await window.api.fetchHTMLFromRemoteURL(this.url.href)
    } else {
      console.log('Using fetch API')
      html = await this.fetchRemoteHTML()
    }

    const document = this.createDocumentFromHTML(html)
    const parsed = this.extractMetadataFromDocument(document)

    return parsed
  }
}
