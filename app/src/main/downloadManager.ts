import { session, ipcMain, app, shell, dialog } from 'electron'
import { getMainWindow } from './mainWindow'
import { randomUUID } from 'crypto'
import fs, { promises as fsp } from 'fs'
import path from 'path'
import mime from 'mime-types'
import { IPC_EVENTS_MAIN } from '@deta/services/ipc'
import type { DownloadPathResponseMessage, SFFSResource } from '@deta/types'
import { isPathSafe, checkFileExists } from './utils'
import { htmlToMarkdown, useLogScope } from '@deta/utils'
import { useSFFSMain } from './sffs'
import { getUserConfig, updateUserConfigSettings } from './config'

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
 * Opens the file associtated with a resource in the resources folder using the system file explorer.
 */
export const openResourceAsFile = async (resourceId: string, basePath: string) => {
  try {
    const sffs = useSFFSMain()
    if (!sffs) {
      log.error('SFFS is not initialized')
      return
    }

    const resource = await sffs.readResource(resourceId).catch(() => null)
    if (!resource) {
      log.error('Resource not found:', resourceId)
      return
    }

    const resourcePath = resource.path

    if (!isPathSafe(basePath, resourcePath)) {
      log.error('Resource path is not safe:', basePath, resourcePath)
      return
    }

    // check if the file exists
    const exists = await fs.promises
      .access(resourcePath)
      .then(() => true)
      .catch(() => false)

    if (!exists) {
      log.error('Resource file not found at', resourcePath)
      return
    }

    // show popop informing user about not editing the file directly
    const mainWindow = getMainWindow()
    if (!mainWindow) {
      log.error('No main window found')
      return
    }

    const config = getUserConfig()
    if (!config.settings.acknowledged_editing_resource_files) {
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        buttons: ['I Understand', 'Cancel'],
        defaultId: 0,
        cancelId: 1,
        title: 'Open Resource Location',
        message:
          'Heads up: Please avoid renaming or moving resource files outside of Surf to prevent issues.'
      })

      if (response !== 0) {
        log.debug('User canceled opening resource location')
        return
      }

      updateUserConfigSettings({
        acknowledged_editing_resource_files: true
      })
    }

    log.debug('Opening resource file at', resourcePath)
    shell.showItemInFolder(resourcePath)
  } catch (err) {
    log.error('Error opening resource as file:', err)
    return
  }
}

/**
 * Exports the file associated with a resource to a user-selected location.
 */
export const exportResource = async (resourceId: string, basePath: string) => {
  try {
    const sffs = useSFFSMain()
    if (!sffs) {
      log.error('SFFS is not initialized')
      return
    }

    const resource = await sffs.readResource(resourceId).catch(() => null)
    if (!resource) {
      log.error('Resource not found:', resourceId)
      return
    }

    const resourcePath = resource.path

    if (!isPathSafe(basePath, resourcePath)) {
      log.error('Resource path is not safe:', basePath, resourcePath)
      return
    }

    // check if the file exists
    const exists = await fs.promises
      .access(resourcePath)
      .then(() => true)
      .catch(() => false)

    if (!exists) {
      log.error('Resource file not found at', resourcePath)
      return
    }

    const mainWindow = getMainWindow()
    if (!mainWindow) {
      log.error('No main window found')
      return
    }

    const fileName = path.basename(resourcePath)

    // prompt user to select save location
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Resource',
      defaultPath: fileName
    })

    if (canceled || !filePath) {
      log.debug('User canceled export dialog')
      return
    }

    // read the resource file and convert to markdown
    const buffer = await fs.promises.readFile(resourcePath)
    let text = buffer.toString('utf-8')
    const markdown = await htmlToMarkdown(text, true)

    // write the markdown to the selected location
    await fs.promises.writeFile(filePath, markdown, 'utf-8')

    log.debug('Opening resource file at', filePath)
    shell.showItemInFolder(filePath)
  } catch (err) {
    log.error('Error exporting resource:', err)
    return
  }
}
