// 导入 Electron 模块：
// - session: 管理会话和网络请求
// - ipcMain: 主进程和渲染进程间的通信
// - app: 应用程序生命周期管理
// - shell: 系统原生功能调用
// - dialog: 显示系统对话框
import { session, ipcMain, app, shell, dialog } from 'electron'
// 导入主窗口获取函数
import { getMainWindow } from './mainWindow'
// 导入 UUID 生成工具
import { randomUUID } from 'crypto'
// 导入文件系统模块
import fs, { promises as fsp } from 'fs'
// 导入路径处理模块
import path from 'path'
// 导入 MIME 类型检测模块
import mime from 'mime-types'
// 导入 IPC 事件常量
import { IPC_EVENTS_MAIN } from '@deta/services/ipc'
// 导入类型定义
import type { DownloadPathResponseMessage, SFFSResource } from '@deta/types'
// 导入工具函数
import { isPathSafe, checkFileExists } from './utils'
// 导入 HTML 转 Markdown 工具和日志工具
import { htmlToMarkdown, useLogScope } from '@deta/utils'
// 导入 SFFS (Secure File File System) 主进程实例
import { useSFFSMain } from './sffs'
// 导入配置管理函数
import { getUserConfig, updateUserConfigSettings } from './config'

// 初始化日志记录器，作用域为 'Download Manager'
const log = useLogScope('Download Manager')

// 从命令行参数中获取 PDF 查看器入口点路径
const PDFViewerEntryPoint =
  process.argv.find((arg) => arg.startsWith('--pdf-viewer-entry-point='))?.split('=')[1] || ''

/**
 * 初始化下载管理器
 * @param partition 会话分区名称
 */
