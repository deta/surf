import { useLogScope } from '@horizon/utils'
import { session, ipcMain, app } from 'electron'
import { getMainWindow } from './mainWindow'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import mime from 'mime-types'
import {
  DownloadRequestMessage,
  DownloadUpdatedMessage,
  DownloadDoneMessage
} from '@horizon/core/src/lib/types'

const log = useLogScope('Download Manager')

export function initDownloadManager(partition: string) {
  const targetSession = session.fromPartition(partition)

  targetSession.on('will-download', (_event, downloadItem) => {
    let finalPath = ''
    const downloadId = randomUUID()
    const filename = downloadItem.getFilename()
    const tempDownloadPath = path.join(app.getPath('temp'), `${downloadId}-${filename}`)

    const fileExtension = path.extname(filename).toLowerCase()
    const mimeType = mime.lookup(fileExtension) || downloadItem.getMimeType()

    downloadItem.setSavePath(tempDownloadPath)
    downloadItem.resume()

    log.debug('will-download', downloadItem.getURL(), filename)

    const moveTempFile = (finalPath: string) => {
      // copy to downloads folder
      const downloadsPath = app.getPath('downloads')

      let downloadFileName = filename
      let downloadFilePath = path.join(downloadsPath, downloadFileName)
      if (fs.existsSync(downloadFilePath)) {
        const ext = path.extname(downloadFileName)
        const base = path.basename(downloadFileName, ext)
        let i = 1
        while (fs.existsSync(downloadFilePath)) {
          downloadFileName = `${base} (${i})${ext}`
          downloadFilePath = path.join(downloadsPath, downloadFileName)
          i++
        }
      }

      log.debug('saving download to system downloads', downloadFilePath)
      fs.copyFile(tempDownloadPath, downloadFilePath, (err) => {
        if (err) {
          log.error(`error copying file to downloads: ${err}`)
          return
        }
      })

      log.debug('moving download to oasis directory', finalPath)
      fs.rename(tempDownloadPath, finalPath, (err) => {
        if (err) {
          log.error(`error moving file: ${err}`)
          return
        }
      })
    }

    getMainWindow()?.webContents.send('download-request', {
      id: downloadId,
      url: downloadItem.getURL(),
      filename: filename,
      mimeType: mimeType,
      totalBytes: downloadItem.getTotalBytes(),
      contentDisposition: downloadItem.getContentDisposition(),
      startTime: downloadItem.getStartTime(),
      hasUserGesture: downloadItem.hasUserGesture()
    } as DownloadRequestMessage)

    ipcMain.once(`download-path-response-${downloadId}`, (_event, path) => {
      if (path) {
        // downloadItem.setSavePath(path)
        // downloadItem.resume()
        finalPath = path
      }

      log.debug(`download-path-response-${downloadId}`, path)

      if (downloadItem.getState() === 'completed') {
        moveTempFile(finalPath)
      }
    })

    downloadItem.on('updated', (_event, state) => {
      log.debug(
        'download-updated',
        state,
        downloadItem.getReceivedBytes(),
        downloadItem.getTotalBytes()
      )
      getMainWindow()?.webContents.send('download-updated', {
        id: downloadId,
        state: state,
        receivedBytes: downloadItem.getReceivedBytes(),
        totalBytes: downloadItem.getTotalBytes(),
        isPaused: downloadItem.isPaused(),
        canResume: downloadItem.canResume()
      } as DownloadUpdatedMessage)
    })

    downloadItem.once('done', (_event, state) => {
      let path: string

      log.debug('download-done', state, downloadItem.getFilename())

      if (state === 'completed' && finalPath) {
        path = finalPath
        moveTempFile(finalPath)
      } else {
        path = tempDownloadPath
      }

      getMainWindow()?.webContents.send('download-done', {
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
      } as DownloadDoneMessage)
    })
  })
}
