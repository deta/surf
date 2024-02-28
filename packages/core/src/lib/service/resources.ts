import { get, writable, type Writable } from 'svelte/store'

import { useLogScope, type ScopedLogger } from '../utils/log'
import { SFFS } from './sffs'
import {
  type SFFSResourceMetadata,
  type SFFSResourceTag,
  ResourceTypes,
  type SFFSResourceDataBookmark,
  type ResourceType,
  type SFFSResourceDataNote,
  type SFFSResource
} from '../types'
import type { JSONContent } from '@horizon/editor'

/*
 TODO:
 - move over other card data to SFFSResource 
 - handle errors
*/

export class ResourceTag {
  static download() {
    return { name: 'savedWithAction', value: 'download' }
  }

  static dragBrowser() {
    return { name: 'savedWithAction', value: 'drag/browser' }
  }

  static dragLocal() {
    return { name: 'savedWithAction', value: 'drag/local' }
  }

  static paste() {
    return { name: 'savedWithAction', value: 'paste' }
  }
}

export class Resource {
  id: string
  type: ResourceType
  path: string
  createdAt: string
  updatedAt: string
  deleted: boolean

  metadata?: SFFSResourceMetadata
  tags?: SFFSResourceTag[]

  rawData: Blob | null
  readDataPromise: Promise<Blob> | null // used to avoid duplicate reads
  dataUsed: number // number of times the data is being used

  sffs: SFFS
  log: ScopedLogger

  constructor(sffs: SFFS, data: SFFSResource) {
    this.log = useLogScope(`SFFSResource ${data.id}`)
    this.sffs = sffs

    this.id = data.id
    this.type = data.type
    this.path = data.path
    this.createdAt = data.createdAt
    this.updatedAt = data.updatedAt
    this.deleted = data.deleted
    this.metadata = data.metadata
    this.tags = data.tags

    this.rawData = null
    this.readDataPromise = null
    this.dataUsed = 0
  }

  private async readDataAsBlob() {
    const buffer = await this.sffs.readDataFile(this.path, this.id)

    return new Blob([buffer], { type: this.type })
  }

  private async readData() {
    this.log.debug('reading resource data from', this.path)

    if (this.readDataPromise !== null) {
      this.log.debug('already reading data, piggybacking on existing promise')
      return this.readDataPromise
    }

    // store promise to avoid duplicate reads
    this.readDataPromise = this.readDataAsBlob()
    this.readDataPromise.then((data) => {
      this.rawData = data
      this.readDataPromise = null
    })

    return this.readDataPromise
  }

  async writeData() {
    this.log.debug('writing resource data to', this.path)

    if (!this.rawData) {
      this.log.warn('no data to write')
      return
    }

    await this.sffs.writeDataFile(this.path, this.id, this.rawData)
  }

