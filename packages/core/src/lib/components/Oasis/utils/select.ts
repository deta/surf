import { writable, get, derived } from 'svelte/store'
import { useLogScope } from '@horizon/utils'
import type { ClipboardService } from '../../../service/clipboard'

const log = useLogScope('Multi Select')

// TODO CHANGE THE CONTAINER RECT REFERENCE TO THE NEW SCROLL CAONTAINER

export const selectedItems = writable<HTMLElement[]>([])
export const selectedItemIds = writable<string[]>([])

// Separate stores for space and resource IDs
export const selectedSpaceIds = writable<string[]>([])
export const selectedResourceIds = writable<string[]>([])

// Access the clipboard service from the global window object
function getClipboardService(): ClipboardService | null {
  try {
    // Access the clipboard service from the OasisService instance
    const oasisService = (window as any).__oasisService
    if (oasisService && oasisService.clipboardService) {
      return oasisService.clipboardService
    }
    return null
  } catch (error) {
    log.error('Failed to get clipboard service', error)
    return null
  }
}

let isDragging = false
let isSelecting = false
let selectionBox: HTMLElement | null = null
let startX = 0
let startY = 0

export function deselectAll() {
  selectedItems.set([])
  selectedItemIds.set([])
  selectedSpaceIds.set([])
  selectedResourceIds.set([])
}

export function selectAll() {
  // Only select elements with data-selectable="true"
  const items = Array.from(document.querySelectorAll('[data-selectable="true"]')) as HTMLElement[]
  const currentSelectedIds = get(selectedItemIds)

  if (currentSelectedIds.length === items.length) {
    // TODO: All items are already selected, trigger load all contents
    console.log('Triggering load all contents')
    // After loading all contents, select them
    // This is a placeholder and should be replaced with actual implementation
  }

  items.forEach((item) => {
    item.classList.add('selected')
  })
  updateSelection(items)
}

export function handleSelectAll() {
  selectAll()
}

function updateSelection(items: HTMLElement[]) {
  selectedItems.set(items)

  // Extract all IDs first
  const ids = items
    .map((item) => {
      const id = item.getAttribute('data-selectable-id')
      if (!id) {
        log.warn('Warning: data-selectable item does not have a data-selectable-id attribute', item)
        return ''
      }
      return id
    })
    .filter((id) => id !== '')

  // Set all selected IDs
  selectedItemIds.set(ids)

  // Categorize items into spaces and resources
  const spaceIds: string[] = []
  const resourceIds: string[] = []

  items.forEach((item) => {
    const id = item.getAttribute('data-selectable-id')
    if (!id) return

    const selectableType = item.getAttribute('data-selectable-type')
    if (selectableType === 'space') {
      spaceIds.push(id)
    } else {
      // Default to resource if no type or resource type
      resourceIds.push(id)
    }
  })

  // Update the separate stores
  selectedSpaceIds.set(spaceIds)
  selectedResourceIds.set(resourceIds)
}

function addToSelection(item: HTMLElement, removeOthers = false) {
  log.debug('Adding item to selection', item)
  // Only add items with data-selectable="true"
  if (!item.classList.contains('selected') && item.getAttribute('data-selectable') === 'true') {
    item.classList.add('selected')
    selectedItems.update((items) => {
      if (removeOthers) {
        items.forEach((i) => i.classList.remove('selected'))
        return [item]
      }

      const newItems = [...items, item]
      updateSelection(newItems)
      return newItems
    })
  }
}

export function removeFromSelection(item: HTMLElement) {
  if (item.classList.contains('selected')) {
    item.classList.remove('selected')
    selectedItems.update((items) => {
      const newItems = items.filter((i) => i !== item)
      updateSelection(newItems)
      return newItems
    })
  }
}

/**
 * Determines if an element represents a space/folder
 * Uses the data-selectable-type attribute for reliable detection
 */
function isElementSpace(element: HTMLElement): boolean {
  // Check for our explicit data-selectable-type attribute
  const selectableType = element.getAttribute('data-selectable-type')
  if (selectableType === 'space') {
    return true
  } else if (selectableType === 'resource') {
    return false
  }

  // If no explicit type attribute is found, default to resource
  log.debug('Element missing data-selectable-type attribute:', element)
  return false
}

/**
 * Handle copy operation for selected items
 */
export function handleCopy() {
  const spaceIds = get(selectedSpaceIds)
  const resourceIds = get(selectedResourceIds)

  if (spaceIds.length === 0 && resourceIds.length === 0) {
    log.debug('No items selected to copy')
    return
  }

  log.debug('Copying selected items', { spaceIds, resourceIds })

  const clipboardService = getClipboardService()
  if (clipboardService) {
    if (spaceIds.length > 0 && resourceIds.length > 0) {
      // Mixed selection
      log.debug('Copying mixed items to clipboard', { spaceIds, resourceIds })
      clipboardService
        .copyMixed(spaceIds, resourceIds)
        .then(() => {
          log.debug('Successfully copied mixed items to clipboard')
        })
        .catch((error: Error) => {
          log.error('Failed to copy mixed items to clipboard', error)
        })
    } else if (spaceIds.length > 0) {
      // Only spaces
      log.debug('Copying spaces to clipboard', spaceIds)
      clipboardService
        .copySpaces(spaceIds)
        .then(() => {
          log.debug('Successfully copied spaces to clipboard')
        })
        .catch((error: Error) => {
          log.error('Failed to copy spaces to clipboard', error)
        })
    } else {
      // Only resources
      log.debug('Copying resources to clipboard', resourceIds)
      clipboardService
        .copyResources(resourceIds)
        .then(() => {
          log.debug('Successfully copied resources to clipboard')
        })
        .catch((error: Error) => {
          log.error('Failed to copy resources to clipboard', error)
        })
    }
  } else {
    log.error('Clipboard service not available')
  }
}

