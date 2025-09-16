import { get, type Writable } from 'svelte/store'
import PQueue from 'p-queue'

import { Toast, useToasts } from '@deta/ui'
import { useLocalStorageStore, useLogScope, ResourceTag } from '@deta/utils'
import { ResourceTypes } from '@deta/types'

import { type ResourceManager } from './resources/resources.svelte'
import { extractAndCreateWebResource } from './mediaImporter'
import { useConfig } from './config'

// If the sync gets called within that time it won't sync again
const MAX_SYNC_INTERVAL = 1000 * 60 * 1 // 1 minute

export type SyncLinkItem = {
  id: number
  url: string
  timestamp: string // format 2024-10-19 15:35:33
}

export class SyncService {
  resourceManager: ResourceManager
  log: ReturnType<typeof useLogScope>
  toasts: ReturnType<typeof useToasts>
  userConfig: ReturnType<typeof useConfig>

  lastSyncTime: Writable<number>

  constructor(resourceManager: ResourceManager) {
    this.resourceManager = resourceManager
    this.log = useLogScope('SyncService')
    this.toasts = useToasts()
    this.userConfig = useConfig()
    this.lastSyncTime = useLocalStorageStore<number>('lastSyncTime', 0)
  }

  private getConfig() {
    const userSettings = get(this.userConfig.settings)

    const envToken = import.meta.env.R_VITE_SYNC_AUTH_TOKEN
    const envBaseUrl = import.meta.env.R_VITE_SYNC_BASE_URL

    if (envToken && envBaseUrl) {
      this.log.debug('using env config')
      return {
        baseUrl: envBaseUrl,
        authToken: envToken
      }
    }

    if (userSettings.sync_base_url && userSettings.sync_auth_token) {
      this.log.debug('using user config')
      return {
        baseUrl: userSettings.sync_base_url,
        authToken: userSettings.sync_auth_token
      }
    }

    return null
  }

  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const config = this.getConfig()
    if (!config) {
      throw new Error('Sync service not configured')
    }

    // @ts-ignore
    const json = await window.api.fetchJSON(`${config.baseUrl}${path}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${config.authToken}`
      }
    })

    return json
  }

  private async get<T>(path: string): Promise<T> {
    this.log.debug('GET', path)
    const res = await this.fetch(path)

    this.log.debug('result', res)
    return res as T
  }

  private async post<T>(path: string, body: any): Promise<T> {
    this.log.debug('POST', path, body)
    const res = await this.fetch(path, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json'
      }
    })

    this.log.debug('result', res)
    return res as T
  }

  private async processLink(link: SyncLinkItem) {
    this.log.debug('syncing link', link)

    const matchingResources = await this.resourceManager.getResourcesFromSourceURL(link.url)
    let bookmarkedResource = matchingResources.find(
      (resource) =>
        resource.type !== ResourceTypes.ANNOTATION && resource.type !== ResourceTypes.HISTORY_ENTRY
    )

    if (bookmarkedResource) {
      this.log.debug('found existing bookmarked resource', bookmarkedResource)
      return null
    }

    const date = new Date(link.timestamp)

    const parsed = await extractAndCreateWebResource(
      this.resourceManager,
      link.url,
      {
        sourceURI: link.url
      },
      [
        ResourceTag.canonicalURL(link.url),
        ResourceTag.import(),
        ResourceTag.viewedByUser(false),
        ...(link.timestamp ? [ResourceTag.sourcePublishedAt(date.toISOString())] : [])
      ]
    )

    return parsed.resource
  }

  async sync() {
    let toast: Toast | null = null

    try {
      const config = this.getConfig()
      if (!config) {
        this.log.info('Sync service not configured')
        return
      }

      toast = this.toasts.loading('Checking for links to sync…')
      const links = await this.get<SyncLinkItem[]>('/links')

      this.log.debug('links', links)

      if (links.length === 0) {
        toast.success('Sync complete!')
        return
      }

      const MAX_CONCURRENT_ITEMS = 8
      const PROCESS_TIMEOUT = 1000 * 15 // give each item max 15 seconds to process

      const processedItems: SyncLinkItem[] = []

      this.log.debug('processing items:', links)
      const queue = new PQueue({
        concurrency: MAX_CONCURRENT_ITEMS,
        timeout: PROCESS_TIMEOUT,
        autoStart: false
      })

      let count = 0

      queue.on('completed', () => {
        toast?.update({
          message: `Syncing links (${++count}/${links.length})…`
        })
      })

      links.forEach((link) => {
        queue.add(async () => {
          this.log.debug('processing item:', link)
          const resource = await this.processLink(link)
          this.log.debug('processed resource:', resource)

          if (resource) {
            processedItems.push(link)
          }
        })
      })

      queue.start()

      toast.update({
        message: `Syncing ${links.length} link${links.length > 1 ? 's' : ''}…`
      })

      await queue.onIdle()
      this.log.debug('queue finished')
      toast.update({ message: 'Imported all links' })

      if (processedItems.length > 0) {
        this.log.debug('marking links as synced', processedItems)
        toast.update({ message: 'Finishing up sync…' })
        await this.post('/synced', {
          ids: processedItems.map((link) => link.id)
        })
      }

      this.log.debug('sync complete')
      toast.success('Sync complete!')
    } catch (e) {
      this.log.error('sync error', e)
      const message = e instanceof Error ? e.message : 'unknown error'
      if (toast) {
        toast.error('Sync failed: ' + message)
      } else {
        this.toasts.error('Sync failed: ' + message)
      }
    }
  }

  async init() {
    const lastSync = get(this.lastSyncTime)
    if (!lastSync || Date.now() - lastSync > MAX_SYNC_INTERVAL) {
      await this.sync()
      this.lastSyncTime.set(Date.now())
    }
  }
}

export const createSyncService = (resourceManager: ResourceManager) => {
  const service = new SyncService(resourceManager)

  // @ts-ignore
  window.syncService = service

  return service
}
