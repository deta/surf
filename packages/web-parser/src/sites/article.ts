import { ResourceTypes, ResourceDataArticle } from '@horizon/types'
import { Readability, isProbablyReaderable } from '@mozilla/readability'

import { MetadataExtractor, WebAppExtractor } from '../extractors'
import type { DetectedWebApp } from '../types'
import { parseDateString } from '../utils'

export type RawArticleData = {
  title: string
  content: string
  textContent: string
  length: number
  excerpt: string
  byline: string
  dir: string
  siteName: string
  lang: string
  publishedTime: string
}

export class ArticleParser extends WebAppExtractor {
  metadataExtractor: MetadataExtractor

  constructor(url: URL) {
    super(null, url)

    this.metadataExtractor = new MetadataExtractor(url)
  }

  detectResourceType() {
    console.log('Detecting resource type', this.url.pathname)

    return ResourceTypes.ARTICLE
  }

  isArticle(document: Document) {
    console.log('Detecting resource type', this.url.pathname)

    return isProbablyReaderable(document)
  }

  getInfo(): DetectedWebApp {
    return {
      appId: null,
      appName: null,
      hostname: this.url.hostname,
      resourceType: this.detectResourceType(),
      resourceNeedsPicking: false
    }
  }

  async extractResourceFromDocument(document: Document) {
    const parsed = new Readability(document).parse()
    if (!parsed) return null

    const metadata = this.metadataExtractor.extractMetadataFromDocument(document)

    const publishedTime = parseDateString(parsed.publishedTime)

    const resource = {
      title: parsed.title || metadata.title,
      url: this.url.href,
      date_published: publishedTime ?? metadata.date_published,
      date_updated: metadata.date_modified,

      site_name: parsed.siteName || metadata.provider,
      site_icon: metadata.icon,

      author: parsed.byline || metadata.author,
      author_image: null,
      author_url: null,

      excerpt: parsed.excerpt || metadata.description,
      content_plain: parsed.textContent,
      content_html: parsed.content,
      word_count: parsed.length,
      lang: parsed.lang || metadata.language,
      direction: parsed.dir,

      // TODO: extract images from the content
      images: [metadata.image],

      category_name: null, // name of the category
      category_url: null, // url pointing to the category
      stats: null
    } as ResourceDataArticle

    return {
      data: resource,
      type: ResourceTypes.ARTICLE
    }
  }
}

export default ArticleParser