export function initDownloadManager(partition: string) {
  // 获取指定分区的会话实例
  const targetSession = session.fromPartition(partition)

  // 监听下载事件
  targetSession.on('will-download', async (_event, downloadItem, sourceWebContents) => {
    // 暂停下载，等待处理
    downloadItem.pause()

    // 初始化下载相关变量
    let finalPath = '' // 最终保存路径
    let downloadFilePath = '' // 用户下载文件夹路径
    let copyToUserDownloadsDirectory = false // 是否复制到用户下载文件夹

    // 生成唯一下载 ID
    const downloadId = randomUUID()
    // 获取下载文件名
    const filename = downloadItem.getFilename()
    // 创建临时下载路径
    const tempDownloadPath = path.join(app.getPath('temp'), `${downloadId}-${filename}`)

    // 获取文件扩展名和 MIME 类型
    const fileExtension = path.extname(filename).toLowerCase()
    const mimeType = mime.lookup(fileExtension) || downloadItem.getMimeType()
    // 获取下载 URL
    const url = downloadItem.getURL()

    // 记录下载信息
    log.debug('will-download', url.startsWith('http') ? url : mimeType, filename)

    // 获取来源页面 URL
    const sourcePageUrl = sourceWebContents ? sourceWebContents.getURL() : null
    log.debug('sourceWebContents', sourcePageUrl)

    // 判断是否从 PDF 查看器发起的下载
    const sourceIsPDFViewer =
      (sourcePageUrl && sourcePageUrl.startsWith(PDFViewerEntryPoint) && url.startsWith('blob:')) ||
      false

    log.debug('source is PDF viewer:', sourceIsPDFViewer)

    // 计算默认保存路径
    const downloadsPath = app.getPath('downloads')
    const downloadedFilePath = path.join(downloadsPath, filename)

    let defaultPath: string | undefined = undefined
    // 检查路径安全性
    if (isPathSafe(downloadsPath, downloadedFilePath)) {
      defaultPath = downloadedFilePath
    }

    // 获取主窗口引用
    const mainWindow = getMainWindow()
    const webContents = mainWindow?.webContents
    if (!webContents) {
      log.error('No main window found')
      return
    }

    // 处理 PDF 查看器发起的下载
    if (sourceIsPDFViewer) {
      log.debug('source is PDF viewer, skipping resource creation')

      // 设置保存对话框选项
      downloadItem.setSaveDialogOptions({
        title: 'Save PDF',
        defaultPath: defaultPath
      })

      return
    } else {
      // 设置临时保存路径
      downloadItem.setSavePath(tempDownloadPath)
    }

    /**
     * 将临时下载的文件移动到最终位置
     * @param finalPath 最终保存路径
     */
    const moveTempFile = async (finalPath: string) => {
      // 如果用户选择复制到下载文件夹，设置下载文件夹路径
      if (!downloadFilePath) {
        const downloadsPath = app.getPath('downloads')
        let downloadFileName = filename
        downloadFilePath = path.join(downloadsPath, downloadFileName)
        // 检查文件是否已存在，如存在则添加序号避免覆盖
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

      // 如果需要复制到用户下载文件夹
      if (copyToUserDownloadsDirectory) {
        log.debug('saving download to system downloads', downloadFilePath)
        try {
          // 复制文件到下载文件夹
          await fsp.copyFile(tempDownloadPath, downloadFilePath)
        } catch (err) {
          log.error(`error copying file to downloads: ${err}`)
          return
        }
      } else {
        log.debug('skip saving download to system downloads')
      }

      // 将临时文件移动到最终位置
      log.debug('moving download to oasis directory', finalPath)
      try {
        await fsp.rename(tempDownloadPath, finalPath)
      } catch (err) {
        log.error(`error moving file: ${err}`)
        return
      }
    }

    /**
     * 处理下载完成的逻辑
     * @param state 下载状态：interrupted、completed 或 cancelled
     */
    const handleDownloadComplete = async (state: 'interrupted' | 'completed' | 'cancelled') => {
      let path: string

      log.debug('handling completed download', state, downloadItem.getFilename())

      if (finalPath) {
        // 如果有最终路径，使用它
        path = finalPath
        await moveTempFile(finalPath)
      } else {
        // 否则使用临时路径
        log.debug('final path not set, using temp path')
        path = tempDownloadPath
      }

      // 发送下载完成事件到渲染进程
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

    // 监听下载路径响应事件
    ipcMain.once(
      `download-path-response-${downloadId}`,
      async (_event, data: DownloadPathResponseMessage) => {
        const { path, copyToDownloads } = data

        log.debug(`download-path-response-${downloadId}`, path)

        // 设置是否复制到下载文件夹
        copyToUserDownloadsDirectory = copyToDownloads

        // 如果用户选择复制到下载文件夹
        if (copyToUserDownloadsDirectory) {
          // 显示保存对话框
          const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
            title: 'Save File',
            defaultPath: defaultPath
          })

          // 如果用户取消了操作
          if (canceled || !filePath) {
            log.debug('User canceled save dialog')
            downloadItem.cancel()

            // 清理临时文件
            try {
              if (fs.existsSync(tempDownloadPath)) {
                await fsp.unlink(tempDownloadPath)
              }
            } catch (err) {
              log.error(`error deleting temp file: ${err}`)
            }

            // 发送取消下载事件
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

        // 设置最终保存路径
        if (path) {
          finalPath = path
        } else if (downloadFilePath) {
          finalPath = downloadFilePath
        }

        // 恢复下载
        downloadItem.resume()

        // 如果下载已经完成（可能在等待响应期间已完成）
        if (downloadItem.getState() === 'completed') {
          await handleDownloadComplete('completed')
        }
      }
    )

    // 发送下载请求事件到渲染进程
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

    // 监听下载进度更新
    downloadItem.on('updated', (_event, state) => {
      log.debug(
        'download-updated',
        state,
        downloadItem.getReceivedBytes(),
        downloadItem.getTotalBytes()
      )

      // 发送下载进度更新事件到渲染进程
      IPC_EVENTS_MAIN.downloadUpdated.sendToWebContents(webContents, {
        id: downloadId,
        state: state,
        receivedBytes: downloadItem.getReceivedBytes(),
        totalBytes: downloadItem.getTotalBytes(),
        isPaused: downloadItem.isPaused(),
        canResume: downloadItem.canResume()
      })
    })

    // 监听下载完成事件
    downloadItem.once('done', async (_event, state) => {
      log.debug('download-done', state, downloadItem.getFilename())

      // 如果有最终路径，则处理完成
      if (finalPath) {
        await handleDownloadComplete(state)
      } else {
        // 否则等待路径响应
        log.debug('final path not set, waiting for path response')
      }
    })
  })
}

/**
 * 使用系统文件浏览器打开资源文件
 * 该函数允许用户在文件系统中查看与资源关联的文件
 * @param resourceId 资源ID
 * @param basePath 基础路径，用于安全检查
 */
export const openResourceAsFile = async (resourceId: string, basePath: string) => {
  try {
    // 获取 SFFS 实例
    const sffs = useSFFSMain()
    if (!sffs) {
      log.error('SFFS is not initialized')
      return
    }

    // 读取资源信息
    const resource = await sffs.readResource(resourceId).catch(() => null)
    if (!resource) {
      log.error('Resource not found:', resourceId)
      return
    }

    const resourcePath = resource.path

    // 安全检查：确保路径在允许的范围内
    if (!isPathSafe(basePath, resourcePath)) {
      log.error('Resource path is not safe:', basePath, resourcePath)
      return
    }

    // 检查文件是否存在
    const exists = await fs.promises
      .access(resourcePath)
      .then(() => true)
      .catch(() => false)

    if (!exists) {
      log.error('Resource file not found at', resourcePath)
      return
    }

    // 获取主窗口引用
    const mainWindow = getMainWindow()
    if (!mainWindow) {
      log.error('No main window found')
      return
    }

    // 获取用户配置
    const config = getUserConfig()
    // 如果用户尚未确认过资源文件编辑警告
    if (!config.settings.acknowledged_editing_resource_files) {
      // 显示提示消息
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        buttons: ['I Understand', 'Cancel'],
        defaultId: 0,
        cancelId: 1,
        title: 'Open Resource Location',
        message:
          'Heads up: Please avoid renaming or moving resource files outside of Breakwind to prevent issues.'
      })

      // 如果用户取消操作
      if (response !== 0) {
        log.debug('User canceled opening resource location')
        return
      }

      // 更新用户配置，标记已确认
      updateUserConfigSettings({
        acknowledged_editing_resource_files: true
      })
    }

    // 打开资源文件在文件浏览器中
    log.debug('Opening resource file at', resourcePath)
    shell.showItemInFolder(resourcePath)
  } catch (err) {
    log.error('Error opening resource as file:', err)
    return
  }
}