  updateData(data: Blob, write = true) {
    this.log.debug('updating resource data with', data)

    this.rawData = data
    this.updatedAt = new Date().toISOString()

    if (write) {
      return this.writeData()
    } else {
      return Promise.resolve()
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

export class ResourceNote extends Resource {
  // data: Writable<SFFSResourceDataNote | null>

  constructor(sffs: SFFS, data: SFFSResource) {
    super(sffs, data)
    // this.data = writable(null)
  }

  async getContent() {
    const data = await this.getData()
    return data.text()
  }

  async updateContent(content: string) {
    const blob = new Blob([content], { type: ResourceTypes.NOTE })
    return this.updateData(blob, true)
  }

  static async create(sffs: SFFS, data: SFFSResource) {
    return new ResourceNote(sffs, data)
  }
}

export class ResourceBookmark extends Resource {
  // data: Writable<SFFSResourceDataBookmark | null>

  constructor(sffs: SFFS, data: SFFSResource) {
    super(sffs, data)
    // this.data = writable(null)
  }

  async getBookmark() {
    const data = await this.getData()
    const text = await data.text()
    return JSON.parse(text) as SFFSResourceDataBookmark
  }

  async updateBookmark(content: SFFSResourceDataBookmark) {
    const blobData = JSON.stringify(content)
    const blob = new Blob([blobData], { type: ResourceTypes.LINK })
    return this.updateData(blob, true)
  }

  static async create(sffs: SFFS, data: SFFSResource) {
    return new ResourceBookmark(sffs, data)
  }
}

export class ResourceManager {
  resources: Writable<(Resource | ResourceBookmark | ResourceNote)[]>

  log: ScopedLogger
  sffs: SFFS

  constructor() {
    this.log = useLogScope('SFFSResourceManager')
    this.resources = writable([])
    this.sffs = new SFFS()
  }

  private createResourceObject(data: SFFSResource): Resource | ResourceBookmark | ResourceNote {
    if (data.type === ResourceTypes.NOTE) {
      return new ResourceNote(this.sffs, data)
    } else if (data.type === ResourceTypes.LINK) {
      return new ResourceBookmark(this.sffs, data)
    } else {
      return new Resource(this.sffs, data)
    }
  }

  async createResource(
    type: string,
    data: Blob,
    metadata?: Partial<SFFSResourceMetadata>,
    tags?: SFFSResourceTag[]
  ) {
    this.log.debug('creating resource', type, data, metadata, tags)
    const parsedMetadata = Object.assign(
      {
        name: '',
        alt: '',
        sourceURI: ''
      },
      metadata
    )

    const sffsItem = await this.sffs.createResource(type, parsedMetadata, tags)

    const resource = this.createResourceObject(sffsItem)

    // store the data in the resource and write it to sffs
    resource.rawData = data
    await resource.writeData()

    this.log.debug('created resource', resource)

    this.resources.update((resources) => [...resources, resource])

    return resource
  }

  async readResources() {
    const resourceItems = await this.sffs.readResources()
    const resources = resourceItems.map((item) => new Resource(this.sffs, item))
    this.resources.set(resources)
  }

  async searchResources(query: string, tags?: SFFSResourceTag[]) {
    const resourceItems = await this.sffs.searchResources(query, tags)
    const resources = resourceItems.map((item) => this.createResourceObject(item))

    // we probably don't want to overwrite the existing resources
    // this.resources.set(resources)

    return resources
  }

  async getResource(id: string) {
    // check if resource is already loaded
    const loadedResources = get(this.resources)
    const loadedResource = loadedResources.find((r) => r.id === id)
    if (loadedResource) {
      return loadedResource
    }

    // read resource from sffs
    const resourceItem = await this.sffs.readResource(id)
    if (!resourceItem) {
      return null
    }

    const resource = this.createResourceObject(resourceItem)

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

  async updateResourceData(id: string, data: Blob, write = true) {
    const resource = await this.getResource(id)
    if (!resource) {
      throw new Error('resource not found')
    }

    return resource.updateData(data, write)
  }

  async createResourceNote(
    content: string,
    metadata?: Partial<SFFSResourceMetadata>,
    tags?: SFFSResourceTag[]
  ) {
    const blob = new Blob([content], { type: ResourceTypes.NOTE })
    return this.createResource(ResourceTypes.NOTE, blob, metadata, tags)
  }

  async createResourceBookmark(
    data: Partial<SFFSResourceDataBookmark>,
    metadata?: Partial<SFFSResourceMetadata>,
    tags?: SFFSResourceTag[]
  ) {
    const blobData = JSON.stringify(data)
    const blob = new Blob([blobData], { type: ResourceTypes.LINK })
    return this.createResource(ResourceTypes.LINK, blob, metadata, tags)
  }

  async createResourceOther(
    blob: Blob,
    metadata?: Partial<SFFSResourceMetadata>,
    tags?: SFFSResourceTag[]
  ) {
    return this.createResource(blob.type, blob, metadata, tags)
  }
}
