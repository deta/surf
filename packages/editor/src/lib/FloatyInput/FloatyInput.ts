import { Extension } from '@tiptap/core'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { Plugin, PluginKey } from '@tiptap/pm/state'

interface FloatyInputOptions {
  onLastLineVisibilityChanged: (isVisible: boolean) => void
  onFirstLineStateChanged: (isFirstLine: boolean) => void
  observerOptions: IntersectionObserverInit
}

export const FloatyInput = Extension.create<FloatyInputOptions>({
  name: 'floatyInput',

  addOptions() {
    return {
      onLastLineVisibilityChanged: (isVisible: boolean) => {},
      onFirstLineStateChanged: (isFirstLine: boolean) => {},
      observerOptions: {
        threshold: 0,
        rootMargin: '0px'
      }
    }
  },

  addStorage() {
    return {
      observer: null as IntersectionObserver | null,
      isVisible: true,
      spacerWidgetDOM: null as HTMLElement | null
    }
  },

  onDestroy() {
    if (this.storage.observer) {
      this.storage.observer.disconnect()
      this.storage.observer = null
    }
  },

  addProseMirrorPlugins() {
    const extension = this

    return [
      new Plugin({
        key: new PluginKey('floatyInput'),

        state: {
          init() {
            return DecorationSet.empty
          },

          apply(tr, oldSet, oldState, newState) {
            const { doc, selection } = newState

            {
              let firstContentNode: any = null
              let hasContentAfterFirst = false

              // Iterate through top-level nodes to find content-bearing nodes
              doc.forEach((node, offset) => {
                if (node.type.name === 'titleNode') {
                  return true
                }
                if (node.textContent.trim() !== '') {
                  if (firstContentNode === null) {
                    firstContentNode = { node, pos: offset, endPos: offset + node.nodeSize }
                  } else {
                    hasContentAfterFirst = true
                    return false // Stop iteration after finding second content node
                  }
                }
                return true
              })

              // Add decoration if there's only one content-bearing node
              if (firstContentNode !== null) {
                const cursorPos = selection.from
                const isFirstNodeSelected =
                  cursorPos >= firstContentNode.pos && cursorPos <= firstContentNode.endPos

                // Apply the class if the cursor is in the first content node
                if (
                  isFirstNodeSelected &&
                  firstContentNode.node.type.name === 'paragraph' &&
                  !hasContentAfterFirst
                ) {
                  extension.options.onFirstLineStateChanged(true)
                } else {
                  extension.options.onFirstLineStateChanged(false)
                }
              } else {
                extension.options.onFirstLineStateChanged(true)
              }
            }

            const decorations: Decoration[] = []

            // Add active-line decoration
            const $pos = selection.$head
            for (let depth = $pos.depth; depth > 0; depth--) {
              const node = $pos.node(depth)
              if (node.isBlock) {
                const pos = $pos.before(depth)
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    class: 'active-line',
                    style: 'anchor-name: --editor-active-line;'
                  })
                )
                break
              }
            }
            // Create a widget at the end of the document
            const endPosition = doc.content.size

            decorations.push(
              Decoration.widget(
                endPosition,
                (view, getPos) => {
                  const spacer = document.createElement('div')
                  spacer.className = 'editor-spacer no-drag-handle'
                  spacer.style.height = '200px'
                  spacer.style.setProperty('anchor-name', '--editor-last-line')

                  // Store reference to observe it
                  extension.storage.spacerWidgetDOM = spacer

                  // Setup observer in the next tick to ensure the element is in DOM
                  setTimeout(() => {
                    if (extension.storage.spacerWidgetDOM && extension.storage.observer) {
                      extension.storage.observer.observe(extension.storage.spacerWidgetDOM)
                    }
                  }, 0)

                  return spacer
                },
                { key: 'end-spacer', side: 1 }
              )
            )

            return DecorationSet.create(doc, decorations)
          }
        },

        props: {
          decorations(state) {
            return this.getState(state)
          }
        },

        view(editorView) {
          // Setup the observer
          const setupObserver = () => {
            if (extension.storage.observer) {
              extension.storage.observer.disconnect()
            }

            extension.storage.observer = new IntersectionObserver((entries) => {
              if (entries[0]) {
                const isVisible = entries[0].isIntersecting
                if (isVisible !== extension.storage.isVisible) {
                  extension.storage.isVisible = isVisible
                  extension.options.onLastLineVisibilityChanged(isVisible)
                }
              }
            }, extension.options.observerOptions)

            // The actual observation of the element happens
            // when the widget is created in the decoration
          }

          // Setup observer initially
          setupObserver()

          return {
            update: () => {
              // The widget will be recreated on every state update
              // We only need to ensure the observer is set up
              if (!extension.storage.observer) {
                setupObserver()
              }
            },
            destroy: () => {
              if (extension.storage.observer) {
                extension.storage.observer.disconnect()
                extension.storage.observer = null
              }
            }
          }
        }
      })
    ]
  }
})

