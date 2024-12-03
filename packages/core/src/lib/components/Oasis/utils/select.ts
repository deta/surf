import { writable, get } from 'svelte/store'
import { useLogScope } from '@horizon/utils'

const log = useLogScope('Multi Select')

export const selectedItems = writable<HTMLElement[]>([])
export const selectedItemIds = writable<string[]>([])

let isDragging = false
let isSelecting = false
let selectionBox: HTMLElement | null = null
let startX = 0
let startY = 0

export function deselectAll() {
  selectedItems.set([])
  selectedItemIds.set([])
}

export function selectAll() {
  const items = Array.from(document.querySelectorAll('[data-selectable]')) as HTMLElement[]
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
  selectedItemIds.set(
    items
      .map((item) => {
        const id = item.getAttribute('data-selectable-id')
        if (!id) {
          log.warn(
            'Warning: data-selectable item does not have a data-selectable-id attribute',
            item
          )
          return ''
        }
        return id
      })
      .filter((id) => id !== '')
  )
}

function addToSelection(item: HTMLElement) {
  if (!item.classList.contains('selected')) {
    item.classList.add('selected')
    selectedItems.update((items) => {
      const newItems = [...items, item]
      updateSelection(newItems)
      return newItems
    })
  }
}

export function addSelectionById(id: string) {
  const item = document.querySelector(`[data-selectable-id="${id}"]`) as HTMLElement | null
  if (item) {
    addToSelection(item)
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

  function removeFromSelection(item: HTMLElement) {
    if (item.classList.contains('selected')) {
      item.classList.remove('selected')
      selectedItems.update((items) => {
        const newItems = items.filter((i) => i !== item)
        updateSelection(newItems)
        return newItems
      })
    }
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

    if (clickedElement) {
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
        container.querySelectorAll('[data-selectable]').forEach((item) => {
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
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'a') {
      // Note: this only copies the visible items / only the loaded ones.
      event.preventDefault()
      selectAll()
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