/**
 * 导出资源文件到用户选择的位置
 * 将 HTML 资源转换为 Markdown 格式导出
 * @param resourceId 资源ID
 * @param basePath 基础路径，用于安全检查
 */
export const exportResource = async (resourceId: string, basePath: string) => {
  try {
    // 获取 SFFS 实例
    const sffs = useSFFSMain()
    if (!sffs) {
      log.error('SFFS is not initialized')
      return
    }

    // 读取资源信息
    const resource = await sffs.readResource(resourceId).catch(() => null)
    if (!resource) {
      log.error('Resource not found:', resourceId)
      return
    }

    const resourcePath = resource.path

    // 安全检查
    if (!isPathSafe(basePath, resourcePath)) {
      log.error('Resource path is not safe:', basePath, resourcePath)
      return
    }

    // 检查文件是否存在
    const exists = await fs.promises
      .access(resourcePath)
      .then(() => true)
      .catch(() => false)

    if (!exists) {
      log.error('Resource file not found at', resourcePath)
      return
    }

    // 获取主窗口引用
    const mainWindow = getMainWindow()
    if (!mainWindow) {
      log.error('No main window found')
      return
    }

    // 获取文件名
    const fileName = path.basename(resourcePath)

    // 提示用户选择保存位置
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Resource',
      defaultPath: fileName
    })

    // 如果用户取消操作
    if (canceled || !filePath) {
      log.debug('User canceled export dialog')
      return
    }

    // 读取资源文件并转换为 Markdown
    const buffer = await fs.promises.readFile(resourcePath)
    let text = buffer.toString('utf-8')
    const markdown = await htmlToMarkdown(text, true)

    // 将 Markdown 写入选定位置
    await fs.promises.writeFile(filePath, markdown, 'utf-8')

    // 在文件浏览器中显示导出的文件
    log.debug('Opening resource file at', filePath)
    shell.showItemInFolder(filePath)
  } catch (err) {
    log.error('Error exporting resource:', err)
    return
  }
}
