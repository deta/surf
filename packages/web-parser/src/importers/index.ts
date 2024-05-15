import { ResourceDataLink, ResourceTypes } from '@horizon/types'
import { DetectedResource, WebParser } from '..'
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

  async importLinksFromApp(appImporter: AppImporter) {
    const batchFetcher = appImporter.getBatchFetcher(this.batchSize)

    let queue: ResourceDataLink[] = []
    const processing = new Set<ResourceDataLink>()
    const processed: DetectedResource[] = []
    const failed: ResourceDataLink[] = []

    const processBatchSize = 5

    let fetchDone = false

    const fillQueue = async () => {
      const batch = await batchFetcher.fetchNextBatch()
      console.log('Filling queque', batch.length)

      queue.push(...batch)

      console.log('Queue size', queue.length)
    }

    const processItem = async (item: ResourceDataLink) => {
      try {
        console.log('Processing link', item.url)
        processing.add(item)
        queue = queue.filter((queueItem) => queueItem !== item)

        const detectedResource = await this.processLink(item)
        processed.push(detectedResource)
        processing.delete(item)
      } catch (error) {
        console.error('Error processing link', item, error)
        failed.push(item)
        processing.delete(item)
      }
    }

    const processIteration = async () => {
      if (queue.length === 0) {
        await fillQueue()
      }

      const nextToProcess = queue[0]
      if (!nextToProcess) {
        console.log('No more items to process')
        return
      }

      await processItem(nextToProcess)

      if (this.limit && processed.length >= this.limit) {
        fetchDone = true
        return
      }

      if (!fetchDone || processing.size < processBatchSize) {
        await processIteration()
      }
    }

    // const run = async () => {
    //     await processIteration()

    //     if (!fetchDone && (this.limit && processed.length < this.limit)) {
    //         await run()
    //     }
    // }

    // await run()

    await processIteration()

    // const fetchNextBatch = async () => {
    //     const links = await batchFetcher.fetchNextBatch()

    //     if (links.length === 0) {
    //         fetchDone = true
    //         return
    //     }

    //     queue.push(...links.map(link => ({
    //         data: link,
    //         running: false
    //     } as QueueItem)))

    //     console.log('Fetched batch', links.length)
    //     return links
    // }

    // const processBatch = async (batch: ResourceDataLink[]) => {
    //     const detectedResources = await this.processLinks(batch)
    //     processed.push(...detectedResources)
    // }

    // const processNextQueueItem = async () => {
    //     const item = queue.find(item => item.status === 'pending')
    //     if (!item) {
    //         return
    //     }

    //     console.log('Processing queue item', item.link.url)

    //     try {
    //         item.status = 'processing'

    //         const detectedResource = await this.processLink(item.link)

    //         item.detectedResource = detectedResource
    //         item.status = 'done'
    //     } catch (error) {
    //         item.status = 'error'
    //         console.error('Error processing link', item.link, error)
    //     }
    // }

    // const processQueue = async () => {
    //     console.log('Processing queue', queue.length)
    //     while (queue.length > 0) {
    //         await processNextQueueItem()
    //     }
    // }

    // const run = async () => {
    //     console.log('Fetching next batch', queue.length)
    //     const batch = await fetchNextBatch()

    //     await processQueue()

    //     if (!fetchDone && (this.limit && queue.length < this.limit)) {
    //         await run()
    //     }
    // }

    // await run()

    // console.log('Queue done', queue.length)

    return [processed, failed]
  }

  importWebCrateLinks(domain: string, apiKey: string) {
    const importer = new WebCrateImporter(domain, apiKey)

    return this.importLinksFromApp(importer)
  }
}

export * from './apps/webcrate'