//export const FloatyInput = Extension.create<FloatyInputOptions>({
//  name: 'floatyInput',
//
//  addOptions() {
//    return {
//      onLastLineVisibilityChanged: (isVisible: boolean) => {},
//      observerOptions: {
//        threshold: 0,
//        rootMargin: '0px'
//      }
//    }
//  },
//
//  addStorage() {
//    return {
//      lastLineObserver: null as IntersectionObserver | null,
//      isLastLineVisible: true
//    }
//  },
//
//  onDestroy() {
//    if (this.storage.lastLineObserver) {
//      this.storage.lastLineObserver.disconnect()
//      this.storage.lastLineObserver = null
//    }
//  },
//
//  addProseMirrorPlugins() {
//    const extension = this
//
//    return [
//      new Plugin({
//        key: new PluginKey('floatyInput'),
//
//        state: {
//          init() {
//            return DecorationSet.empty
//          },
//
//          apply(tr, oldSet, oldState, newState) {
//            const { doc, selection } = newState
//            const decorations: Decoration[] = []
//
//            // Find the last block node to add the last-line decoration
//            let lastNodePos = -1
//            let lastNode = null
//
//            doc.descendants((node, pos) => {
//              if (node.isBlock) {
//                lastNodePos = pos
//                lastNode = node
//              }
//              return true
//            })
//
//            if (lastNodePos >= 0 && lastNode) {
//              // Add last-line decoration to the last block node
//              decorations.push(
//                Decoration.node(lastNodePos, lastNodePos + lastNode.nodeSize, {
//                  class: 'last-line',
//                  style: 'anchor-name: --editor-last-line;'
//                })
//              )
//            }
//
//            // Find the block node containing the cursor for active-line
//            if (selection.empty) {
//              const $pos = selection.$head
//              for (let depth = $pos.depth; depth > 0; depth--) {
//                const node = $pos.node(depth)
//                if (node.isBlock) {
//                  const pos = $pos.before(depth)
//                  decorations.push(
//                    Decoration.node(pos, pos + node.nodeSize, {
//                      class: 'active-line',
//                      style: 'anchor-name: --editor-active-line;'
//                    })
//                  )
//                  break
//                }
//              }
//            }
//
//            return DecorationSet.create(doc, decorations)
//          }
//        },
//
//        props: {
//          decorations(state) {
//            return this.getState(state)
//          }
//        },
//
//        view(editorView) {
//          const observeLastLine = () => {
//            if (extension.storage.lastLineObserver) {
//              extension.storage.lastLineObserver.disconnect()
//            }
//
//            extension.storage.lastLineObserver = new IntersectionObserver((entries) => {
//              if (entries[0]) {
//                const isVisible = entries[0].isIntersecting
//                if (isVisible !== extension.storage.isLastLineVisible) {
//                  extension.storage.isLastLineVisible = isVisible
//                  extension.options.onLastLineVisibilityChanged(isVisible)
//                }
//              }
//            }, extension.options.observerOptions)
//
//            setTimeout(() => {
//              const lastLineElements = editorView.dom.parentNode?.querySelectorAll('.last-line')
//              if (lastLineElements && lastLineElements.length > 0) {
//                const lastLineElement = lastLineElements[lastLineElements.length - 1]
//                extension.storage.lastLineObserver.observe(lastLineElement)
//              }
//            }, 10)
//          }
//
//          // Setup observer initially
//          setTimeout(observeLastLine, 50)
//
//          return {
//            update: () => {
//              // Re-setup observer when view updates
//              setTimeout(observeLastLine, 10)
//            },
//            destroy: () => {
//              if (extension.storage.lastLineObserver) {
//                extension.storage.lastLineObserver.disconnect()
//                extension.storage.lastLineObserver = null
//              }
//            }
//          }
//        }
//      })
//    ]
//  }
//})

