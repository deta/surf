import { ElectronBlocker } from '@cliqz/adblocker-electron'
import fetch from 'cross-fetch'
import { session } from 'electron'

let blocker: ElectronBlocker | undefined

export async function setupAdblocker() {
  // blocker = await ElectronBlocker.fromPrebuiltAdsOnly(fetch, {
  //   path: join(app.getPath('userData'), 'adblocker.bin'),
  //   read: fs.readFile,
  //   write: fs.writeFile
  // })
  // TODO: caching might be the cause
  blocker = await ElectronBlocker.fromPrebuiltAdsOnly(fetch)
}

export function setAdblockerState(partition: string, state: boolean): void {
  if (!blocker) return

  const targetSession = session.fromPartition(partition)
  if (state) {
    !blocker.isBlockingEnabled(targetSession) && blocker.enableBlockingInSession(targetSession)
  } else {
    blocker.isBlockingEnabled(targetSession) && blocker.disableBlockingInSession(targetSession)
  }
}

export function getAdblockerState(partition: string): boolean {
  if (!blocker) return false
  return blocker.isBlockingEnabled(session.fromPartition(partition))
}
