import { get } from 'svelte/store'
import type { OasisService } from './oasis'
import type { TabsManager } from './tabs'
import { useLocalStorage, useLogScope } from '@horizon/utils'
import type { DesktopManager } from './desktop'

const log = useLogScope('Migration')

export const HOME_CONTEXT_MIGRATION_KEY = 'migratedBuiltInHomeContext'

export const migrateHomeContext = async (services: {
  tabsManager: TabsManager
  oasis: OasisService
  desktopManager: DesktopManager
}) => {
  try {
    const { tabsManager, oasis, desktopManager } = services

    const migrationDone = useLocalStorage<boolean>(HOME_CONTEXT_MIGRATION_KEY, false, true)
    if (migrationDone.get()) {
      log.debug('Home context already migrated')
      return
    }

    let homeSpace = get(oasis.spaces).find((space) => space.dataValue.default)

    if (!homeSpace) {
      log.debug('Creating home space')
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
    log.debug('Moving unscoped tabs to home space', unscopedTabs)
    await Promise.all(unscopedTabs.map((tab) => tabsManager.scopeTab(tab.id, homeSpace.id)))

    const defaultDesktop = await desktopManager.useDesktop('$$default')
    const homeContextDesktop = await desktopManager.useDesktop(homeSpace.id)

    if (defaultDesktop && homeContextDesktop) {
      const defaultDesktopItems = get(defaultDesktop.items)
      log.debug(
        'Moving default desktop items to home context desktop',
        defaultDesktopItems.map((item) => get(item))
      )

      homeContextDesktop.items.update((items) => {
        return [...items, ...defaultDesktopItems]
      })

      const defaultDesktopBackground = get(defaultDesktop.background_image)
      if (defaultDesktopBackground) {
        log.debug('Setting home context desktop background', defaultDesktopBackground)
        homeContextDesktop.background_image.set(defaultDesktopBackground)
      }

      await homeContextDesktop.store()
    } else {
      log.debug('Default desktop not found')
    }

    migrationDone.set(true)
    log.debug('Migrating home context done')

    // set the home space as the active scope
    await tabsManager.changeScope(homeSpace.id)
  } catch (error) {
    log.error('Error migrating home context', error)
  }
}
