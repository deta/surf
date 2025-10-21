import { app } from 'electron'
import { initBackend } from '../preload/helpers/backend'
import { isDev } from '@deta/utils/system'
import type {
  SFFSRawCompositeResource,
  SFFSRawResource,
  SFFSRawResourceTag,
  SFFSResource,
  SFFSResourceTag
} from '@deta/types'
import { optimisticParseJSON } from '@deta/utils'

export class SFFSMain {
  sffs: any
  resources: any

  constructor(sffs: any, resources: any) {
    this.sffs = sffs
    this.resources = resources
  }

  static convertCompositeResourceToResource(composite: SFFSRawCompositeResource): SFFSResource {
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
        alt: composite.metadata?.alt ?? '',
        userContext: composite.metadata?.user_context ?? ''
      },
      tags: (composite.resource_tags || []).map((tag) =>
        SFFSMain.convertRawResourceTagToResourceTag(tag)
      ),
      annotations: (composite.resource_annotations || []).map((annotation) => {
        return {
          id: annotation.id,
          type: annotation.resource_type,
          path: annotation.resource_path,
          // tags are missing as we are not getting back a composite resource for annotations
          createdAt: annotation.created_at,
          updatedAt: annotation.updated_at,
          deleted: annotation.deleted === 1
        }
      }),
      postProcessingState: composite.post_processing_job?.state,
      spaceIds: composite.space_ids ?? []
    }
  }

  static convertResourceToCompositeResource(resource: SFFSResource): SFFSRawCompositeResource {
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
        alt: resource.metadata?.alt ?? '',
        user_context: resource.metadata?.userContext ?? ''
      },
      resource_tags: (resource.tags || []).map((tag) => ({
        id: tag.id ?? '',
        resource_id: resource.id,
        tag_name: tag.name,
        tag_value: tag.value
      }))
    }
  }

  static convertRawResourceTagToResourceTag(raw: SFFSRawResourceTag): SFFSResourceTag {
    return {
      id: raw.id,
      name: raw.tag_name,
      value: raw.tag_value
    }
  }

  async readResource(
    id: string,
    opts?: { includeAnnotations?: boolean }
  ): Promise<SFFSResource | null> {
    console.log('reading resource with id', id)
    const dataString = await this.sffs.js__store_get_resource(id, opts?.includeAnnotations ?? false)

    const composite = optimisticParseJSON<SFFSRawCompositeResource>(dataString)
    if (!composite) {
      return null
    }

    return SFFSMain.convertCompositeResourceToResource(composite)
  }

  async updateResource(resource: SFFSRawResource) {
    console.debug('updating resource with id', resource.id, 'data:', resource)

    const stringified = JSON.stringify(resource)

    const result = this.sffs.js__store_update_resource(stringified)
    return result
  }
}

let sffsMain: SFFSMain | null = null

export const useSFFSMain = () => {
  if (!sffsMain) {
    console.error('SFFSMain not initialized')
    return undefined
  }

  return sffsMain
}

export const initializeSFFSMain = () => {
  console.log('Initializing SFFSMain...')
  const result = initBackend({
    num_worker_threads: 2,
    num_processor_threads: 1,
    userDataPath: app.getPath('userData'),
    appPath: `${app.getAppPath()}${isDev ? '' : '.unpacked'}`
  })

  ;(result.sffs as any).js__backend_set_surf_backend_health(true)

  sffsMain = new SFFSMain(result.sffs, result.resources)
  return sffsMain
}