//export const FloatyInput = Extension.create<FloatyInputOptions>({
//  name: 'floatyInput',
//
//  addOptions() {
//    return {
//      onFocusStateChange: (state: 'inline' | 'floaty' | 'bottom') => {},
//      observerOptions: {
//        threshold: 0,
//        rootMargin: '0px'
//      }
//    }
//  },
//
//  addStorage() {
//    return {
//      trailingObserver: null as IntersectionObserver | null,
//      activeNodeObserver: null as IntersectionObserver | null,
//      currentState: 'bottom' as 'inline' | 'floaty' | 'bottom',
//      stateBeforeBottom: 'floaty' as 'inline' | 'floaty',
//      activeNodePos: -1,
//      trailingNodeOutsideView: false,
//      activeNodeOutsideView: false
//    }
//  },
//
//  onDestroy() {
//    if (this.storage.trailingObserver) {
//      this.storage.trailingObserver.disconnect()
//      this.storage.trailingObserver = null
//    }
//
//    if (this.storage.activeNodeObserver) {
//      this.storage.activeNodeObserver.disconnect()
//      this.storage.activeNodeObserver = null
//    }
//  },
//
//  addProseMirrorPlugins() {
//    const extension = this
//
//    return [
//      new Plugin({
//        key: new PluginKey('floatyInput'),
//
//        state: {
//          init() {
//            return DecorationSet.empty
//          },
//
//          apply(tr, oldSet, oldState, newState) {
//            const { doc, selection } = newState
//            const decorations: Decoration[] = []
//
//            // Add trailing element decoration at the end of the document
//            const trailingElementWidget = Decoration.widget(
//              doc.content.size,
//              () => {
//                const element = document.createElement('div')
//                element.className = 'trailing-element'
//                element.style.height = '10px'
//                element.style.width = '100%'
//                element.style.position = 'relative'
//                element.style.pointerEvents = 'none'
//                return element
//              },
//              { key: 'trailing-element' }
//            )
//
//            decorations.push(trailingElementWidget)
//
//            // Find target node for floaty state (first empty paragraph at end of note)
//            let targetNodePos = -1
//            let targetNode = null
//
//            // First collect all block nodes
//            const blockNodes: { node: any; pos: number }[] = []
//            doc.descendants((node, pos) => {
//              if (node.isBlock) {
//                blockNodes.push({ node, pos })
//              }
//              return true
//            })
//
//            // Find the first empty paragraph after the last non-empty node
//            let lastNonEmptyIndex = -1
//
//            // Find the last non-empty block
//            for (let i = blockNodes.length - 1; i >= 0; i--) {
//              if (blockNodes[i].node.content.size > 0) {
//                lastNonEmptyIndex = i
//                break
//              }
//            }
//
//            // Find first empty paragraph after the last non-empty block
//            if (lastNonEmptyIndex >= 0 && lastNonEmptyIndex < blockNodes.length - 1) {
//              for (let i = lastNonEmptyIndex + 1; i < blockNodes.length; i++) {
//                const { node, pos } = blockNodes[i]
//                if (node.type.name === 'paragraph' && node.content.size === 0) {
//                  targetNodePos = pos
//                  targetNode = node
//                  break
//                }
//              }
//            }
//
//            // If no suitable empty paragraph was found, use the last block node
//            if (targetNodePos === -1 && blockNodes.length > 0) {
//              const lastBlock = blockNodes[blockNodes.length - 1]
//              targetNodePos = lastBlock.pos
//              targetNode = lastBlock.node
//            }
//
//            // Find active node (node with cursor)
//            let activeNodePos = -1
//            let activeNode = null
//
//            if (selection.empty) {
//              const $pos = selection.$head
//
//              // Find the block node containing the cursor
//              for (let depth = $pos.depth; depth > 0; depth--) {
//                const node = $pos.node(depth)
//                if (node.isBlock) {
//                  activeNodePos = $pos.before(depth)
//                  activeNode = node
//                  break
//                }
//              }
//            }
//
//            // Determine the current state
//            let newLineState = extension.storage.currentState
//
//            // Rule 1: If cursor is on an empty node and it's visible -> inline state
//            if (activeNodePos >= 0 && activeNode && activeNode.content.size === 0) {
//              // Mark active node for observation
//              decorations.push(
//                Decoration.node(activeNodePos, activeNodePos + activeNode.nodeSize, {
//                  class: 'active-node'
//                })
//              )
//
//              if (extension.storage.activeNodeOutsideView) {
//                // Active node not visible -> fall through to bottom or floaty
//                if (!extension.storage.trailingNodeOutsideView) {
//                  // Last line is visible, go to floaty
//                  newLineState = 'floaty'
//                } else {
//                  // Last line not visible, go to bottom
//                  newLineState = 'bottom'
//                }
//              } else {
//                // Active node is visible and empty -> inline state
//                newLineState = 'inline'
//              }
//
//              extension.storage.activeNodePos = activeNodePos
//            }
//            // Rule 2: If cursor is on the same node that was previously empty
//            else if (
//              activeNodePos >= 0 &&
//              activeNodePos === extension.storage.activeNodePos &&
//              extension.storage.currentState === 'inline'
//            ) {
//              // Mark active node for observation
//              decorations.push(
//                Decoration.node(activeNodePos, activeNodePos + activeNode.nodeSize, {
//                  class: 'active-node'
//                })
//              )
//
//              if (extension.storage.activeNodeOutsideView) {
//                // Active node not visible -> fall through to bottom or floaty
//                if (!extension.storage.trailingNodeOutsideView) {
//                  // Last line is visible, go to floaty
//                  newLineState = 'floaty'
//                } else {
//                  // Last line not visible, go to bottom
//                  newLineState = 'bottom'
//                }
//              } else {
//                // Continue inline state on same node
//                newLineState = 'inline'
//              }
//            }
//            // Rule 3: If not in inline state and trailing node is visible -> floaty state
//            else if (!extension.storage.trailingNodeOutsideView) {
//              // Last line is visible, go to floaty regardless of current state
//              newLineState = 'floaty'
//              extension.storage.activeNodePos = -1
//            }
//            // Rule 4: Default fallback to bottom state
//            else {
//              newLineState = 'bottom'
//              extension.storage.activeNodePos = -1
//            }
//
//            // Apply state changes if needed
//            if (newLineState !== extension.storage.currentState) {
//              if (newLineState === 'bottom' && extension.storage.currentState !== 'bottom') {
//                // Save current state before switching to bottom
//                extension.storage.stateBeforeBottom = extension.storage.currentState as
//                  | 'inline'
//                  | 'floaty'
//              }
//
//              extension.storage.currentState = newLineState
//              extension.options.onFocusStateChange(newLineState)
//            }
//
//            // Apply the anchor-name style based on current state
//            if (newLineState === 'inline' && activeNodePos >= 0 && activeNode) {
//              // In inline state, apply the style to the current cursor line
//              decorations.push(
//                Decoration.node(activeNodePos, activeNodePos + activeNode.nodeSize, {
//                  class: 'active-node-with-anchor',
//                  style: 'anchor-name: --floaty-bar-attach;'
//                })
//              )
//            } else if (newLineState === 'floaty' && targetNodePos >= 0 && targetNode) {
//              // In floaty state, apply the style to the first empty paragraph at the end
//              decorations.push(
//                Decoration.node(targetNodePos, targetNodePos + targetNode.nodeSize, {
//                  class: 'last-line',
//                  style: 'anchor-name: --floaty-bar-attach;'
//                })
//              )
//            }
//            // In bottom state, no anchor-name style is applied
//
//            return DecorationSet.create(doc, decorations)
//          }
//        },
//
//        props: {
//          decorations(state) {
//            return this.getState(state)
//          }
//        },
//
//        view(editorView) {
//          // Setup intersection observers
//          const setupObservers = () => {
//            // Setup trailing observer
//            if (extension.storage.trailingObserver) {
//              extension.storage.trailingObserver.disconnect()
//            }
//
//            extension.storage.trailingObserver = new IntersectionObserver((entries) => {
//              if (entries[0]) {
//                const isVisible = entries[0].isIntersecting
//                const wasVisible = !extension.storage.trailingNodeOutsideView
//                extension.storage.trailingNodeOutsideView = !isVisible
//
//                // If last-line became invisible and we're in floaty state, switch to bottom
//                if (!isVisible && extension.storage.currentState === 'floaty') {
//                  extension.storage.stateBeforeBottom = 'floaty'
//                  extension.storage.currentState = 'bottom'
//                  extension.options.onFocusStateChange('bottom')
//                  editorView.dispatch(editorView.state.tr.setMeta('forceUpdate', true))
//                }
//                // If last-line became visible and we're in inline or bottom state, go to floaty
//                else if (
//                  isVisible &&
//                  !wasVisible &&
//                  (extension.storage.currentState === 'bottom' ||
//                    (extension.storage.currentState === 'inline' &&
//                      extension.storage.activeNodeOutsideView))
//                ) {
//                  extension.storage.currentState = 'floaty'
//                  extension.options.onFocusStateChange('floaty')
//                  editorView.dispatch(editorView.state.tr.setMeta('forceUpdate', true))
//                }
//              }
//            }, extension.options.observerOptions)
//
//            // Setup active node observer
//            if (extension.storage.activeNodeObserver) {
//              extension.storage.activeNodeObserver.disconnect()
//            }
//
//            extension.storage.activeNodeObserver = new IntersectionObserver((entries) => {
//              if (entries[0]) {
//                const isVisible = entries[0].isIntersecting
//                extension.storage.activeNodeOutsideView = !isVisible
//
//                // If active node went out of view and we're in inline state
//                if (!isVisible && extension.storage.currentState === 'inline') {
//                  if (!extension.storage.trailingNodeOutsideView) {
//                    // If last line is visible, go to floaty
//                    extension.storage.currentState = 'floaty'
//                    extension.options.onFocusStateChange('floaty')
//                  } else {
//                    // Last line not visible, go to bottom
//                    extension.storage.stateBeforeBottom = 'inline'
//                    extension.storage.currentState = 'bottom'
//                    extension.options.onFocusStateChange('bottom')
//                  }
//                  editorView.dispatch(editorView.state.tr.setMeta('forceUpdate', true))
//                }
//                // If active node came back into view and was in inline before
//                else if (
//                  isVisible &&
//                  extension.storage.currentState === 'bottom' &&
//                  extension.storage.stateBeforeBottom === 'inline'
//                ) {
//                  extension.storage.currentState = 'inline'
//                  extension.options.onFocusStateChange('inline')
//                  editorView.dispatch(editorView.state.tr.setMeta('forceUpdate', true))
//                }
//              }
//            }, extension.options.observerOptions)
//
//            // Find and observe elements
//            setTimeout(() => {
//              // Observe trailing element
//              const trailingElements =
//                editorView.dom.parentNode?.querySelectorAll('.trailing-element')
//              if (trailingElements && trailingElements.length > 0) {
//                const trailingElement = trailingElements[trailingElements.length - 1]
//                extension.storage.trailingObserver.observe(trailingElement)
//              }
//
//              // Observe active node
//              const activeNodes = editorView.dom.parentNode?.querySelectorAll(
//                '.active-node, .active-node-with-anchor'
//              )
//              if (activeNodes && activeNodes.length > 0) {
//                const activeNode = activeNodes[activeNodes.length - 1]
//                extension.storage.activeNodeObserver.observe(activeNode)
//              }
//
//              // Observe last-line also with trailing observer
//              const lastLineNodes = editorView.dom.parentNode?.querySelectorAll('.last-line')
//              if (lastLineNodes && lastLineNodes.length > 0) {
//                const lastLineNode = lastLineNodes[lastLineNodes.length - 1]
//                extension.storage.trailingObserver.observe(lastLineNode)
//              }
//            }, 10)
//          }
//
//          // Setup observers initially
//          setTimeout(setupObservers, 50)
//
//          return {
//            update: () => {
//              // Re-setup observers to ensure they're targeting the most recent elements
//              setTimeout(setupObservers, 10)
//            },
//            destroy: () => {
//              if (extension.storage.trailingObserver) {
//                extension.storage.trailingObserver.disconnect()
//                extension.storage.trailingObserver = null
//              }
//
//              if (extension.storage.activeNodeObserver) {
//                extension.storage.activeNodeObserver.disconnect()
//                extension.storage.activeNodeObserver = null
//              }
//            }
//          }
//        }
//      })
//    ]
//  }
//})
