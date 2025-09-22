import { useLogScope } from '@deta/utils/io'
import { session, ipcMain, app, shell, dialog } from 'electron'
import { getMainWindow } from './mainWindow'
import { randomUUID } from 'crypto'
import fs, { promises as fsp } from 'fs'
import path from 'path'
import mime from 'mime-types'
import { IPC_EVENTS_MAIN } from '@deta/services/ipc'
import type { DownloadPathResponseMessage, SFFSResource } from '@deta/types'
import { isPathSafe, checkFileExists } from './utils'

const log = useLogScope('Download Manager')

const PDFViewerEntryPoint =
  process.argv.find((arg) => arg.startsWith('--pdf-viewer-entry-point='))?.split('=')[1] || ''

export function initDownloadManager(partition: string) {
  const targetSession = session.fromPartition(partition)

  targetSession.on('will-download', async (_event, downloadItem, sourceWebContents) => {
    downloadItem.pause()

    let finalPath = ''
    let downloadFilePath = ''
    let copyToUserDownloadsDirectory = false

    const downloadId = randomUUID()
    const filename = downloadItem.getFilename()
    const tempDownloadPath = path.join(app.getPath('temp'), `${downloadId}-${filename}`)

    const fileExtension = path.extname(filename).toLowerCase()
    const mimeType = mime.lookup(fileExtension) || downloadItem.getMimeType()
    const url = downloadItem.getURL()

    log.debug('will-download', url.startsWith('http') ? url : mimeType, filename)

    const sourcePageUrl = sourceWebContents ? sourceWebContents.getURL() : null
    log.debug('sourceWebContents', sourcePageUrl)

    const sourceIsPDFViewer =
      (sourcePageUrl && sourcePageUrl.startsWith(PDFViewerEntryPoint) && url.startsWith('blob:')) ||
      false

    log.debug('source is PDF viewer:', sourceIsPDFViewer)

    const downloadsPath = app.getPath('downloads')
    const downloadedFilePath = path.join(downloadsPath, filename)

    let defaultPath: string | undefined = undefined
    if (isPathSafe(downloadsPath, downloadedFilePath)) {
      defaultPath = downloadedFilePath
    }

    const mainWindow = getMainWindow()
    const webContents = mainWindow?.webContents
    if (!webContents) {
      log.error('No main window found')
      return
    }

    if (sourceIsPDFViewer) {
      log.debug('source is PDF viewer, skipping resource creation')

      downloadItem.setSaveDialogOptions({
        title: 'Save PDF',
        defaultPath: defaultPath
      })

      return
    } else {
      downloadItem.setSavePath(tempDownloadPath)
    }

    const moveTempFile = async (finalPath: string) => {
      // copy to downloads folder
      if (!downloadFilePath) {
        const downloadsPath = app.getPath('downloads')
        let downloadFileName = filename
        downloadFilePath = path.join(downloadsPath, downloadFileName)
        if (await checkFileExists(downloadFilePath)) {
          const ext = path.extname(downloadFileName)
          const base = path.basename(downloadFileName, ext)
          let i = 1
          while (await checkFileExists(downloadFilePath)) {
            downloadFileName = `${base} (${i})${ext}`
            downloadFilePath = path.join(downloadsPath, downloadFileName)
            i++
          }
        }
      }

      if (copyToUserDownloadsDirectory) {
        log.debug('saving download to system downloads', downloadFilePath)
        try {
          await fsp.copyFile(tempDownloadPath, downloadFilePath)
        } catch (err) {
          log.error(`error copying file to downloads: ${err}`)
          return
        }
      } else {
        log.debug('skip saving download to system downloads')
      }

      log.debug('moving download to oasis directory', finalPath)
      try {
        await fsp.rename(tempDownloadPath, finalPath)
      } catch (err) {
        log.error(`error moving file: ${err}`)
        return
      }
    }

    const handleDownloadComplete = async (state: 'interrupted' | 'completed' | 'cancelled') => {
      let path: string

      log.debug('handling completed download', state, downloadItem.getFilename())

      if (finalPath) {
        path = finalPath
        await moveTempFile(finalPath)
      } else {
        log.debug('final path not set, using temp path')
        path = tempDownloadPath
      }

      IPC_EVENTS_MAIN.downloadDone.sendToWebContents(webContents, {
        id: downloadId,
        state: state,
        filename: downloadItem.getFilename(),
        mimeType: mimeType,
        totalBytes: downloadItem.getTotalBytes(),
        contentDisposition: downloadItem.getContentDisposition(),
        startTime: downloadItem.getStartTime(),
        endTime: Date.now(),
        urlChain: downloadItem.getURLChain(),
        lastModifiedTime: downloadItem.getLastModifiedTime(),
        eTag: downloadItem.getETag(),
        savePath: path
      })
    }

    ipcMain.once(
      `download-path-response-${downloadId}`,
      async (_event, data: DownloadPathResponseMessage) => {
        const { path, copyToDownloads } = data

        log.debug(`download-path-response-${downloadId}`, path)

        // if (!path) {
        //   log.error('No path received')
        //   downloadItem.cancel()
        //   return
        // }

        copyToUserDownloadsDirectory = copyToDownloads

        if (copyToUserDownloadsDirectory) {
          const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
            title: 'Save File',
            defaultPath: defaultPath
          })

          if (canceled || !filePath) {
            log.debug('User canceled save dialog')
            downloadItem.cancel()

            // clean up temp file
            try {
              if (fs.existsSync(tempDownloadPath)) {
                await fsp.unlink(tempDownloadPath)
              }
            } catch (err) {
              log.error(`error deleting temp file: ${err}`)
            }

            IPC_EVENTS_MAIN.downloadDone.sendToWebContents(webContents, {
              id: downloadId,
              state: 'cancelled',
              filename: downloadItem.getFilename(),
              mimeType: mimeType,
              totalBytes: downloadItem.getTotalBytes(),
              contentDisposition: downloadItem.getContentDisposition(),
              startTime: downloadItem.getStartTime(),
              endTime: Date.now(),
              urlChain: downloadItem.getURLChain(),
              lastModifiedTime: downloadItem.getLastModifiedTime(),
              eTag: downloadItem.getETag(),
              savePath: finalPath
            })

            return
          }

          log.debug('User selected save path:', filePath)
          downloadFilePath = filePath
        }

        if (path) {
          finalPath = path
        } else if (downloadFilePath) {
          finalPath = downloadFilePath
        }

        downloadItem.resume()

        if (downloadItem.getState() === 'completed') {
          await handleDownloadComplete('completed')
        }
      }
    )

    IPC_EVENTS_MAIN.downloadRequest.sendToWebContents(webContents, {
      id: downloadId,
      url: url,
      filename: filename,
      mimeType: mimeType,
      totalBytes: downloadItem.getTotalBytes(),
      contentDisposition: downloadItem.getContentDisposition(),
      startTime: downloadItem.getStartTime(),
      hasUserGesture: downloadItem.hasUserGesture(),
      sourceIsPDFViewer: sourceIsPDFViewer
    })

    downloadItem.on('updated', (_event, state) => {
      log.debug(
        'download-updated',
        state,
        downloadItem.getReceivedBytes(),
        downloadItem.getTotalBytes()
      )

      IPC_EVENTS_MAIN.downloadUpdated.sendToWebContents(webContents, {
        id: downloadId,
        state: state,
        receivedBytes: downloadItem.getReceivedBytes(),
        totalBytes: downloadItem.getTotalBytes(),
        isPaused: downloadItem.isPaused(),
        canResume: downloadItem.canResume()
      })
    })

    downloadItem.once('done', async (_event, state) => {
      log.debug('download-done', state, downloadItem.getFilename())

      if (finalPath) {
        await handleDownloadComplete(state)
      } else {
        log.debug('final path not set, waiting for path response')
      }
    })
  })
}

