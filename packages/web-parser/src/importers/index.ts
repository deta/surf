import { type ResourceDataLink, ResourceTypes } from '@deta/types'
import { type DetectedResource, WebParser } from '..'
import { WebCrateImporter } from './apps/webcrate'
import { AppImporter } from './apps'

export type QueueItem = {
  data: ResourceDataLink
  running: boolean
}

export class LinkImporter {
  batchSize: number
  limit?: number

  constructor(batchSize: number = 5, limit?: number) {
    this.batchSize = batchSize
    this.limit = limit
  }

  async processLink(link: ResourceDataLink) {
    const webParser = new WebParser(link.url)

    const extractedResource = await webParser.extractResourceUsingWebview(document)
    if (!extractedResource) {
      console.log('No resource detected for', link.url)

      return {
        type: ResourceTypes.LINK,
        data: link
      } as DetectedResource
    }

    return extractedResource
  }

  async processLinks(links: ResourceDataLink[]) {
    const detectedResources = await Promise.all(links.map((link) => this.processLink(link)))

    return detectedResources
  }
}

export * from './apps/webcrate'
export * from './apps/twitter'
export * from './apps/youtube'
