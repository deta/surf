import { ResourceTypes, ResourceDataLink } from '@horizon/types'

import { MetadataExtractor, WebAppExtractor } from '../extractors'
import type { DetectedWebApp } from '../types'
import { generateNameFromURL } from '../utils'

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
    const metadata = this.metadataExtractor.extractMetadataFromDocument(document)

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
