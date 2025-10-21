import { tick } from 'svelte'
import { SvelteMap } from 'svelte/reactivity'

import type {
  Download,
  DownloadDoneMessage,
  DownloadRequestMessage,
  DownloadState,
  DownloadUpdatedMessage
} from '@deta/types'
import { ResourceTypes } from '@deta/types'

import { shortenFilename, useLogScope } from '@deta/utils/io'
import { ResourceTag } from '@deta/utils/formatting'

import { useResourceManager } from './resources'
import { isDev } from '@deta/utils'

export class DownloadsManager {
  private downloadCompleteTimeoutMs = 5000 // keep completed downloads in the UI for 5 seconds

  private readonly log = useLogScope('DownloadsManager')
  private readonly resourceManager = useResourceManager()

  downloads = new SvelteMap<string, Download>()
  downloadInterceptors = new SvelteMap<string, (data: Download) => void>()
  downloadProgress = $state(0)

  downloadState = $derived.by<DownloadState>(() => {
    const downloads = Array.from(this.downloads.values()).filter((d) => !d.silent)
    const states = downloads.map((d) => d.state)

    if (states.length === 0) {
      return 'idle'
    }

    // return single state, worst case to best case
    if (states.includes('interrupted')) {
      return 'interrupted'
    } else if (states.includes('progressing')) {
      return 'progressing'
    } else if (states.includes('cancelled')) {
      return 'cancelled'
    } else if (states.every((s) => s === 'completed')) {
      return 'completed'
    } else if (states.every((s) => s === 'idle')) {
      return 'idle'
    } else {
      return 'progressing'
    }
  })

  static self: DownloadsManager

  constructor() {
    if (isDev) {
      ;(window as any).downloadsManager = this
    }
  }

  async handleRequestDownloadPath(data: DownloadRequestMessage) {
    try {
      await tick()

      const downloadIntercepter = this.downloadInterceptors.get(data.url)
      const existingDownload = this.downloads.get(data.id)
      if (existingDownload) {
        this.log.debug('download already in progress', data)
        return {
          path: existingDownload.savePath,
          copyToDownloads: !downloadIntercepter // && config.settingsValue.save_to_user_downloads
        }
      }

      const downloadData: Download = {
        id: data.id,
        url: data.url,
        filename: shortenFilename(data.filename),
        mimeType: data.mimeType,
        startTime: data.startTime,
        totalBytes: data.totalBytes,
        contentDisposition: data.contentDisposition,
        savePath: '',
        resourceId: '',
        state: 'idle',
        silent: !!downloadIntercepter
      }

      this.downloads.set(data.id, downloadData)

      this.log.debug('new download request', downloadData, data)

      if (
        !downloadData.silent &&
        !(
          downloadData.mimeType.startsWith('image/') ||
          downloadData.mimeType === 'video/' ||
          downloadData.mimeType === 'audio/'
        )
      ) {
        this.downloads.set(data.id, downloadData)

        return {
          path: undefined,
          copyToDownloads: true
        }
      }

      // TODO: add metadata/tags here
      const resource = await this.resourceManager.createResource(
        data.mimeType,
        undefined,
        {
          name: data.filename,
          sourceURI: data.url
        },
        [
          ResourceTag.download(),
          ...(downloadIntercepter
            ? [
                ResourceTag.silent(),
                ResourceTag.createdForChat(),
                ResourceTag.canonicalURL(data.url)
              ]
            : [])
        ]
      )

      this.log.debug('resource for download created', downloadData, resource)

      downloadData.resourceId = resource.id
      downloadData.savePath = resource.path
      this.downloads.set(data.id, downloadData)

      return {
        path: downloadData.savePath,
        copyToDownloads: !downloadData.silent
      }
    } catch (err) {
      this.log.error('download path error', err)

      return {
        path: null,
        copyToDownloads: false
      }
    }
  }

  async handleDownloadUpdated(data: DownloadUpdatedMessage) {
    try {
      this.log.debug('download updated', data)

      const downloadData = this.downloads.get(data.id)
      if (!downloadData) {
        this.log.error('download data not found', data)
        return
      }

      this.downloads.set(data.id, {
        ...downloadData,
        receivedBytes: data.receivedBytes,
        state: data.state,
        isPaused: data.isPaused,
        canResume: data.canResume
      })

      if (data.state === 'progressing') {
        const progress =
          isFinite(data.receivedBytes) && isFinite(data.totalBytes)
            ? data.receivedBytes / data.totalBytes
            : 0
        const roundedPercent = Math.round(progress * 100)

        this.log.debug('download progress', data.id, roundedPercent)

        if (roundedPercent >= 0 && roundedPercent <= 100) {
          this.downloadProgress = roundedPercent
        } else {
          this.downloadProgress = 0
        }
      } else if (data.state === 'interrupted') {
        this.downloadProgress = 0
      } else if (data.isPaused) {
        this.downloadProgress = 0
      }
    } catch (err) {
      this.log.error('download updated error', err)
      this.downloads.delete(data.id)
    }
  }

  async handleDownloadDone(data: DownloadDoneMessage) {
    try {
      this.log.debug('download done', data)

      const downloadData = this.downloads.get(data.id)
      if (!downloadData) {
        this.log.error('download data not found', data)
        return
      }

      let savedToSpace = false

      if (data.state === 'completed') {
        const resource = await this.resourceManager.reloadResource(downloadData.resourceId)
        if (resource) {
          const isValidType =
            (Object.values(ResourceTypes) as string[]).includes(resource.type) ||
            resource.type.startsWith('image/')

          if (isValidType) {
            // @ts-ignore
            await window.backend.resources.updateResourceHash(
              downloadData.resourceId,
              resource.type,
              resource.path
            )
            // @ts-ignore
            await window.backend.resources.triggerPostProcessing(downloadData.resourceId)
            this.resourceManager.reloadResource(downloadData.resourceId)
          }

          // if (tabsManager.activeScopeIdValue && $userConfigSettings.save_to_active_context) {
          //   await oasis.addResourcesToSpace(
          //     tabsManager.activeScopeIdValue,
          //     [resource.id],
          //     SpaceEntryOrigin.ManuallyAdded
          //   )
          //   savedToSpace = true
          // }
        }
      }

      this.downloads.set(data.id, {
        ...downloadData,
        state: data.state
      })

      const downloadIntercepter = this.downloadInterceptors.get(downloadData.url)
      if (downloadIntercepter) {
        downloadIntercepter(downloadData)
      }

      setTimeout(() => {
        this.downloads.delete(data.id)
      }, this.downloadCompleteTimeoutMs)
    } catch (err) {
      this.log.error('download done error', err)
      this.downloads.delete(data.id)
    }
  }

  static provide() {
    if (!DownloadsManager.self) {
      DownloadsManager.self = new DownloadsManager()
    }

    return DownloadsManager.self
  }

  static use() {
    return DownloadsManager.self
  }
}

export const createDownloadsManager = () => DownloadsManager.provide()
export const useDownloadsManager = () => DownloadsManager.use()
