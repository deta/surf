import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Editor } from '@tiptap/core'
import { useLogScope } from '@deta/utils/io'

export interface CaretPosition {
  left: number
  top: number
  height: number
  bottom: number
}

export interface DebugElements {
  container: HTMLDivElement | null
  marker: HTMLDivElement | null
  info: HTMLDivElement | null
}

export interface CaretIndicatorStorage {
  caretPosition: CaretPosition | null
  timeoutId: number | undefined
  debugElements: DebugElements
  lastSelectionFrom: number | null
  lastActivityTimestamp: number | null
  getCaretPosition?: () => CaretPosition | null
}

export interface CaretIndicatorOptions {
  pluginKey?: PluginKey
  updateDelay?: number
  onSelectionUpdate?: (params: { editor: Editor }) => void
  debug?: boolean
}

declare module '@tiptap/core' {
  interface EditorEvents {
    caretPositionUpdate: (position: CaretPosition) => void
  }
}

/**
 * CaretIndicatorExtension for Tiptap
 * Tracks the caret position and emits events when it changes
 */
export const CaretIndicatorExtension = Extension.create<CaretIndicatorOptions>({
  name: 'caretIndicator',

  addOptions() {
    return {
      pluginKey: new PluginKey('caretIndicator'),
      updateDelay: 60,
      onSelectionUpdate: undefined,
      debug: false
    }
  },

  addStorage(): CaretIndicatorStorage {
    return {
      caretPosition: null,
      timeoutId: undefined,
      debugElements: {
        container: null,
        marker: null,
        info: null
      },
      lastSelectionFrom: null,
      lastActivityTimestamp: Date.now()
    }
  },

  addProseMirrorPlugins() {
    const extension = this
    const updateDelay = this.options.updateDelay
    const log = useLogScope('CaretIndicator')

    let debug = this.options.debug

    // Create debug elements if needed
    function setupDebugElements(editor: Editor): void {
      // Skip if we already have the elements created
      if (extension.storage.debugElements.container) return

      log.debug('Setting up debug elements')
      const editorDOM = editor.view.dom

      // Get computed style to check for padding and margins
      const editorStyle = window.getComputedStyle(editorDOM)
      log.debug('Editor computed style:', {
        padding: {
          top: editorStyle.paddingTop,
          right: editorStyle.paddingRight,
          bottom: editorStyle.paddingBottom,
          left: editorStyle.paddingLeft
        },
        margin: {
          top: editorStyle.marginTop,
          right: editorStyle.marginRight,
          bottom: editorStyle.marginBottom,
          left: editorStyle.marginLeft
        },
        border: {
          top: editorStyle.borderTopWidth,
          right: editorStyle.borderRightWidth,
          bottom: editorStyle.borderBottomWidth,
          left: editorStyle.borderLeftWidth
        }
      })

      // Create container
      const container = document.createElement('div')
      container.style.position = 'absolute'
      container.style.top = '0'
      container.style.left = '0'
      container.style.width = '100%'
      container.style.height = '100%'
      container.style.pointerEvents = 'none'
      container.style.zIndex = '9998' // Below the popover
      container.id = 'caret-debug-container'
      if (debug) {
        editorDOM.parentNode?.appendChild(container)
      }

      // Create caret marker
      const marker = document.createElement('div')
      marker.style.position = 'absolute'
      marker.classList.add('caret-debug')
      marker.style.width = '3px'
      marker.style.height = '20px'
      marker.style.backgroundColor = 'red'
      marker.style.opacity = '0.7'
      marker.id = 'caret-debug-marker'
      if (debug) {
        container.appendChild(marker)
      }
      log.debug('Debug marker created and appended', marker)

      // Create position info display
      const info = document.createElement('div')
      info.style.position = 'absolute'
      info.style.top = '0'
      info.style.left = '0'
      info.style.backgroundColor = 'rgba(0,0,0,0.7)'
      info.style.color = 'white'
      info.style.padding = '5px'
      info.style.borderRadius = '3px'
      info.style.fontSize = '12px'
      info.style.fontFamily = 'monospace'
      info.style.zIndex = '10000'
      info.id = 'caret-debug-info'
      if (debug) {
        document.body.appendChild(info)
      }

      // Store debug elements
      extension.storage.debugElements = {
        container,
        marker,
        info
      }

      log.debug('Debug elements stored', extension.storage.debugElements)
    }

    // Update debug visualization
    function updateDebugVisualization(position: CaretPosition): void {
      if (!position) return

      const { marker, info } = extension.storage.debugElements
      if (!marker) {
        log.error('Debug marker not found!')
        return
      }

      // Update marker position
      marker.style.left = `${position.left}px`
      marker.style.top = `${position.top}px`
      marker.style.height = `${position.height}px`
      marker.style.display = 'block'

      // Update info display if available
      if (info) {
        info.textContent = `Caret position:
Left: ${Math.round(position.left)}
Top: ${Math.round(position.top)}
Height: ${Math.round(position.height)}
Bottom: ${Math.round(position.bottom)}`
        info.style.display = 'block'
      }
    }

    // Function to get caret position
    function getCaretPosition(editor: Editor): CaretPosition | null {
      // Store the function in storage so it can be accessed externally
      if (!extension.storage.getCaretPosition) {
        extension.storage.getCaretPosition = () => getCaretPosition(extension.editor)
      }

      // Safety check - make sure editor is valid
      if (!editor || !editor.state || !editor.view) {
        log.debug('Editor not fully initialized')
        return null
      }

      const { state, view } = editor

      // Safety check - make sure view is ready
      if (!view.dom || !view.docView) {
        log.debug('Editor view not fully initialized')
        return null
      }

      // Don't show indicator for non-empty selections
      if (!state.selection.empty) {
        return null
      }

      const { from } = state.selection

      try {
        // Setup debug elements if needed
        setupDebugElements(editor)

        // Get the editor element and view DOM positions
        const editorDOM = view.dom
        const editorRect = editorDOM.getBoundingClientRect()

        // Safety check - make sure domFromPos is available before calling coordsAtPos
        if (!view.docView.domFromPos) {
          log.debug('domFromPos not available')
          return null
        }

        // Try to get coordinates at the current position
        let coords
        try {
          coords = view.coordsAtPos(from)
        } catch (coordsError) {
          log.debug('Error in coordsAtPos:', coordsError)
          return null
        }

        // Verify coords are valid
        if (!coords || typeof coords.left !== 'number' || typeof coords.top !== 'number') {
          log.debug('Invalid coordinates returned')
          return null
        }

        // Add margins from the editor to the caret position
        const computedStyle = window.getComputedStyle(editorDOM)
        const marginLeft = parseFloat(computedStyle.marginLeft) || 0
        const marginTop = parseFloat(computedStyle.marginTop) || 0

        const position: CaretPosition = {
          left: coords.left - editorRect.left + marginLeft,
          top: coords.top - editorRect.top + marginTop,
          height: coords.bottom - coords.top,
          bottom: coords.bottom - editorRect.top + marginTop
        }

        // Update debug visualization
        updateDebugVisualization(position)

        return position
      } catch (error) {
        log.error('Error getting caret position:', error)
        return null
      }
    }

    // Check if selection has changed lines
    function hasChangedLine(editor: Editor, currentFrom: number): boolean {
      try {
        const { lastSelectionFrom } = extension.storage

        // If we don't have a previous position, consider it changed
        if (lastSelectionFrom === null) {
          // Update the stored position
          extension.storage.lastSelectionFrom = currentFrom
          return true
        }

        // Safety check - make sure doc is available
        if (!editor.state.doc) {
          // Update the stored position anyway
          extension.storage.lastSelectionFrom = currentFrom
          return true
        }

        // Get the current line number
        let $from, currentLine
        try {
          $from = editor.state.doc.resolve(currentFrom)
          currentLine = $from.path[1] // This generally represents the block node index
        } catch (resolveError) {
          log.debug('Error resolving current position:', resolveError)
          extension.storage.lastSelectionFrom = currentFrom
          return true
        }

        // Get the previous line number
        let $lastFrom, lastLine
        try {
          $lastFrom = editor.state.doc.resolve(lastSelectionFrom)
          lastLine = $lastFrom.path[1]
        } catch (resolveError) {
          log.debug('Error resolving last position:', resolveError)
          extension.storage.lastSelectionFrom = currentFrom
          return true
        }

        // Update the stored position
        extension.storage.lastSelectionFrom = currentFrom

        // Return true if the line has changed
        return currentLine !== lastLine
      } catch (error) {
        log.debug('Error in hasChangedLine:', error)
        // Update the stored position anyway
        if (extension.storage) {
          extension.storage.lastSelectionFrom = currentFrom
        }
        return true
      }
    }

    // Function to update caret position with basic debouncing
    function updateCaretPosition(editor: Editor, forceImmediate: boolean = false): void {
      // Safety check - make sure editor is valid
      if (!editor || !editor.state || !editor.view || !editor.storage) {
        log.debug('Editor not fully initialized in updateCaretPosition')
        return
      }

      // Cancel any pending updates
      if (extension.storage.timeoutId) {
        window.clearTimeout(extension.storage.timeoutId)
      }

      try {
        // Check if we need to force an immediate update
        const { selection } = editor.state
        if (!selection) {
          log.debug('No selection available')
          return
        }

        const { from } = selection
        const lineMoved = hasChangedLine(editor, from)

        // Force immediate update for line changes or when requested
        if (forceImmediate || lineMoved || updateDelay === 0) {
          const position = getCaretPosition(editor)
          if (position) {
            // Create a new position object to ensure reactivity in consumer components
            const newPosition = { ...position }
            extension.storage.caretPosition = newPosition
            editor.emit('caretPositionUpdate', newPosition)
          }
        } else {
          extension.storage.timeoutId = window.setTimeout(() => {
            try {
              const position = getCaretPosition(editor)
              if (position) {
                // Create a new position object to ensure reactivity
                const newPosition = { ...position }
                extension.storage.caretPosition = newPosition
                editor.emit('caretPositionUpdate', newPosition)
              }
            } catch (timeoutError) {
              log.debug('Error in timeout callback:', timeoutError)
            }
          }, updateDelay)
        }
      } catch (error) {
        log.debug('Error in updateCaretPosition:', error)
      }
    }

    // Function to update the last activity timestamp
    function updateLastActivityTimestamp(editor: Editor): void {
      if (editor && editor.storage) {
        editor.storage.lastActivityTimestamp = Date.now()
      }
    }

    // Create the plugin
    const plugin = new Plugin({
      key: this.options.pluginKey,

      view() {
        // Initial update
        setTimeout(() => {
          setupDebugElements(extension.editor)
          updateCaretPosition(extension.editor, true)
        }, 50)

        return {
          update(view, prevState) {
            // Check if selection has actually changed
            if (prevState.selection.from !== view.state.selection.from) {
              // Force immediate update when selection changes
              updateCaretPosition(extension.editor, true)
            } else {
              // Regular update for other state changes
              updateCaretPosition(extension.editor)
            }

            // Call callback if provided
            if (extension.options.onSelectionUpdate) {
              extension.options.onSelectionUpdate({ editor: extension.editor })
            }
          },
          destroy() {
            log.debug('Plugin destroy called - keeping debug elements')
            // DO NOT remove the debug elements on destroy to avoid issues with them disappearing
          }
        }
      },

      props: {
        // Improved event handling
        handleDOMEvents: {
          keydown(view, event) {
            // Update last activity timestamp
            updateLastActivityTimestamp(extension.editor)

            // Handle arrow key navigation specifically
            if (
              event.key === 'ArrowUp' ||
              event.key === 'ArrowDown' ||
              event.key === 'ArrowLeft' ||
              event.key === 'ArrowRight'
            ) {
              // Process after DOM updates but before repaint
              requestAnimationFrame(() => {
                updateCaretPosition(extension.editor, true)
              })
            }
            return false
          },
          keyup() {
            // Update last activity timestamp
            updateLastActivityTimestamp(extension.editor)

            // Always use force immediate for keyup
            updateCaretPosition(extension.editor, true)
            return false
          },
          mouseup() {
            // Update last activity timestamp
            updateLastActivityTimestamp(extension.editor)

            updateCaretPosition(extension.editor, true)
            return false
          },
          mousemove() {
            // Update last activity timestamp for mouse movements
            // but only when selecting text to avoid constant updates
            if (extension.editor.state.selection.empty === false) {
              updateLastActivityTimestamp(extension.editor)
              updateCaretPosition(extension.editor)
            }
            return false
          },
          scroll() {
            updateCaretPosition(extension.editor, true)
            return false
          }
        }
      }
    })

    return [plugin]
  }
})
