import { get, writable, type Writable } from 'svelte/store'
import EventEmitter from 'events'
import type TypedEmitter from 'typed-emitter'

import { conditionalArrayItem, generateID, useLogScope } from '@horizon/utils'

import type { TabPage } from '../types'
import { ResourceJSON, ResourceManager, type Resource } from './resources'
import { getResourcePreview } from '../utils/resourcePreview'
import type { OasisService } from './oasis'

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

export class SavingItem {
  log: ReturnType<typeof useLogScope>
  resourceManager: ResourceManager
  oasis: OasisService
  private eventEmitter: TypedEmitter<SavingItemEvents>

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
    this.id = generateID()
    this.log = useLogScope(`SavingItem ${this.id}`)
    this.resourceManager = services.resourceManager
    this.oasis = services.oasis
    this.eventEmitter = new EventEmitter() as TypedEmitter<SavingItemEvents>

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

  on<E extends keyof SavingItemEvents>(event: E, listener: SavingItemEvents[E]): () => void {
    this.eventEmitter.on(event, listener)

    return () => {
      this.eventEmitter.off(event, listener)
    }
  }

  emit<E extends keyof SavingItemEvents>(event: E, ...args: Parameters<SavingItemEvents[E]>) {
    this.eventEmitter.emit(event, ...args)
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
    this.log.debug('Persisting changes')
    if (!this.resourceValue) return

    await this.resourceManager.updateResourceMetadata(this.resourceValue.id, {
      ...conditionalArrayItem(!!this.titleValue, { title: this.titleValue }),
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
