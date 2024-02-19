import { ElectronBlocker } from '@cliqz/adblocker-electron'
import fetch from 'cross-fetch'
import { app as _app, session } from 'electron'
// import { promises as fs } from 'fs'
// import { join } from 'path'

let blocker: ElectronBlocker | undefined
// TODO: we have no session management atm
// so this tracks only one session
let currentState = false

export async function setupAdblocker() {
  // blocker = await ElectronBlocker.fromPrebuiltAdsOnly(fetch, {
  //   path: join(app.getPath('userData'), 'adblocker.bin'),
  //   read: fs.readFile,
  //   write: fs.writeFile
  // })
  // TODO: caching might be the cause
  blocker = await ElectronBlocker.fromPrebuiltAdsOnly(fetch)
}

export function toggleAdblocker(partition: string): boolean {
  if (!blocker) return false

  currentState = !currentState
  const targetSession = session.fromPartition(partition)
  if (currentState) {
    blocker.enableBlockingInSession(targetSession)
  } else {
    blocker.disableBlockingInSession(targetSession)
  }

  return currentState
}

export function getAdblockerState(_partition: string): boolean {
  // TODO: no session management
  return !!blocker && currentState
}
