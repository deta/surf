import { dialog } from 'electron'

import { useLogScope } from '@deta/utils/io'
import { BrowserType } from '@deta/types'

import { ipcSenders } from './ipcHandlers'

const log = useLogScope('Importer')

export const importFiles = async () => {
  try {
    const result = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })
    log.debug('Import files:', result)
    if (result.canceled) return

    ipcSenders.importedFiles(result.filePaths)
  } catch (error) {
    log.error('Error importing files:', error)
  }
}

export const importBrowserHistory = async (type: BrowserType) => {
  try {
    ipcSenders.importBrowserHistory(type)
  } catch (error) {
    log.error('Error importing browser history:', error)
  }
}

export const importBrowserBookmarks = async (type: BrowserType) => {
  try {
    ipcSenders.importBrowserBookmarks(type)
  } catch (error) {
    log.error('Error importing browser bookmarks:', error)
  }
}
