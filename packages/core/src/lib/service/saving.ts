import { get, writable, type Writable } from 'svelte/store'
import { generateID, useLogScope } from '@deta/utils'

import { ResourceJSON, ResourceManager, type Resource } from './resources'
import { getResourcePreview } from '../utils/resourcePreview'
import type { OasisService } from './oasis'
import { EventEmitterBase } from './events'
import type { Toast, Toasts } from './toast'
import { extractAndCreateWebResource } from './mediaImporter'
import { SpaceEntryOrigin } from '../types'
import { ResourceTag } from '../utils/tags'

export type SaveItemMetadata = {
  url: string
  title?: string
  description?: string
  icon?: string
}

export type SavingItemEvents = {
  destroy: () => void
}

const CLOSE_TIMEOUT = 3500

export class SavingItem extends EventEmitterBase<SavingItemEvents> {
  log: ReturnType<typeof useLogScope>
  resourceManager: ResourceManager
  oasis: OasisService

  id: string
  resource: Writable<Resource | null>

  data: Writable<SaveItemMetadata>

  title: Writable<string | null>
  userContext: Writable<string>
  preventClose: Writable<boolean>

  timeout: ReturnType<typeof setTimeout> | null = null
  timeoutStartedAt: number | null = null
  timeoutDuration: number = CLOSE_TIMEOUT

  constructor(
    services: { resourceManager: ResourceManager; oasis: OasisService },
    data: SaveItemMetadata,
    resource?: Resource
  ) {
    super()
    this.id = generateID()
    this.log = useLogScope(`SavingItem ${this.id}`)
    this.resourceManager = services.resourceManager
    this.oasis = services.oasis

    this.resource = writable(resource || null)

    this.data = writable({
      title: data.title,
      description: data.description,
      url: data.url,
      icon: data.icon
    })

    this.title = writable(data.title || null)
    this.userContext = writable('')
    this.preventClose = writable(false)
  }

  get dataValue() {
    return get(this.data)
  }

  get titleValue() {
    return get(this.title)
  }

  get userContextValue() {
    return get(this.userContext)
  }

  get resourceValue() {
    return get(this.resource)
  }

  get preventCloseValue() {
    return get(this.preventClose)
  }

  async addResource(resource: Resource) {
    this.log.debug('Adding resource', resource)

    this.resource.set(resource)

    const data = this.dataValue
    const previewData = await getResourcePreview(resource)

    if (previewData.url) {
      data.url = previewData.url
    }

    if (previewData.title) {
      data.title = previewData.title

      if (!this.titleValue) {
        this.title.set(previewData.title)
      }
    }

    if (
      resource instanceof ResourceJSON &&
      resource.parsedData &&
      (resource.parsedData.description || resource.parsedData.excerpt)
    ) {
      data.description = resource.parsedData.description || resource.parsedData.excerpt
    } else if (previewData.content) {
      data.description = previewData.content
    }

    if (previewData.source.imageUrl) {
      data.icon = `image;;${previewData.source.imageUrl}`
    } else if (previewData.source.icon) {
      data.icon = previewData.source.icon
    }

    if (resource.metadata?.userContext && !this.userContextValue) {
      this.userContext.set(resource.metadata.userContext)
    }

    this.data.update(() => data)
  }

  async persistChanges() {
    this.log.debug('Persisting changes', {
      userContext: this.userContextValue,
      title: this.titleValue
    })
    if (!this.resourceValue) {
      this.log.debug('No resource to persist')
      return
    }

    await this.resourceManager.updateResourceMetadata(this.resourceValue.id, {
      ...(this.titleValue ? { name: this.titleValue } : {}),
      userContext: this.userContextValue
    })
  }

  cleanup() {
    this.log.debug('Cleaning up')
    if (this.timeout) {
      clearTimeout(this.timeout)
    }
  }

  async destroy() {
    this.log.debug('Destroying')
    await this.persistChanges()
    this.cleanup()
    this.emit('destroy')
  }

  startTimeout() {
    this.log.debug('Starting timeout', this.timeoutDuration)

    if (this.timeout) {
      clearTimeout(this.timeout)
    }

    this.timeoutStartedAt = Date.now()

    this.timeout = setTimeout(() => {
      if (this.preventCloseValue) {
        this.log.debug('Close prevented, restarting timeout')
        this.startTimeout()
        return
      }

      this.destroy()
    }, this.timeoutDuration)
  }

  stopTimeout() {
    this.log.debug('Stopping timeout')
    // this.timeoutDuration -= Date.now() - (this.timeoutStartedAt || Date.now())

    if (this.timeout) {
      clearTimeout(this.timeout)
    }
  }
}

export const savePageToContext = async (
  data: { url: string; title?: string },
  spaceId: string,
  services: { oasis: OasisService; resourceManager: ResourceManager; toasts: Toasts }
) => {
  const { oasis, resourceManager, toasts } = services

  const log = useLogScope('savePageToContext')

  let toast: Toast | undefined = undefined

  try {
    const space = await oasis.getSpace(spaceId)
    if (!space) {
      throw new Error(`Space with ID ${spaceId} not found`)
    }

    toast = toasts.loading('Saving Page…')

    log.debug('Preparing resource from page', data.url)
    const { resource } = await extractAndCreateWebResource(
      resourceManager,
      data.url,
      { name: data.title, sourceURI: data.url },
      [ResourceTag.silent(), ResourceTag.createdForChat()]
    )

    log.debug('Created resource', resource)
    if (!resource) {
      throw new Error('Resource creation failed')
    }

    toast.update({ message: `Adding to ${space.dataValue.folderName}…` })

    await oasis.addResourcesToSpace(space.id, [resource.id], SpaceEntryOrigin.ManuallyAdded)

    toast.success(`Added to ${space.dataValue.folderName}`, {
      action: {
        label: 'View',
        handler: () => {
          oasis.openResourceDetailsSidebar(resource.id, {
            select: true,
            selectedSpace: space.id
          })
        }
      }
    })
  } catch (error) {
    log.error('Error preparing resource for chat:', error)

    const msg = `Failed to add "${data.url}" to "${spaceId}"`
    if (toast) {
      toast.error(msg)
    } else {
      toasts.error(msg)
    }

    throw error
  }
}
