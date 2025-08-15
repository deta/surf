import { ResourceTypes, type ResourceDataLink } from '@deta/types'

import { MetadataExtractor, WebAppExtractor } from '../extractors'
import type { DetectedWebApp } from '../types'
import { generateNameFromURL } from '../utils'
import { DOMExtractor } from '../extractors/dom'

export class LinkParser extends WebAppExtractor {
  metadataExtractor: MetadataExtractor

  constructor(url: URL) {
    super(null, url)

    this.metadataExtractor = new MetadataExtractor(url)
  }

  detectResourceType() {
    console.log('Detecting resource type', this.url.pathname)

    return ResourceTypes.LINK
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
    // Note: sanitization is already done in the metadata extractor and the DOM extractor
    const metadata = this.metadataExtractor.extractMetadataFromDocument(document)
    const content = await new DOMExtractor(document).getContent()

    const resource = {
      title: metadata.title,
      description: metadata.description,
      icon: metadata.icon,
      image: metadata.image,
      keywords: metadata.keywords,
      language: metadata.language,
      url: this.url.href,
      provider: metadata.provider,
      author: metadata.author,
      type: metadata.type,
      content_plain: content.plain,
      content_html: content.html,
      date_published: metadata.date_published,
      date_modified: metadata.date_modified
    } as ResourceDataLink

    return {
      data: resource,
      type: ResourceTypes.LINK
    }
  }
}

export default LinkParser
