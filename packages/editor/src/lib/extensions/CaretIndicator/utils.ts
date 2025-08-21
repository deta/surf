import type { Editor } from '@tiptap/core'
import type { CaretPosition } from './CaretIndicatorExtension'
import { useLogScope } from '@deta/utils/io'

// Idle timeout in milliseconds
const IDLE_TIMEOUT = 300
const log = useLogScope('CaretIndicator')

/**
 * Determines if the cursor is at the end of a line
 */
export function isCaretAtEndOfLine(editor: Editor): boolean {
  if (!editor || !editor.state) {
    return false
  }

  const { state } = editor
  const { selection } = state
  const { empty } = selection
  const $cursor = selection.$cursor || selection.$from

  // Must be a cursor selection (not a range)
  if (!empty || !$cursor) {
    return false
  }

  // Get the current node and position
  const currentNode = $cursor.parent
  const currentPos = $cursor.pos

  // Case 1: Check if at the end of the current textblock node
  if (currentPos === $cursor.end() && currentNode.isTextblock) {
    return true
  }

  // Case 2: Check if at the end of a line but before a block node
  // This captures cases where the caret is at the end of a paragraph
  // but there's another block node (like a heading) after it
  const nodeAfter = $cursor.nodeAfter
  if (nodeAfter && !nodeAfter.isInline) {
    return true
  }

  // Case 3: Check if we're just before a hard break
  if (nodeAfter && nodeAfter.type.name === 'hardBreak') {
    return true
  }

  // Case 4: Check if the next character is a line break
  try {
    // Check if currentPos+1 is within valid document range
    if (currentPos < state.doc.content.size) {
      const nextChar = state.doc.textBetween(currentPos, currentPos + 1)
      if (nextChar === '\n') {
        return true
      }
    }
  } catch (error) {
    // Handle potential errors when trying to access text outside of document range
    log.debug('Error in textBetween:', error)
  }

  // Case 5: Check if we're at the very end of the document
  try {
    if (currentPos === state.doc.content.size) {
      return true
    }
  } catch (error) {
    // Handle potential errors when accessing document content
    log.error('Error checking document end:', error)
    return false
  }

  return false
}

/**
 * Checks if the current cursor is in a specific node type
 */
export function isInNodeType(editor: Editor, nodeType: string): boolean {
  if (!editor || !editor.state) {
    return false
  }

  const { state } = editor
  const { selection } = state
  const $cursor = selection.$cursor || selection.$from

  if (!$cursor) {
    return false
  }

  try {
    // Check if the current node or any of its ancestors is of the specified type
    for (let depth = $cursor.depth; depth >= 0; depth--) {
      const node = $cursor.node(depth)
      if (node && node.type && node.type.name === nodeType) {
        return true
      }
    }
  } catch (error) {
    log.debug('Error in isInNodeType:', error)
    return false
  }

  return false
}

/**
 * Checks if a node has at least the specified number of characters
 */
export function hasMinimumCharacters(
  editor: Editor,
  minCharacters: number,
  nodeType?: string
): boolean {
  if (!editor || !editor.state) {
    return false
  }

  const { state } = editor
  const { selection } = state
  const $pos = selection.$cursor || selection.$from

  if (!$pos) {
    return false
  }

  try {
    // If a specific node type is provided, find that node in the ancestor chain
    if (nodeType) {
      for (let depth = $pos.depth; depth >= 0; depth--) {
        const node = $pos.node(depth)
        if (node && node.type && node.type.name === nodeType) {
          // Check if this node has at least minCharacters characters
          return node.textContent.length >= minCharacters
        }
      }
      return false
    }

    // If no specific node type, check the current parent node
    const currentNode = $pos.parent
    if (!currentNode) return false

    // Return false when it's less than 3 characters
    if (minCharacters >= 3 && currentNode.textContent.length < 3) {
      return false
    }

    return currentNode.textContent.length >= minCharacters
  } catch (error) {
    log.debug('Error in hasMinimumCharacters:', error)
    return false
  }
}

/**
 * Configuration for caret popover visibility
 */
