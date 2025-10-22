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
}
