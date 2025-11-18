import { createResourcesFromFiles } from '@deta/services'
import { useResourceManager } from '@deta/services/resources'

import type { PreloadEvents } from './preloadEvents'
import { useLogScope } from '@deta/utils'

export const setupImportEvents = (events: PreloadEvents) => {
  const log = useLogScope('ImportEvents')
  const resourceManager = useResourceManager()

  events.onImportedFiles(async (files: File[]) => {
    try {
      log.debug('imported files', files)
      const newResources = await createResourcesFromFiles(files, resourceManager)
      log.debug('Resources', newResources)
    } catch (err) {
      log.error('Failed to import', err)
    }
  })

  const ignorePaths = new Set<string>()

  events.onResourceFileChange(async (type, data, file) => {
    try {
      log.debug('Resource file change detected', type, data, file)
      if (type === 'rename') {
        const { oldPath, newPath, newName } = data
        if (oldPath && newPath) {
          const resource = await resourceManager.getResourceByPath(oldPath)
          if (resource) {
            log.debug('Updating resource path for renamed file', resource.id, oldPath, newPath)
            await resourceManager.updateResource(resource.id, {
              resource_path: newPath,
              updated_at: new Date().toISOString()
            })

            if (!resource.type.startsWith('application/vnd.space')) {
              await resourceManager.updateResourceMetadata(resource.id, {
                name: newName || resource.metadata.name
              })
            }

            log.debug(`Updated resource path: ${oldPath} -> ${newPath}`)
          }
        }
      } else if (type === 'delete') {
        const { oldPath } = data
        if (oldPath) {
          const resource = await resourceManager.getResourceByPath(oldPath)
          if (resource) {
            log.debug('Deleting resource for deleted file', resource.id, oldPath)
            await resourceManager.deleteResource(resource.id)
            log.debug(`Deleted resource for file: ${oldPath}`)
          }
        }
      } else if (type === 'create' && file) {
        const { newPath } = data

        if (ignorePaths.has(newPath)) {
          log.debug('Ignoring resource file change for path', newPath)
          ignorePaths.delete(newPath)
          return
        }

        const existingResource = await resourceManager.getResourceByPath(newPath)
        if (existingResource) {
          log.debug('Resource already exists for created file, skipping', existingResource)
          return
        }

        const newResources = await createResourcesFromFiles([file], resourceManager)
        const resource = newResources?.[0]
        if (!resource) {
          log.warn('No resource created for new file', newPath)
          return
        }

        const oldPath = resource.path
        ignorePaths.add(oldPath)

        log.debug('Created resource for new file', resource)

        log.debug('Deleting temporary resource file and updating resource path', oldPath, newPath)
        await resource.deleteDataFile()
        await resourceManager.updateResource(resource.id, {
          resource_path: newPath
        })
      }
    } catch (error) {
      log.error('Error handling resource file change', error)
    }
  })
}