export function addSelectionById(
  id: string,
  opts?: { removeOthers?: boolean; scrollTo?: boolean }
) {
  const options = {
    removeOthers: false,
    scrollTo: false,
    ...opts
  }

  const item = document.querySelector(`[data-selectable-id="${id}"]`) as HTMLElement | null
  if (item) {
    log.debug(`Adding item with data-selectable-id="${id}" to selection`)
    addToSelection(item, options.removeOthers)

    if (options.scrollTo) {
      item.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  } else {
    log.warn(`Element with data-selectable-id="${id}" not found`)
  }
}

export function removeSelectionById(id: string) {
  const item = document.querySelector(`[data-selectable-id="${id}"]`) as HTMLElement | null
  if (item) {
    log.debug(`Removing item with data-selectable-id="${id}" from selection`)
    removeFromSelection(item)
  } else {
    log.warn(`Element with data-selectable-id="${id}" not found`)
  }
}

// Custom action to handle selection behavior
export function selection(node: HTMLElement) {
  let container = node

  function clearSelection() {
    container.querySelectorAll('.selected').forEach((item) => {
      item.classList.remove('selected')
    })
    updateSelection([])
  }

  function toggleSelection(item: HTMLElement) {
    if (item.classList.contains('selected')) {
      removeFromSelection(item)
    } else {
      addToSelection(item)
    }
  }

  function handleMouseDown(event: MouseEvent) {
    if (event.button !== 0) return

    const clickedElement = (event.target as HTMLElement).closest(
      '[data-selectable]'
    ) as HTMLElement | null
    const containerRect = container.getBoundingClientRect()
    startX = event.clientX - containerRect.left + container.scrollLeft
    startY = event.clientY - containerRect.top + container.scrollTop

    const isCmd = event.metaKey || event.ctrlKey
    const isShift = event.shiftKey

    if (clickedElement && clickedElement.getAttribute('data-selectable') === 'true') {
      if (get(selectedItemIds).length === 0) {
        return
      }
      if (isCmd) {
        // Command (or Ctrl) + click: Toggle selection
        event.preventDefault()
        toggleSelection(clickedElement)
      } else if (isShift) {
        // Shift + click: Select range (to be implemented)
        // For now, disabled till we have proper shift, select
        // addToSelection(clickedElement)
      } else {
        // Normal click: Clear selection and select only this item
        clearSelection()
        addToSelection(clickedElement)
      }

      isDragging = true
    } else {
      isSelecting = true

      if (!isShift) {
        clearSelection()
      }

      // Create selection box element
      selectionBox = document.createElement('div')
      selectionBox.className = 'selection-box'
      Object.assign(selectionBox.style, {
        position: 'absolute',
        border: '2px dashed #007bff',
        backgroundColor: 'rgba(0, 123, 255, 0.1)',
        pointerEvents: 'none',
        zIndex: '10000000000',
        left: `${startX}px`,
        top: `${startY}px`,
        width: '0',
        height: '0'
      })
      container.appendChild(selectionBox)

      // Prevent default only for selection to avoid interfering with dragging
      event.preventDefault()
    }

    function onMouseMove(event: MouseEvent) {
      if (!isSelecting && !isDragging) return

      const currentX = event.clientX - containerRect.left + container.scrollLeft
      const currentY = event.clientY - containerRect.top + container.scrollTop

      if (isSelecting && selectionBox) {
        const left = Math.min(startX, currentX)
        const top = Math.min(startY, currentY)
        const width = Math.abs(currentX - startX)
        const height = Math.abs(currentY - startY)

        Object.assign(selectionBox.style, {
          left: `${left}px`,
          top: `${top}px`,
          width: `${width}px`,
          height: `${height}px`
        })

        // Determine which elements are within the selection box
        // Only consider elements with data-selectable="true"
        container.querySelectorAll('[data-selectable="true"]').forEach((item) => {
          const rect = item.getBoundingClientRect()
          const itemLeft = rect.left - containerRect.left + container.scrollLeft
          const itemTop = rect.top - containerRect.top + container.scrollTop
          const itemRight = itemLeft + rect.width
          const itemBottom = itemTop + rect.height

          if (
            itemLeft < left + width &&
            itemRight > left &&
            itemTop < top + height &&
            itemBottom > top
          ) {
            addToSelection(item as HTMLElement)
          } else if (!isShift) {
            removeFromSelection(item as HTMLElement)
          }
        })
      }
    }

    function onMouseUp() {
      isDragging = false
      isSelecting = false
      if (selectionBox) {
        try {
          if (container.contains(selectionBox)) {
            container.removeChild(selectionBox)
          }
        } catch (error) {
          log.error('Selection Box has already been removed from the DOM:', error)
        }
        selectionBox = null
      }
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && get(selectedItemIds).length > 0) {
      event.stopImmediatePropagation()
      handleSelectAll()
    }

    const isContentEditable = (event.target as HTMLElement).isContentEditable
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement ||
      isContentEditable
    ) {
      return
    }

    if ((event.metaKey || event.ctrlKey) && event.key === 'a') {
      // Note: this only copies the visible items / only the loaded ones.
      event.preventDefault()
      selectAll()
    }

    // Handle copy (Cmd+C / Ctrl+C)
    if ((event.metaKey || event.ctrlKey) && event.key === 'c') {
      event.preventDefault()
      handleCopy()
    }
  }

  container.addEventListener('mousedown', handleMouseDown)
  window.addEventListener('keydown', handleKeyDown)

  return {
    destroy() {
      container.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }
}
