import { get, writable, type Writable } from 'svelte/store'
import type { OasisService } from './oasis'
import type { TabsManager } from './tabs'
import { useLocalStorage, useLogScope } from '@horizon/utils'
import type { DesktopManager } from './desktop'
import type { OasisSpace } from './oasis'

const log = useLogScope('Migration')

export const HOME_CONTEXT_MIGRATION_KEY = 'migratedBuiltInHomeContext'
export const SPACE_BROWSING_CONTEXT_MIGRATION_KEY = 'migratedSpaceBrowsingContext'

// Store to track if browsing context selection is needed
export const needsBrowsingContextSelection: Writable<boolean> = writable(false)

// Store to provide spaces that need browsing context selection
export const spacesForBrowsingContextSelection: Writable<OasisSpace[]> = writable([])

/**
 * Checks if browsing context selection is needed and prepares for interactive selection
 * @returns true if selection is needed, false if migration is already done
 */
export const checkBrowsingContextSelectionNeeded = async (services: {
  oasis: OasisService
}): Promise<boolean> => {
  try {
    const { oasis } = services

    const migrationDone = useLocalStorage<boolean>(
      SPACE_BROWSING_CONTEXT_MIGRATION_KEY,
      false,
      true
    )

    // If migration is already done, don't show the dialog
    if (migrationDone.get()) {
      log.debug('Space browsing context migration already completed, skipping dialog')
      return false
    }

    log.debug('Migration not completed yet, showing dialog')

    // Wait for spaces to be loaded
    await oasis.loadSpaces()
    const spaces = get(oasis.spaces)

    // If there are no spaces at all, mark migration as done and return
    if (spaces.length === 0) {
      log.debug('No spaces found, marking migration as done')
      migrationDone.set(true)
      return false
    }

    // NOTE: THIS IS A HACK OTHERWISE NO WAY TO RELIABLY CHECK IF THIS IS A NEW USER
    // check if all the spaces were created within the last hour
    let hasOldSpace = false
    for (const space of spaces) {
      const createdAt = new Date(space.createdAt)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      if (createdAt < oneHourAgo) {
        hasOldSpace = true
        break
      }
    }
    if (!hasOldSpace) {
      log.debug('All spaces were created within the last hour, skipping dialog')
      migrationDone.set(true)
      return false
    }

    spacesForBrowsingContextSelection.set(spaces)
    needsBrowsingContextSelection.set(true)
    return true
  } catch (error) {
    log.error('Error checking browsing context selection:', error)
    return false
  }
}

/**
 * Apply browsing context selection from user choices
 * @param selectedSpaceIds IDs of spaces that should have browsing context enabled
 */
export const applyBrowsingContextSelection = async (
  services: { oasis: OasisService },
  selectedSpaceIds: string[]
): Promise<void> => {
  try {
    const { oasis } = services
    const spaces = get(oasis.spaces)
    const migrationDone = useLocalStorage<boolean>(
      SPACE_BROWSING_CONTEXT_MIGRATION_KEY,
      false,
      true
    )

    log.debug('Applying browsing context selection for spaces:', selectedSpaceIds)

    // Process all spaces with nesting data
    for (const space of spaces) {
      const spaceData = space.dataValue

      // Process all spaces with nesting data, regardless of existing value
      if (spaceData.nestingData) {
        const shouldBeEnabled = selectedSpaceIds.includes(space.id)
        const currentValue = spaceData.useAsBrowsingContext

        // Always update the space data with the user's selection, overriding existing values
        await space.updateData({
          useAsBrowsingContext: shouldBeEnabled
        })

        log.debug(
          `Set useAsBrowsingContext from ${currentValue} to ${shouldBeEnabled} for space: ${space.id}`
        )
      }
    }

    // Reset the stores
    needsBrowsingContextSelection.set(false)
    spacesForBrowsingContextSelection.set([])

    // Mark migration as completed
    migrationDone.set(true)
    log.debug('Browsing context selection applied successfully')
  } catch (error) {
    log.error('Error applying browsing context selection:', error)
  }
}

/**
 * Fallback migration if user cancels the selection
 * Sets all spaces with nestingData to have browsing context enabled
 */
export const migrateSpaceBrowsingContext = async (services: { oasis: OasisService }) => {
  try {
    const { oasis } = services
    const migrationDone = useLocalStorage<boolean>(
      SPACE_BROWSING_CONTEXT_MIGRATION_KEY,
      false,
      true
    )

    if (migrationDone.get()) {
      log.debug('Space browsing context migration already completed')
      return
    }

    log.debug('Starting space browsing context migration (fallback mode)')

    // Wait for spaces to be loaded
    await oasis.loadSpaces()
    const spaces = get(oasis.spaces)

    // Track if we made any changes
    let changesMade = false

    // Process each space
    for (const space of spaces) {
      const spaceData = space.dataValue

      // Only process nested spaces that don't have useAsBrowsingContext set
      if (spaceData.nestingData && spaceData.useAsBrowsingContext === undefined) {
        // Set useAsBrowsingContext to true for all spaces with nestingData
        // This ensures proper behavior when spaces are selected
        await space.updateData({
          useAsBrowsingContext: true
        })

        changesMade = true
        log.debug(`Set useAsBrowsingContext to true for space: ${space.id}`)
      }
    }

    // Reset the stores
    needsBrowsingContextSelection.set(false)
    spacesForBrowsingContextSelection.set([])

    // Mark migration as completed
    migrationDone.set(true)

    if (changesMade) {
      log.debug('Space browsing context migration completed with changes')
    } else {
      log.debug('Space browsing context migration completed with no changes needed')
    }
  } catch (error) {
    log.error('Error during space browsing context migration:', error)
  }
}

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
