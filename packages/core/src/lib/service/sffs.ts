import { useLogScope, type ScopedLogger } from '../utils/log'
import type {
  SFFSResourceMetadata,
  SFFSResourceTag,
  SFFSResourceItem,
  SFFSRawCompositeResource
} from '../types'

export class SFFS {
  sffs: any
  log: ScopedLogger

  constructor() {
    this.log = useLogScope('SFFS')

    if (typeof window.backend === 'undefined') {
      throw new Error('SFFS backend not available')
    }

    this.log.debug('init', window.backend.init)

    this.sffs = window.backend.init()

    // TODO: remove this, just for debugging
    window.sffs = this.sffs

    if (!this.sffs) {
      throw new Error('SFFS backend failed to initialize')
    }
  }

  convertCompositeResourceToResource(composite: SFFSRawCompositeResource): SFFSResourceItem {
    return {
      id: composite.resource.id,
      type: composite.resource.resource_type,
      path: composite.resource.resource_path,
      createdAt: composite.resource.created_at,
      updatedAt: composite.resource.updated_at,
      deleted: composite.resource.deleted === 1,
      metadata: {
        name: composite.metadata?.name ?? '',
        sourceURI: composite.metadata?.source_uri ?? '',
        alt: composite.metadata?.alt ?? ''
      },
      tags: (composite.resourceTags || []).map((tag) => ({
        id: tag.id,
        name: tag.tag_name,
        value: tag.tag_value
      }))
    }
  }

  convertResourceToCompositeResource(resource: SFFSResourceItem): SFFSRawCompositeResource {
    return {
      resource: {
        id: resource.id,
        resource_path: resource.path,
        resource_type: resource.type,
        created_at: resource.createdAt,
        updated_at: resource.updatedAt,
        deleted: resource.deleted ? 1 : 0
      },
      metadata: {
        id: '', // TODO: what about metadata id? do we need to keep it around?
        resource_id: resource.id,
        name: resource.metadata?.name ?? '',
        source_uri: resource.metadata?.sourceURI ?? '',
        alt: resource.metadata?.alt ?? ''
      },
      resourceTags: (resource.tags || []).map((tag) => ({
        id: tag.id,
        resource_id: resource.id,
        tag_name: tag.name,
        tag_value: tag.value
      }))
    }
  }

  parseData<T>(raw: string): T | null {
    try {
      return JSON.parse(raw)
    } catch (e) {
      this.log.error('failed to parse data', e)
      return null
    }
  }

  async createResource(
    type: string,
    metadata?: SFFSResourceMetadata,
    tags?: SFFSResourceTag[]
  ): Promise<SFFSResourceItem> {
    this.log.debug('creating resource of type', type)

    // convert metadata and tags to expected format
    const metadataData = {
      id: '',
      resourceID: '',
      name: '',
      sourceURI: '',
      alt: '',
      ...(metadata ?? {})
    }

    const tagsData = (tags ?? []).map((tag) => ({
      id: '',
      resourceID: '',
      name: tag.name ?? '',
      value: tag.value ?? ''
    }))

    const dataString = await this.sffs.js__store_create_resource(type, metadataData, tagsData)
    const composite = this.parseData<SFFSRawCompositeResource>(dataString)
    if (!composite) {
      throw new Error('failed to create resource, invalid data', dataString)
    }

    return this.convertCompositeResourceToResource(composite)
  }

  async readResource(id: string): Promise<SFFSResourceItem | null> {
    this.log.debug('reading resource with id', id)
    const dataString = await this.sffs.js__store_read_resource(id)
    const composite = this.parseData<SFFSRawCompositeResource>(dataString)
    if (!composite) {
      return null
    }

    return this.convertCompositeResourceToResource(composite)
  }

  async deleteResource(id: string): Promise<void> {
    this.log.debug('deleting resource with id', id)
    await this.sffs.js__store_delete_resource(id)
  }

  async recoverResource(id: string): Promise<void> {
    this.log.debug('recovering resource with id', id)
    await this.sffs.js__store_recover_resource(id)
  }

  async readResources(): Promise<SFFSResourceItem[]> {
    this.log.debug('reading all resources')
    const items = await this.sffs.js__store_read_resources()
    return items.map(this.convertCompositeResourceToResource)
  }

  readDataFile(path: string): Promise<Blob> {
    this.log.debug('reading data file', path)
    // return this.sffs.js__store_read_data_file(path)

    // return fake blob as promise for now
    return new Promise((resolve) => {
      const blob = new Blob([`fake data for ${path}`], { type: 'text/plain' })
      resolve(blob)
    })
  }

  writeDataFile(path: string, data: Blob): Promise<any> {
    this.log.debug('writing data file', path, data)
    // return this.sffs.js__store_write_data_file(path, data)
    return Promise.resolve()
  }
}
