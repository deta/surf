import { ResourceTypes, type ResourceDataArticle } from '@deta/types'
import { Readability, isProbablyReaderable } from '@mozilla/readability'

import { MetadataExtractor, WebAppExtractor } from '../extractors'
import type { DetectedWebApp } from '../types'
import { generateNameFromURL, sanitizeHTML } from '../utils'
import { parseStringIntoUrl, parseTextIntoISOString } from '@deta/utils'
import { DOMExtractor } from '../extractors/dom'

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
      appName: generateNameFromURL(this.url.href),
      hostname: this.url.hostname,
      canonicalUrl: this.url.href,
      resourceType: this.detectResourceType(),
      appResourceIdentifier: this.url.pathname,
      resourceNeedsPicking: false
    }
  }

  async extractResourceFromDocument(document: Document) {
    // Note: sanitization is already done in the metadata extractor

    // Extract metadata from the document meta tags directly
    const pageMetadata = this.metadataExtractor.extractMetadataFromDocument(document)

    // Extract metdata and content from the document using Readability.js
    const readabilityMetadata = this.metadataExtractor.extractContentFromDocument(document)

    // Extract the content from the document directly (fallback)
    const content = await new DOMExtractor(document).getContent()

    const resource = {
      title: readabilityMetadata?.title || pageMetadata.title,
      url: this.url.href,
      date_published: readabilityMetadata?.publishedTime || pageMetadata.date_published,
      date_updated: pageMetadata.date_modified,

      site_name: readabilityMetadata?.siteName || pageMetadata.provider,
      site_icon: pageMetadata.icon,

      author: readabilityMetadata?.byline || pageMetadata.author,
      author_image: null,
      author_url: null,

      excerpt: readabilityMetadata?.excerpt || pageMetadata.description,
      content_plain: readabilityMetadata?.textContent || content.plain,
      content_html: readabilityMetadata?.content || content.html,
      word_count: readabilityMetadata?.length,
      lang: readabilityMetadata?.lang || pageMetadata.language,
      direction: readabilityMetadata?.dir,

      // TODO: extract images from the content
      images: pageMetadata.image ? [pageMetadata.image] : [],

      category_name: null,
      category_url: null,
      stats: {
        views: null,
        comments: null
      }
    } as ResourceDataArticle

    return {
      data: resource,
      type: ResourceTypes.ARTICLE
    }
  }
}

export default ArticleParser
