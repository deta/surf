import { SpaceBasicData } from '@horizon/core/src/lib/service/ipc/events'

let cachedSpaces: SpaceBasicData[] = []

export function getCachedSpaces() {
  return cachedSpaces
}

export function updateCachedSpaces(items: SpaceBasicData[]) {
  cachedSpaces = items
}
