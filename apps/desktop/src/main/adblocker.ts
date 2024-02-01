import { ElectronBlocker } from '@cliqz/adblocker-electron'
import fetch from 'cross-fetch'
import { promises as fs } from 'fs'
import { app, session } from 'electron'
import { join } from 'path'

let blocker: ElectronBlocker | undefined

export async function setupAdblocker() {
  blocker = await ElectronBlocker.fromPrebuiltAdsOnly(fetch, {
    path: join(app.getPath('userData'), 'adblocker.bin'),
    read: fs.readFile,
    write: fs.writeFile
  })
}

export function toggleAdblocker(enable: boolean, partition: string) {
  if (blocker) {
    const targetSession = session.fromPartition(partition)
    if (enable) {
      blocker.enableBlockingInSession(targetSession)
    } else {
      blocker.disableBlockingInSession(targetSession)
    }
  }
}
