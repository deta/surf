import { ResourceTypes, ResourceDataLink } from '@horizon/types'

import { MetadataExtractor, WebAppExtractor } from '../extractors'
import type { DetectedWebApp } from '../types'

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
      appName: null,
      hostname: this.url.hostname,
      resourceType: this.detectResourceType(),
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
