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

export function initDownloadManager(partition: string) {
  const targetSession = session.fromPartition(partition)

  targetSession.on('will-download', (_event, downloadItem) => {
    let finalPath = ''
    const downloadId = randomUUID()
    const tempDownloadPath = path.join(
      app.getPath('temp'),
      `${downloadId}-${downloadItem.getFilename()}`
    )

    const fileExtension = path.extname(downloadItem.getFilename()).toLowerCase()
    const mimeType = mime.lookup(fileExtension) || downloadItem.getMimeType()

    downloadItem.setSavePath(tempDownloadPath)
    downloadItem.resume()

    getMainWindow()?.webContents.send('download-request', {
      id: downloadId,
      url: downloadItem.getURL(),
      filename: downloadItem.getFilename(),
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

      if (downloadItem.getState() === 'completed') {
        fs.rename(tempDownloadPath, finalPath, (err) => {
          if (err) {
            console.error(`error moving file: ${err}`)
            return
          }
        })
      }
    })

    downloadItem.on('updated', (_event, state) => {
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

      if (state === 'completed' && finalPath) {
        path = finalPath
        fs.rename(tempDownloadPath, finalPath, (err) => {
          if (err) {
            console.error(`error moving file: ${err}`)
            return
          }
        })
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