export interface CaretPopoverConfig {
  showAtEndOfLine?: boolean
  showInNodeTypes?: string[]
  hideInNodeTypes?: string[]
  onlyWhenIdle?: boolean
  minCharacters?: number // Add this to the interface
  disallowedFirstCharacters?: string[] // Characters that prevent caret from showing
}

/**
 * Checks if the current node is empty (contains no content)
 */
export function isNodeEmpty(editor: Editor, nodeType?: string): boolean {
  if (!editor || !editor.state) {
    return false
  }

  const { state } = editor
  const { selection } = state
  const $pos = selection.$cursor || selection.$from

  if (!$pos) {
    return false
  }

  try {
    // If a specific node type is provided, find that node in the ancestor chain
    if (nodeType) {
      for (let depth = $pos.depth; depth >= 0; depth--) {
        const node = $pos.node(depth)
        if (node && node.type && node.type.name === nodeType) {
          // Check if this node is empty (has default content or no content)
          return node.content.size === 0 || (node.textContent.trim() === '' && !node.childCount)
        }
      }
      return false
    }

    // If no specific node type, check the current parent node
    const currentNode = $pos.parent
    if (!currentNode) return false

    return (
      currentNode.content.size === 0 ||
      (currentNode.textContent.trim() === '' && !currentNode.childCount)
    )
  } catch (error) {
    log.debug('Error in isNodeEmpty:', error)
    return false
  }
}

/**
 * Checks if the first character of the node is in the disallowed list
 */
export function hasDisallowedFirstCharacter(
  editor: Editor,
  disallowedChars: string[] = ['/', '@']
): boolean {
  if (!editor || !editor.state) {
    return false
  }

  const { state } = editor
  const { selection } = state
  const $pos = selection.$cursor || selection.$from

  if (!$pos) {
    return false
  }

  try {
    // Get the current node
    const currentNode = $pos.parent
    if (!currentNode || !currentNode.textContent) {
      return false
    }

    // Get the first character of the node's text content
    const firstChar = currentNode.textContent.trim()[0]

    // Return true if the first character is in the disallowed list
    return firstChar ? disallowedChars.includes(firstChar) : false
  } catch (error) {
    log.debug('Error in hasDisallowedFirstCharacter:', error)
    return false
  }
}

/**
 * Checks if the editor is in an idle state (no typing activity for a certain period)
 */
export function isEditorIdle(editor: Editor): boolean {
  if (!editor || !editor.storage) {
    return false
  }

  try {
    // Access the lastActivity timestamp from editor storage
    // If it doesn't exist yet, we'll create it in the transaction handlers
    const lastActivity = editor.storage.lastActivityTimestamp as number | undefined

    if (!lastActivity) {
      return false
    }

    // Check if enough time has passed since the last activity
    const now = Date.now()
    const timeSinceLastActivity = now - lastActivity

    return timeSinceLastActivity > IDLE_TIMEOUT
  } catch (error) {
    log.debug('Error in isEditorIdle:', error)
    return false
  }
}

/**
 * Determines if the caret popover should be visible based on configuration
 */
export function shouldShowCaretPopover(
  editor: Editor,
  position: CaretPosition | null,
  config: CaretPopoverConfig = { showAtEndOfLine: true }
): boolean {
  if (!position || !editor || !editor.state) {
    return false
  }

  try {
    // Check for node type exclusions first
    if (config.hideInNodeTypes?.length) {
      for (const nodeType of config.hideInNodeTypes) {
        if (isInNodeType(editor, nodeType)) {
          return false
        }
      }
    }

    // Check for specific node types to show in
    if (config.showInNodeTypes?.length) {
      let found = false
      for (const nodeType of config.showInNodeTypes) {
        if (isInNodeType(editor, nodeType)) {
          found = true
          break
        }
      }

      if (!found) {
        return false
      }
    }

    // Check idle state if required
    if (config.onlyWhenIdle && !isEditorIdle(editor)) {
      return false
    }

    // Ensure there's a minimum number of characters to show the popover
    if (config.minCharacters && !hasMinimumCharacters(editor, config.minCharacters)) {
      return false
    }

    // Check if first character is disallowed (/, @, etc.)
    if (
      config.disallowedFirstCharacters &&
      hasDisallowedFirstCharacter(editor, config.disallowedFirstCharacters)
    ) {
      return false
    }

    // Check end of line condition if specified
    if (config.showAtEndOfLine) {
      return isCaretAtEndOfLine(editor) && !isNodeEmpty(editor)
    }

    // If we got here and have node types to show in but no end of line requirement,
    // then we should show the popover
    return config.showInNodeTypes?.length ? true : false
  } catch (error) {
    log.debug('Error in shouldShowCaretPopover:', error)
    return false
  }
}

