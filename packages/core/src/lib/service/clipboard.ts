import { writable, get } from 'svelte/store'
import { useLogScope } from '@deta/utils'
import type { OasisService } from './oasis'
import { SpaceEntryOrigin } from '../types'
import { selectedSpaceIds, selectedResourceIds } from '../components/Oasis/utils/select'
import { isBuiltInSpaceId } from '../constants/spaces'
import { useToasts, type Toasts } from '@deta/ui'

const log = useLogScope('ClipboardService')

/**
 * Clipboard item structure - simplified to handle both resources and spaces
 */
export interface ClipboardItem {
  resourceIds: string[]
  spaceIds: string[]
  timestamp: number
  isCut: boolean
}

/**
 * Service to handle clipboard operations for resources and spaces
 * Supports copying and pasting with keyboard shortcuts
 * Persists clipboard state between sessions
 */
export class ClipboardService {
  private clipboard = writable<ClipboardItem | null>(null)
  private oasis: OasisService
  private static instance: ClipboardService
  private toasts: Toasts

  constructor(oasis: OasisService) {
    this.oasis = oasis
    this.loadFromStorage()
    this.toasts = useToasts()

    // Listen for keyboard shortcuts
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown.bind(this))
    }

    log.debug('ClipboardService initialized')
  }

  /**
   * Get the singleton instance of the clipboard service
   */
  static getInstance(oasis: OasisService): ClipboardService {
    if (!ClipboardService.instance) {
      ClipboardService.instance = new ClipboardService(oasis)
    }
    return ClipboardService.instance
  }

  /**
   * Provide the clipboard service to the Svelte context
   */
  static provide(oasis: OasisService): ClipboardService {
    const clipboardService = ClipboardService.getInstance(oasis)
    return clipboardService
  }

  /**
   * Use the clipboard service from the Svelte context
   */
  static use(): ClipboardService {
    if (typeof window !== 'undefined' && (window as any).__oasisService) {
      return ClipboardService.getInstance((window as any).__oasisService)
    }
    throw new Error('OasisService not found. Make sure it is initialized first.')
  }

  /**
   * Unified copy method for both resources and spaces
   * @param spaceIds Array of space IDs to copy
   * @param resourceIds Array of resource IDs to copy
   */
  async copy(
    spaceIds: string[] = [],
    resourceIds: string[] = [],
    isCut: boolean = false
  ): Promise<void> {
    if (spaceIds.length === 0 && resourceIds.length === 0) {
      log.debug('Nothing to copy')
      return
    }

    log.debug(`${isCut ? 'Cutting' : 'Copying'} to clipboard`, {
      spaces: spaceIds,
      resources: resourceIds
    })

    const clipboardItem: ClipboardItem = {
      spaceIds,
      resourceIds,
      timestamp: Date.now(),
      isCut
    }

    this.clipboard.set(clipboardItem)
    this.saveToStorage()

    // Prevent actual text from being copied to system clipboard
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText('')
      } catch (error) {
        log.error('Failed to clear system clipboard', error)
      }
    }
  }

  // NOTE: we do not allow pasting resources or spaces into built-in spaces
  // however you're allowed to paste media items into `all` space
  // this should be handled outside of this service
  async handlePasteInBuiltInSpace() {
    const clipboardContent = get(this.clipboard)
    if (
      clipboardContent &&
      (clipboardContent.resourceIds.length > 0 || clipboardContent.spaceIds.length > 0)
    ) {
      log.debug('Pasting into built-in space is not allowed', clipboardContent)
      this.toasts.error('Cannot paste items into this pre-set context!')
    }
  }

  /**
   * Paste the clipboard contents to the target space
   * @param targetSpaceId ID of the space to paste to
   * @returns Promise resolving to the pasted item IDs
   */
  async paste(targetSpaceId: string): Promise<string[]> {
    if (isBuiltInSpaceId(targetSpaceId)) {
      this.handlePasteInBuiltInSpace()
      return []
    }
    const clipboardContent = get(this.clipboard)

    if (!clipboardContent) {
      log.debug('Nothing to paste')
      return []
    }

    log.debug('Pasting from clipboard to space', targetSpaceId, clipboardContent)

    try {
      const targetSpace = await this.oasis.getSpace(targetSpaceId)
      if (!targetSpace) {
        log.error('Target space not found', targetSpaceId)
        throw new Error('Target space not found')
      }

      const successfulItems: string[] = []
      const isCut = clipboardContent.isCut || false

      // Handle resources
      if (clipboardContent.resourceIds.length > 0) {
        // Add resources to target space
        await targetSpace.addResources(clipboardContent.resourceIds, SpaceEntryOrigin.ManuallyAdded)
        successfulItems.push(...clipboardContent.resourceIds)

        // If this is a cut operation, remove resources from their original spaces
        if (isCut) {
          // Get all spaces
          const allSpaces = get(this.oasis.spaces)

          for (const resourceId of clipboardContent.resourceIds) {
            // For each space, check if it contains the resource and is not the target space
            for (const space of allSpaces) {
              if (space.id !== targetSpaceId) {
                // Check if this space contains the resource by looking at its contents
                const contents = space.contentsValue
                const hasResource = contents.some((entry) => entry.entry_id === resourceId)

                if (hasResource) {
                  // Remove the resource from this space
                  await space.removeResources([resourceId])
                  log.debug(
                    `Removed resource ${resourceId} from space ${space.id} as part of cut operation`
                  )
                }
              }
            }
          }
        }
      }

      // Handle spaces
      if (clipboardContent.spaceIds.length > 0) {
        for (const spaceId of clipboardContent.spaceIds) {
          // Don't allow pasting a space into itself
          if (spaceId === targetSpaceId) {
            log.error('Cannot paste a space into itself:', spaceId)
            continue
          }

          try {
            if (isCut) {
              // Move the space to the target space
              const moveResult = await this.oasis.moveSpace(spaceId, targetSpaceId)
              if (moveResult) {
                successfulItems.push(spaceId)
                log.debug('Successfully moved space:', spaceId, 'to', targetSpaceId)
              } else {
                log.warn('Failed to move space:', spaceId, 'to', targetSpaceId)
              }
            } else {
              // Nest the space within the target space
              // Copy the space into the target space
              const copyResult = await this.oasis.nestSpaceWithin(spaceId, targetSpaceId)

              if (copyResult) {
                successfulItems.push(spaceId)
                log.debug('Successfully copied space:', spaceId, 'to', targetSpaceId)
              } else {
                log.warn('Failed to copy space:', spaceId, 'to', targetSpaceId)
              }
            }
          } catch (error) {
            log.error('Failed to process space:', spaceId, error)
          }
        }
      }

      // Reload the target space to show the changes
      this.oasis.reloadSpace(targetSpaceId)
      return successfulItems
    } catch (error) {
      log.error('Error during paste operation:', error)
      throw error
    }
  }

  /**
   * Get the current clipboard content
   */
  getClipboardContent(): ClipboardItem | null {
    return get(this.clipboard)
  }

  /**
   * Clear the clipboard
   */
  clear(): void {
    this.clipboard.set(null)
    this.saveToStorage()
  }

  /**
   * Handle keyboard shortcuts for copy/paste
   */
  private handleKeyDown(event: KeyboardEvent): void {
    // Skip if in an input field or editable content
    const target = event.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.getAttribute('contenteditable') === 'true'
    ) {
      return
    }

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const modKey = isMac ? event.metaKey : event.ctrlKey

    try {
      // Handle copy (Cmd+C / Ctrl+C)
      if (modKey && event.key === 'c') {
        this.handleCopyShortcut()
        // Don't prevent default to allow system clipboard operations
      }

      // Handle cut (Cmd+X / Ctrl+X)
      if (modKey && event.key === 'x') {
        this.handleCutShortcut()
        // Don't prevent default to allow system clipboard operations
      }

      // Handle paste (Cmd+V / Ctrl+V)
      if (modKey && event.key === 'v') {
        this.handlePasteShortcut()
        // Prevent default to avoid pasting text into the document
        event.preventDefault()
      }
    } catch (error: any) {
      this.toasts.error(error)
    }
  }

  /**
   * Handle copy shortcut (Cmd+C / Ctrl+C)
   */
  private handleCopyShortcut(): void {
    // Get selected space and resource IDs directly from the selection stores
    const spaceIds = get(selectedSpaceIds)
    const resourceIds = get(selectedResourceIds)

    if (spaceIds.length === 0 && resourceIds.length === 0) return

    // Use the unified copy method with isCut=false
    this.copy(spaceIds, resourceIds, false)
      .then(() => log.debug('Successfully copied items to clipboard'))
      .catch((error) => log.error('Failed to copy items to clipboard', error))
  }

  /**
   * Handle paste shortcut (Cmd+V / Ctrl+V)
   */
  private handlePasteShortcut(): void {
    // Get the current active space
    const selectedSpaceId = get(this.oasis.selectedSpace)
    if (selectedSpaceId) {
      this.paste(selectedSpaceId)
        .then((ids) => {
          log.debug('Pasted items', ids)
        })
        .catch((error) => {
          log.error('Failed to paste items', error)
        })
    }
  }

  /**
   * Save clipboard state to localStorage
   */
  private saveToStorage(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const clipboardContent = get(this.clipboard)
        localStorage.setItem('horizon-clipboard', JSON.stringify(clipboardContent))
      } catch (error) {
        log.error('Failed to save clipboard to storage', error)
      }
    }
  }

  /**
   * Load clipboard state from localStorage
   */
  private loadFromStorage(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const savedClipboard = localStorage.getItem('horizon-clipboard')
        if (savedClipboard) {
          const parsedClipboard = JSON.parse(savedClipboard) as ClipboardItem
          this.clipboard.set(parsedClipboard)
          log.debug('Loaded clipboard from storage', parsedClipboard)
        }
      } catch (error) {
        log.error('Failed to load clipboard from storage', error)
      }
    }
  }

  /**
   * Legacy methods for backward compatibility
   */
  async copyResources(resourceIds: string[]): Promise<void> {
    return this.copy([], resourceIds, false)
  }

  async copySpaces(spaceIds: string[]): Promise<void> {
    return this.copy(spaceIds, [], false)
  }

  async copyMixed(spaceIds: string[], resourceIds: string[]): Promise<void> {
    return this.copy(spaceIds, resourceIds, false)
  }

  /**
   * Cut items to clipboard for later pasting (move operation)
   * @param spaceIds Array of space IDs to cut
   * @param resourceIds Array of resource IDs to cut
   */
  async cut(spaceIds: string[] = [], resourceIds: string[] = []): Promise<void> {
    return this.copy(spaceIds, resourceIds, true)
  }

  /**
   * Handle cut shortcut (Cmd+X / Ctrl+X)
   */
  private handleCutShortcut(): void {
    // Get selected space and resource IDs directly from the selection stores
    const spaceIds = get(selectedSpaceIds)
    const resourceIds = get(selectedResourceIds)

    if (spaceIds.length === 0 && resourceIds.length === 0) return

    // Use the unified copy method with isCut=true
    this.copy(spaceIds, resourceIds, true)
      .then(() => log.debug('Successfully cut items to clipboard'))
      .catch((error) => log.error('Failed to cut items to clipboard', error))
  }
}

// Export a convenience function to use the clipboard service
export function useClipboard(): ClipboardService {
  return ClipboardService.use()
}
