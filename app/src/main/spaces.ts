import { SpaceBasicData } from '@deta/services/ipc'

let cachedSpaces: SpaceBasicData[] = []

export function getCachedSpaces() {
  return cachedSpaces
}

export function updateCachedSpaces(items: SpaceBasicData[]) {
  cachedSpaces = items
}
