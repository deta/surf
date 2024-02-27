import { get, writable, type Writable } from 'svelte/store'

import { useLogScope, type ScopedLogger } from '../utils/log'
import { SFFS } from './sffs'
import type { SFFSResourceMetadata, SFFSResourceTag, SFFSResourceItem } from '../types'

/*
 TODO:
 - move over other card data to SFFSResource 
 - handle errors
*/

export class Resource {
  id: string
  path: string
  createdAt: string
  updatedAt: string
  deleted: boolean

  metadata?: SFFSResourceMetadata
  tags?: SFFSResourceTag[]

  rawData: Blob | null
  rawDataPromise: Promise<Blob> | null // used to avoid duplicate reads
  dataUsed: number // number of times the data is being used

  sffs: SFFS
  log: ScopedLogger

  constructor(sffs: SFFS, data: SFFSResourceItem) {
    this.log = useLogScope(`SFFSResource ${data.id}`)
    this.sffs = sffs

    this.id = data.id
    this.path = data.path
    this.createdAt = data.createdAt
    this.updatedAt = data.updatedAt
    this.deleted = data.deleted
    this.metadata = data.metadata
    this.tags = data.tags

    this.rawData = null
    this.rawDataPromise = null
    this.dataUsed = 0
  }

  private async readData() {
    this.log.debug('reading resource data from', this.path)

    if (this.rawDataPromise !== null) {
      this.log.debug('already reading data, piggybacking on existing promise')
      return this.rawDataPromise
    }

    // store promise to avoid duplicate reads
    this.rawDataPromise = this.sffs.readDataFile(this.path)
    this.rawData = await this.rawDataPromise

    // reset state
    this.rawDataPromise = null

    return this.rawData
  }

  async writeData() {
    this.log.debug('writing resource data to', this.path)

    if (!this.rawData) {
      this.log.warn('no data to write')
      return
    }

    await this.sffs.writeDataFile(this.path, this.rawData)
  }

  updateData(data: Blob, write = true) {
    this.log.debug('updating resource data with', data)

    this.rawData = data
    this.updatedAt = new Date().toISOString()

    if (write) {
      this.writeData()
    }
  }

  updateMetadata(updates: Partial<SFFSResourceMetadata>) {
    this.log.debug('updating resource metadata with', updates)

    this.metadata = { ...(this.metadata ?? {}), ...updates } as SFFSResourceMetadata
    this.updatedAt = new Date().toISOString()
  }

  updateTags(updates: SFFSResourceTag[]) {
    this.log.debug('updating resource tags with', updates)

    this.tags = [...(this.tags ?? []), ...updates]
    this.updatedAt = new Date().toISOString()
  }

  getData() {
    this.dataUsed += 1

    if (this.rawData) {
      return Promise.resolve(this.rawData)
    }

    return this.readData()
  }

  releaseData() {
    this.dataUsed -= 1

    if (this.dataUsed <= 0) {
      this.dataUsed = 0
      this.rawData = null
    }
  }
}

export class ResourceManager {
  resources: Writable<Resource[]>

  log: ScopedLogger
  sffs: SFFS

  constructor() {
    this.log = useLogScope('SFFSResourceManager')
    this.resources = writable([])
    this.sffs = new SFFS()
  }

  async createResource(
    type: string,
    data: Blob,
    metadata?: SFFSResourceMetadata,
    tags?: SFFSResourceTag[]
  ) {
    this.log.debug('creating resource', type, data, metadata, tags)

    const sffsItem = await this.sffs.createResource(type, metadata, tags)

    const resource = new Resource(this.sffs, sffsItem)
    this.resources.update((resources) => [...resources, resource])

    // store the data in the resource and write it to sffs
    resource.rawData = data
    resource.writeData()

    return resource
  }

  async readResources() {
    const resourceItems = await this.sffs.readResources()
    const resources = resourceItems.map((item) => new Resource(this.sffs, item))
    this.resources.set(resources)
  }

  async getResource(id: string) {
    // read resource from sffs
    const resourceItem = await this.sffs.readResource(id)
    if (!resourceItem) {
      return null
    }

    const resource = new Resource(this.sffs, resourceItem)

    this.resources.update((resources) => {
      const index = resources.findIndex((r) => r.id === id)
      if (index > -1) {
        resources[index] = resource
      } else {
        resources.push(resource)
      }

      return resources
    })

    return resource
  }

  async deleteResource(id: string) {
    // delete resource from sffs
    await this.sffs.deleteResource(id)
    this.resources.update((resources) => resources.filter((r) => r.id !== id))
  }
}