// Store active idle timers and visibility state directly in the editor's storage
// This avoids WeakMap key issues when the editor reference isn't stable

/**
 * Updates the caret popover visibility based on configuration
 */
export function updateCaretPopoverVisibility(
  editor: Editor,
  position: CaretPosition | null,
  setVisible: (visible: boolean) => void,
  config: CaretPopoverConfig = {
    showAtEndOfLine: true,
    onlyWhenIdle: true,
    minCharacters: 3,
    disallowedFirstCharacters: ['/', '@']
  }
): void {
  if (!editor || !editor.storage) {
    return
  }

  try {
    // Initialize storage properties if they don't exist
    if (!editor.storage.caretIndicatorState) {
      editor.storage.caretIndicatorState = {
        isVisible: false,
        idleTimerId: null
      }
    }

    // Get current visibility state from editor storage
    const isCurrentlyVisible = editor.storage.caretIndicatorState.isVisible || false

    // Check if this is a selection change without typing
    const isSelectionChange = editor.isActive && isEditorIdle(editor)

    // Check basic conditions (position at end of line, etc.)
    const basicConditionsMet = shouldShowCaretPopover(editor, position, {
      ...config,
      onlyWhenIdle: false // We'll handle idle state separately
    })

    // If it's a selection change and caret is already visible, maintain visibility
    if (isSelectionChange && isCurrentlyVisible && basicConditionsMet) {
      // Just update position without hiding/showing animation
      setVisible(true)

      // Update our tracking state
      editor.storage.caretIndicatorState.isVisible = true
      return
    }

    // Clear any existing idle timer
    if (editor.storage.caretIndicatorState.idleTimerId) {
      window.clearTimeout(editor.storage.caretIndicatorState.idleTimerId)
      editor.storage.caretIndicatorState.idleTimerId = null
    }

    // Handle typing activity - hide caret
    if (config.onlyWhenIdle && !isEditorIdle(editor)) {
      setVisible(false)
      editor.storage.caretIndicatorState.isVisible = false

      // Set up a new idle timer
      const timerId = window.setTimeout(() => {
        // When this timer fires, the editor should be idle
        // Re-check all conditions without the idle check
        const shouldShowNow = shouldShowCaretPopover(editor, position, {
          ...config,
          onlyWhenIdle: false // Don't double-check idle state
        })

        if (shouldShowNow) {
          // Force a re-render by explicitly setting visibility
          setVisible(true)
          if (editor && editor.storage && editor.storage.caretIndicatorState) {
            editor.storage.caretIndicatorState.isVisible = true
          }

          // Force a ProseMirror state update to trigger re-rendering
          if (editor && editor.view) {
            const tr = editor.state.tr.setMeta('forceUpdate', true)
            editor.view.dispatch(tr)
          }
        }

        // Clear the timer reference
        if (editor && editor.storage && editor.storage.caretIndicatorState) {
          editor.storage.caretIndicatorState.idleTimerId = null
        }
      }, IDLE_TIMEOUT)

      // Store the timer reference in editor storage
      editor.storage.caretIndicatorState.idleTimerId = timerId
    } else {
      // Standard visibility check for non-idle-dependent cases
      const shouldShow = shouldShowCaretPopover(editor, position, config)
      setVisible(shouldShow)
      editor.storage.caretIndicatorState.isVisible = shouldShow
    }
  } catch (error) {
    log.error('Error in updateCaretPopoverVisibility:', error)
    setVisible(false)
    if (editor && editor.storage && editor.storage.caretIndicatorState) {
      editor.storage.caretIndicatorState.isVisible = false
    }
  }
}
