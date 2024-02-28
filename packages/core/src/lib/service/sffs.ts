import { useLogScope, type ScopedLogger } from '../utils/log'
import type {
  SFFSResourceMetadata,
  SFFSResourceTag,
  SFFSResource,
  SFFSRawCompositeResource,
  SFFSRawResourceTag
} from '../types'

export class SFFS {
  backend: any
  log: ScopedLogger

  constructor(basePath = '/sffs/') {
    this.log = useLogScope('SFFS')

    // @ts-ignore
    if (typeof window.backend === 'undefined') {
      throw new Error('SFFS backend not available')
    }

    // @ts-ignore
    this.backend = window.backend.init(basePath)

    // @ts-ignore
    window.sffs = this // TODO: remove this, just for debugging

    if (!this.backend) {
      throw new Error('SFFS backend failed to initialize')
    }
  }

  convertCompositeResourceToResource(composite: SFFSRawCompositeResource): SFFSResource {
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
      tags: (composite.resource_tags || []).map((tag) => ({
        id: tag.id,
        name: tag.tag_name,
        value: tag.tag_value
      }))
    }
  }

  convertResourceToCompositeResource(resource: SFFSResource): SFFSRawCompositeResource {
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
      resource_tags: (resource.tags || []).map((tag) => ({
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
  ): Promise<SFFSResource> {
    this.log.debug('creating resource of type', type)

    // convert metadata and tags to expected format
    const metadataData = JSON.stringify({
      id: '',
      resource_id: '',
      name: '',
      source_uri: '',
      alt: '',
      ...(metadata ?? {})
    } as SFFSResourceMetadata)

    const tagsData = JSON.stringify(
      (tags ?? []).map(
        (tag) =>
          ({
            id: '',
            resource_id: '',
            tag_name: tag.name ?? '',
            tag_value: tag.value ?? ''
          }) as SFFSRawResourceTag
      )
    )

    const dataString = await this.backend.js__store_create_resource(type, tagsData, metadataData)
    const composite = this.parseData<SFFSRawCompositeResource>(dataString)
    if (!composite) {
      throw new Error('failed to create resource, invalid data', dataString)
    }

    return this.convertCompositeResourceToResource(composite)
  }

  async readResource(id: string): Promise<SFFSResource | null> {
    this.log.debug('reading resource with id', id)
    const dataString = await this.backend.js__store_read_resource(id)
    const composite = this.parseData<SFFSRawCompositeResource>(dataString)
    if (!composite) {
      return null
    }

    return this.convertCompositeResourceToResource(composite)
  }

  async deleteResource(id: string): Promise<void> {
    this.log.debug('deleting resource with id', id)
    await this.backend.js__store_delete_resource(id)
  }

  async recoverResource(id: string): Promise<void> {
    this.log.debug('recovering resource with id', id)
    await this.backend.js__store_recover_resource(id)
  }

  async readResources(): Promise<SFFSResource[]> {
    this.log.debug('reading all resources')
    const items = await this.backend.js__store_read_resources()
    return items.map(this.convertCompositeResourceToResource)
  }

  async searchResources(query: string, tags?: SFFSResourceTag[]): Promise<SFFSResource[]> {
    this.log.debug('searching resources with query', query, 'and tags', tags)
    const tagsData = JSON.stringify(
      (tags ?? []).map(
        (tag) =>
          ({
            id: '',
            resource_id: '',
            tag_name: tag.name ?? '',
            tag_value: tag.value ?? ''
          }) as SFFSRawResourceTag
      )
    )
    const items = await this.backend.js__store_search_resources(query, tagsData)
    return items.map(this.convertCompositeResourceToResource)
  }

  readDataFile(path: string): Promise<Blob> {
    this.log.debug('reading data file', path)
    // return this.sffs.js__store_read_data_file(path)

    // return a simple mock image as a blob
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      canvas.width = 128
      canvas.height = 128
      const ctx = canvas.getContext('2d')
      if (ctx) {
        // random color
        ctx.fillStyle = `#${Math.floor(Math.random() * 16777215).toString(16)}`
        ctx.fillRect(0, 0, 128, 128)

        // add some text
        ctx.fillStyle = '#000'
        ctx.font = '15px sans-serif'
        ctx.fillText('dummy', 40, 70)
      }
      canvas.toBlob((blob) => {
        resolve(blob as Blob)
      })
    })
  }

  writeDataFile(path: string, data: Blob): Promise<any> {
    this.log.debug('writing data file', path, data)
    // return this.sffs.js__store_write_data_file(path, data)
    return Promise.resolve()
  }
}
