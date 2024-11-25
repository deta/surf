import { dialog } from 'electron'
import { useLogScope } from '@horizon/utils'

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
