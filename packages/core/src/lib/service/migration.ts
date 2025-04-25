import { get } from 'svelte/store'
import type { OasisService } from './oasis'
import type { TabsManager } from './tabs'
import { useLocalStorage, useLogScope } from '@horizon/utils'

const log = useLogScope('Migration')

export const HOME_CONTEXT_MIGRATION_KEY = 'migratedHomeContext'

export const migrateHomeContext = async (services: {
  tabsManager: TabsManager
  oasis: OasisService
}) => {
  try {
    const { tabsManager, oasis } = services

    const migrationDone = useLocalStorage<boolean>(HOME_CONTEXT_MIGRATION_KEY, false, true)
    if (migrationDone.get()) {
      log.debug('Home context already migrated')
      return
    }

    let homeSpace = get(oasis.spaces).find(
      (space) => space.dataValue.folderName === 'Home' && space.dataValue.default
    )

    if (!homeSpace) {
      homeSpace = await oasis.createSpace({
        folderName: 'Home',
        showInSidebar: true,
        colors: ['#FFD700', '#FF8C00'],
        emoji: '🏠',
        default: true,
        pinned: true
      })

      oasis.moveSpaceToIndex(homeSpace.id, 0)
    }

    const unscopedTabs = tabsManager.tabsValue.filter((tab) => !tab.scopeId && !tab.pinned)

    // move all unscoped tabs to the home space
    await Promise.all(unscopedTabs.map((tab) => tabsManager.scopeTab(tab.id, homeSpace.id)))

    migrationDone.set(true)

    // set the home space as the active scope
    await tabsManager.changeScope(homeSpace.id)
  } catch (error) {
    log.error('Error migrating home context', error)
  }
}