/**
 * Opens the file associtated with a resource in the user's downloads folder using the system file explorer.
 * If the resource is not found in the downloads, it will be copied to the downloads directory.
 */
export const openResourceAsFile = async (resource: SFFSResource, resourcesDirectory: string) => {
  const downloadsPath = app.getPath('downloads')
  const resourceName = resource?.metadata?.name

  if (resourceName) {
    const downloadedFilePath = path.join(downloadsPath, resourceName)

    if (!isPathSafe(downloadsPath, downloadedFilePath)) {
      log.error('Download path is not safe:', downloadsPath, downloadedFilePath)
      return
    }

    // check if the file exists
    const exists = await fs.promises
      .access(downloadedFilePath)
      .then(() => true)
      .catch(() => false)
    if (exists) {
      log.debug('Opening resource file at', downloadedFilePath)
      shell.showItemInFolder(downloadedFilePath)
      return
    } else {
      log.debug('Resource file not found at', downloadedFilePath)
    }
  }

  const fileName = resourceName || resource.id

  const internalFilePath = path.join(resourcesDirectory, resource.id)
  const newDownloadFilePath = path.join(downloadsPath, fileName)

  if (!isPathSafe(resourcesDirectory, internalFilePath)) {
    log.error('Source path is not safe:', resourcesDirectory, internalFilePath)
    return
  }

  if (!isPathSafe(downloadsPath, newDownloadFilePath)) {
    log.error('Download path is not safe:', downloadsPath, newDownloadFilePath)
    return
  }

  log.debug('Copying resource file from', internalFilePath, 'to:', newDownloadFilePath)
  await fs.promises.copyFile(internalFilePath, newDownloadFilePath)

  log.debug('Opening resource file at', newDownloadFilePath)
  shell.showItemInFolder(newDownloadFilePath)
}
